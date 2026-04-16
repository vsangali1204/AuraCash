from datetime import date, datetime
from decimal import Decimal
from typing import Optional

import strawberry

from shared.auth import require_auth
from .models import CreditCard, Invoice, get_first_invoice_month, get_or_create_invoice, add_months


# ── Types ─────────────────────────────────────────────────────────────────────

@strawberry.type
class InvoiceType:
    id: strawberry.ID
    reference_month: date
    closing_date: date
    due_date: date
    total_amount: float
    paid_amount: float
    status: str


@strawberry.type
class CreditCardType:
    id: strawberry.ID
    name: str
    brand: str
    total_limit: float
    available_limit: float
    closing_day: int
    due_day: int
    is_active: bool
    account_id: Optional[strawberry.ID]
    account_name: Optional[str]
    created_at: datetime
    current_invoice: Optional[InvoiceType]


def map_invoice(inv: Invoice) -> InvoiceType:
    return InvoiceType(
        id=strawberry.ID(str(inv.id)),
        reference_month=inv.reference_month,
        closing_date=inv.closing_date,
        due_date=inv.due_date,
        total_amount=float(inv.total_amount),
        paid_amount=float(inv.paid_amount),
        status=inv.status,
    )


def map_credit_card(card: CreditCard) -> CreditCardType:
    today = date.today()
    # Fatura corrente: invoice do mês vigente
    first = get_first_invoice_month(card, today)
    # O mês corrente pode ainda estar aberto
    current_ref = today.replace(day=1)
    current_inv = Invoice.objects.filter(credit_card=card, reference_month=current_ref).first()

    return CreditCardType(
        id=strawberry.ID(str(card.id)),
        name=card.name,
        brand=card.brand,
        total_limit=float(card.total_limit),
        available_limit=float(card.available_limit),
        closing_day=card.closing_day,
        due_day=card.due_day,
        is_active=card.is_active,
        account_id=strawberry.ID(str(card.account_id)) if card.account_id else None,
        account_name=card.account.name if card.account else None,
        created_at=card.created_at,
        current_invoice=map_invoice(current_inv) if current_inv else None,
    )


# ── Inputs ────────────────────────────────────────────────────────────────────

@strawberry.input
class CreateCreditCardInput:
    name: str
    brand: str = "visa"
    total_limit: float = 0.0
    closing_day: int = 1
    due_day: int = 10
    account_id: Optional[strawberry.ID] = None


@strawberry.input
class UpdateCreditCardInput:
    id: strawberry.ID
    name: Optional[str] = None
    brand: Optional[str] = None
    total_limit: Optional[float] = None
    closing_day: Optional[int] = None
    due_day: Optional[int] = None
    account_id: Optional[strawberry.ID] = None
    is_active: Optional[bool] = None


@strawberry.input
class PayInvoiceInput:
    invoice_id: strawberry.ID
    amount: float
    source_account_id: strawberry.ID
    payment_date: date


# ── Queries ───────────────────────────────────────────────────────────────────

@strawberry.type
class CreditCardQuery:
    @strawberry.field
    def credit_cards(self, info: strawberry.types.Info) -> list[CreditCardType]:
        user = require_auth(info)
        return [map_credit_card(c) for c in CreditCard.objects.filter(user=user, is_active=True).select_related("account")]

    @strawberry.field
    def credit_card(self, info: strawberry.types.Info, id: strawberry.ID) -> CreditCardType:
        user = require_auth(info)
        card = CreditCard.objects.filter(id=id, user=user).select_related("account").first()
        if not card:
            raise Exception("Cartão não encontrado.")
        return map_credit_card(card)

    @strawberry.field
    def invoices(
        self,
        info: strawberry.types.Info,
        credit_card_id: strawberry.ID,
    ) -> list[InvoiceType]:
        user = require_auth(info)
        card = CreditCard.objects.filter(id=credit_card_id, user=user).first()
        if not card:
            raise Exception("Cartão não encontrado.")
        return [map_invoice(inv) for inv in Invoice.objects.filter(credit_card=card)]

    @strawberry.field
    def invoice(self, info: strawberry.types.Info, id: strawberry.ID) -> InvoiceType:
        user = require_auth(info)
        inv = Invoice.objects.filter(id=id, credit_card__user=user).first()
        if not inv:
            raise Exception("Fatura não encontrada.")
        return map_invoice(inv)


# ── Mutations ─────────────────────────────────────────────────────────────────

@strawberry.type
class CreditCardMutation:
    @strawberry.mutation
    def create_credit_card(
        self, info: strawberry.types.Info, input: CreateCreditCardInput
    ) -> CreditCardType:
        from apps.accounts.models import Account

        user = require_auth(info)
        account = None
        if input.account_id:
            account = Account.objects.filter(id=input.account_id, user=user).first()

        card = CreditCard.objects.create(
            user=user,
            account=account,
            name=input.name,
            brand=input.brand,
            total_limit=Decimal(str(input.total_limit)),
            closing_day=input.closing_day,
            due_day=input.due_day,
        )
        return map_credit_card(card)

    @strawberry.mutation
    def update_credit_card(
        self, info: strawberry.types.Info, input: UpdateCreditCardInput
    ) -> CreditCardType:
        from apps.accounts.models import Account

        user = require_auth(info)
        card = CreditCard.objects.filter(id=input.id, user=user).select_related("account").first()
        if not card:
            raise Exception("Cartão não encontrado.")

        if input.name is not None:
            card.name = input.name
        if input.brand is not None:
            card.brand = input.brand
        if input.total_limit is not None:
            card.total_limit = Decimal(str(input.total_limit))
        if input.closing_day is not None:
            card.closing_day = input.closing_day
        if input.due_day is not None:
            card.due_day = input.due_day
        if input.account_id is not None:
            account = Account.objects.filter(id=input.account_id, user=user).first()
            card.account = account
        if input.is_active is not None:
            card.is_active = input.is_active

        card.save()
        return map_credit_card(card)

    @strawberry.mutation
    def delete_credit_card(self, info: strawberry.types.Info, id: strawberry.ID) -> bool:
        user = require_auth(info)
        deleted, _ = CreditCard.objects.filter(id=id, user=user).delete()
        return deleted > 0

    @strawberry.mutation
    def pay_invoice(
        self, info: strawberry.types.Info, input: PayInvoiceInput
    ) -> InvoiceType:
        from apps.accounts.models import Account
        from apps.transactions.models import Transaction

        user = require_auth(info)

        inv = Invoice.objects.filter(id=input.invoice_id, credit_card__user=user).first()
        if not inv:
            raise Exception("Fatura não encontrada.")

        account = Account.objects.filter(id=input.source_account_id, user=user).first()
        if not account:
            raise Exception("Conta não encontrada.")

        payment = Decimal(str(input.amount))
        total = inv.total_amount

        # Registra pagamento como despesa na conta
        Transaction.objects.create(
            user=user,
            description=f"Pagamento fatura {inv.credit_card.name} {inv.reference_month.strftime('%m/%Y')}",
            amount=payment,
            transaction_type="expense",
            payment_method="pix",
            date=input.payment_date,
            account=account,
            notes=f"Fatura ID {inv.id}",
        )

        # Atualiza fatura
        inv.paid_amount += payment
        if inv.paid_amount >= total:
            inv.status = Invoice.Status.PAID
        else:
            inv.status = Invoice.Status.PARTIAL
        inv.save()

        return map_invoice(inv)
