from datetime import date, datetime
from decimal import Decimal
from typing import Optional

import strawberry
from django.db.models import Sum

from shared.auth import require_auth
from apps.accounts.schema import AccountType, map_account
from apps.categories.schema import CategoryType, map_category
from .models import Transaction


# ── Forward refs para evitar importação circular ──────────────────────────────

@strawberry.type
class InvoiceRefType:
    id: strawberry.ID
    reference_month: date
    due_date: date
    status: str


@strawberry.type
class CreditCardRefType:
    id: strawberry.ID
    name: str
    brand: str


# ── Transaction type ──────────────────────────────────────────────────────────

@strawberry.type
class TransactionType:
    id: strawberry.ID
    description: str
    amount: float
    transaction_type: str
    payment_method: str
    date: date
    competence_date: Optional[date]
    account: Optional[AccountType]
    transfer_account: Optional[AccountType]
    credit_card: Optional[CreditCardRefType]
    invoice: Optional[InvoiceRefType]
    installment_number: Optional[int]
    total_installments: Optional[int]
    category: Optional[CategoryType]
    is_receivable: bool
    debtor_name: Optional[str]
    receipt_status: Optional[str]
    received_amount: float
    remaining_amount: float
    notes: Optional[str]
    created_at: datetime


def map_transaction(t: Transaction) -> TransactionType:
    credit_card_ref = None
    if t.credit_card_id:
        try:
            cc = t.credit_card
            credit_card_ref = CreditCardRefType(
                id=strawberry.ID(str(cc.id)),
                name=cc.name,
                brand=cc.brand,
            )
        except Exception:
            pass

    invoice_ref = None
    if t.invoice_id:
        try:
            inv = t.invoice
            invoice_ref = InvoiceRefType(
                id=strawberry.ID(str(inv.id)),
                reference_month=inv.reference_month,
                due_date=inv.due_date,
                status=inv.status,
            )
        except Exception:
            pass

    return TransactionType(
        id=strawberry.ID(str(t.id)),
        description=t.description,
        amount=float(t.amount),
        transaction_type=t.transaction_type,
        payment_method=t.payment_method,
        date=t.date,
        competence_date=t.competence_date,
        account=map_account(t.account) if t.account else None,
        transfer_account=map_account(t.transfer_account) if t.transfer_account else None,
        credit_card=credit_card_ref,
        invoice=invoice_ref,
        installment_number=t.installment_number,
        total_installments=t.total_installments,
        category=map_category(t.category) if t.category else None,
        is_receivable=t.is_receivable,
        debtor_name=t.debtor_name,
        receipt_status=t.receipt_status,
        received_amount=float(t.received_amount),
        remaining_amount=float(t.remaining_amount),
        notes=t.notes,
        created_at=t.created_at,
    )


# ── Dashboard types ───────────────────────────────────────────────────────────

@strawberry.type
class CategoryExpense:
    category_name: str
    category_color: str
    total: float
    percentage: float


@strawberry.type
class MonthBalance:
    month: str
    income: float
    expense: float
    balance: float


@strawberry.type
class DashboardSummary:
    total_balance: float
    month_income: float
    month_expense: float
    month_net: float
    total_receivable: float
    expense_by_category: list[CategoryExpense]
    balance_history: list[MonthBalance]


@strawberry.type
class CalendarEvent:
    date: date
    event_type: str  # transaction, invoice_due, recurrence, receivable
    title: str
    amount: Optional[float]
    color: str


# ── Inputs ────────────────────────────────────────────────────────────────────

@strawberry.input
class CreateTransactionInput:
    description: str
    amount: float
    transaction_type: str
    payment_method: str
    date: date
    account_id: Optional[strawberry.ID] = None
    transfer_account_id: Optional[strawberry.ID] = None
    credit_card_id: Optional[strawberry.ID] = None
    category_id: Optional[strawberry.ID] = None
    total_installments: int = 1
    is_receivable: bool = False
    debtor_name: Optional[str] = None
    competence_date: Optional[date] = None
    notes: Optional[str] = None


@strawberry.input
class UpdateTransactionInput:
    id: strawberry.ID
    description: Optional[str] = None
    amount: Optional[float] = None
    transaction_type: Optional[str] = None
    payment_method: Optional[str] = None
    date: Optional[date] = None
    competence_date: Optional[date] = None
    account_id: Optional[strawberry.ID] = None
    category_id: Optional[strawberry.ID] = None
    is_receivable: Optional[bool] = None
    debtor_name: Optional[str] = None
    notes: Optional[str] = None


@strawberry.input
class TransactionFilters:
    account_id: Optional[strawberry.ID] = None
    credit_card_id: Optional[strawberry.ID] = None
    invoice_id: Optional[strawberry.ID] = None
    category_id: Optional[strawberry.ID] = None
    transaction_type: Optional[str] = None
    payment_method: Optional[str] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    search: Optional[str] = None
    is_receivable: Optional[bool] = None
    receipt_status: Optional[str] = None


# ── Queries ───────────────────────────────────────────────────────────────────

@strawberry.type
class TransactionQuery:
    @strawberry.field
    def transactions(
        self,
        info: strawberry.types.Info,
        filters: Optional[TransactionFilters] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[TransactionType]:
        user = require_auth(info)
        qs = Transaction.objects.filter(user=user, parent_transaction__isnull=True).select_related(
            "account", "transfer_account", "credit_card", "invoice", "category"
        )

        if filters:
            if filters.account_id:
                qs = qs.filter(account_id=filters.account_id)
            if filters.credit_card_id:
                qs = qs.filter(credit_card_id=filters.credit_card_id)
            if filters.invoice_id:
                qs = qs.filter(invoice_id=filters.invoice_id)
            if filters.category_id:
                qs = qs.filter(category_id=filters.category_id)
            if filters.transaction_type:
                qs = qs.filter(transaction_type=filters.transaction_type)
            if filters.payment_method:
                qs = qs.filter(payment_method=filters.payment_method)
            if filters.date_from:
                qs = qs.filter(date__gte=filters.date_from)
            if filters.date_to:
                qs = qs.filter(date__lte=filters.date_to)
            if filters.search:
                qs = qs.filter(description__icontains=filters.search)
            if filters.is_receivable is not None:
                qs = qs.filter(is_receivable=filters.is_receivable)
            if filters.receipt_status:
                qs = qs.filter(receipt_status=filters.receipt_status)

        return [map_transaction(t) for t in qs[offset: offset + limit]]

    @strawberry.field
    def invoice_transactions(
        self, info: strawberry.types.Info, invoice_id: strawberry.ID
    ) -> list[TransactionType]:
        user = require_auth(info)
        qs = Transaction.objects.filter(
            invoice_id=invoice_id,
            credit_card__user=user,
        ).select_related("account", "credit_card", "invoice", "category")
        return [map_transaction(t) for t in qs]

    @strawberry.field
    def transaction(self, info: strawberry.types.Info, id: strawberry.ID) -> TransactionType:
        user = require_auth(info)
        t = Transaction.objects.filter(id=id, user=user).select_related(
            "account", "transfer_account", "credit_card", "invoice", "category"
        ).first()
        if not t:
            raise Exception("Lançamento não encontrado.")
        return map_transaction(t)

    @strawberry.field
    def dashboard_summary(
        self, info: strawberry.types.Info, year: int, month: int
    ) -> DashboardSummary:
        from apps.accounts.models import Account
        from apps.accounts.schema import _compute_balance
        from apps.transactions.models import Transaction

        user = require_auth(info)

        # Saldo total
        accounts = Account.objects.filter(user=user, is_active=True)
        total_balance = sum(_compute_balance(a) for a in accounts)

        # Mês corrente
        month_txs = Transaction.objects.filter(
            user=user, date__year=year, date__month=month
        )
        month_income = float(
            month_txs.filter(transaction_type="income").aggregate(t=Sum("amount"))["t"] or 0
        )
        month_expense = float(
            month_txs.filter(transaction_type="expense").aggregate(t=Sum("amount"))["t"] or 0
        )

        # Total a receber
        total_receivable = float(
            Transaction.objects.filter(
                user=user, is_receivable=True, receipt_status__in=["pending", "partial"]
            ).aggregate(t=Sum("amount") - Sum("received_amount"))["t"] or 0
        )

        # Despesas por categoria
        from django.db.models import F
        cat_data = (
            month_txs.filter(transaction_type="expense", category__isnull=False)
            .values("category__name", "category__color")
            .annotate(total=Sum("amount"))
            .order_by("-total")
        )
        total_exp_cat = sum(float(r["total"]) for r in cat_data) or 1
        expense_by_category = [
            CategoryExpense(
                category_name=r["category__name"],
                category_color=r["category__color"],
                total=float(r["total"]),
                percentage=round(float(r["total"]) / total_exp_cat * 100, 1),
            )
            for r in cat_data
        ]

        # Histórico dos últimos 6 meses
        history = []
        for i in range(5, -1, -1):
            m = month - i
            y = year
            while m <= 0:
                m += 12
                y -= 1
            label = date(y, m, 1).strftime("%b/%y")
            inc = float(
                Transaction.objects.filter(user=user, date__year=y, date__month=m, transaction_type="income")
                .aggregate(t=Sum("amount"))["t"] or 0
            )
            exp = float(
                Transaction.objects.filter(user=user, date__year=y, date__month=m, transaction_type="expense")
                .aggregate(t=Sum("amount"))["t"] or 0
            )
            history.append(MonthBalance(month=label, income=inc, expense=exp, balance=inc - exp))

        return DashboardSummary(
            total_balance=total_balance,
            month_income=month_income,
            month_expense=month_expense,
            month_net=month_income - month_expense,
            total_receivable=total_receivable,
            expense_by_category=expense_by_category,
            balance_history=history,
        )

    @strawberry.field
    def calendar_events(
        self, info: strawberry.types.Info, year: int, month: int
    ) -> list[CalendarEvent]:
        from apps.credit_cards.models import Invoice
        from apps.recurrences.models import Recurrence

        user = require_auth(info)
        events: list[CalendarEvent] = []

        # Lançamentos do mês
        txs = Transaction.objects.filter(
            user=user,
            date__year=year,
            date__month=month,
            parent_transaction__isnull=True,
        ).select_related("category")
        for t in txs:
            color = "#10b981" if t.transaction_type == "income" else "#ef4444"
            if t.transaction_type == "transfer":
                color = "#3b82f6"
            events.append(CalendarEvent(
                date=t.date,
                event_type="transaction",
                title=t.description,
                amount=float(t.amount),
                color=color,
            ))

        # Vencimentos de fatura
        invoices = Invoice.objects.filter(
            credit_card__user=user,
            due_date__year=year,
            due_date__month=month,
            status__in=["open", "closed", "partial"],
        ).select_related("credit_card")
        for inv in invoices:
            events.append(CalendarEvent(
                date=inv.due_date,
                event_type="invoice_due",
                title=f"Venc. Fatura {inv.credit_card.name}",
                amount=float(inv.total_amount),
                color="#f97316",
            ))

        # Recorrências do mês
        recurrences = Recurrence.objects.filter(user=user, is_active=True)
        for rec in recurrences:
            exec_date = rec.get_execution_date(year, month)
            if exec_date:
                color = "#10b981" if rec.recurrence_type == "income" else "#8b5cf6"
                events.append(CalendarEvent(
                    date=exec_date,
                    event_type="recurrence",
                    title=rec.description,
                    amount=float(rec.amount),
                    color=color,
                ))

        events.sort(key=lambda e: e.date)
        return events


# ── Mutations ─────────────────────────────────────────────────────────────────

@strawberry.type
class TransactionMutation:
    @strawberry.mutation
    def create_transaction(
        self, info: strawberry.types.Info, input: CreateTransactionInput
    ) -> TransactionType:
        from apps.accounts.models import Account
        from apps.categories.models import Category
        from apps.credit_cards.models import CreditCard, get_first_invoice_month, get_or_create_invoice, add_months

        user = require_auth(info)

        account = None
        if input.account_id:
            account = Account.objects.filter(id=input.account_id, user=user).first()

        transfer_account = None
        if input.transfer_account_id:
            transfer_account = Account.objects.filter(id=input.transfer_account_id, user=user).first()

        credit_card = None
        if input.credit_card_id:
            credit_card = CreditCard.objects.filter(id=input.credit_card_id, user=user).first()
            if not credit_card:
                raise Exception("Cartão de crédito não encontrado.")

        category = None
        if input.category_id:
            category = Category.objects.filter(id=input.category_id, user=user).first()

        receipt_status = "pending" if input.is_receivable else None

        # ── Crédito parcelado ──────────────────────────────────────────────
        if credit_card and input.total_installments > 1:
            total = Decimal(str(input.amount))
            n = input.total_installments
            base_installment = (total / n).quantize(Decimal("0.01"))
            remainder = total - base_installment * n

            first_month = get_first_invoice_month(credit_card, input.date)

            # Cria transação pai (representando o total)
            parent = Transaction.objects.create(
                user=user,
                description=input.description,
                amount=total,
                transaction_type="expense",
                payment_method="credit",
                date=input.date,
                competence_date=input.competence_date,
                credit_card=credit_card,
                category=category,
                is_receivable=input.is_receivable,
                debtor_name=input.debtor_name if input.is_receivable else None,
                receipt_status=receipt_status,
                total_installments=n,
                notes=input.notes,
            )

            for i in range(n):
                inv_month = add_months(first_month, i)
                invoice = get_or_create_invoice(credit_card, inv_month)
                installment_amount = base_installment + (remainder if i == n - 1 else Decimal("0"))
                Transaction.objects.create(
                    user=user,
                    description=f"{input.description} ({i+1}/{n})",
                    amount=installment_amount,
                    transaction_type="expense",
                    payment_method="credit",
                    date=input.date,
                    competence_date=invoice.due_date,
                    credit_card=credit_card,
                    invoice=invoice,
                    installment_number=i + 1,
                    total_installments=n,
                    parent_transaction=parent,
                    category=category,
                    is_receivable=input.is_receivable,
                    debtor_name=input.debtor_name if input.is_receivable else None,
                    receipt_status=receipt_status,
                    notes=input.notes,
                )

            return map_transaction(parent)

        # ── Crédito à vista ────────────────────────────────────────────────
        if credit_card:
            first_month = get_first_invoice_month(credit_card, input.date)
            invoice = get_or_create_invoice(credit_card, first_month)
            t = Transaction.objects.create(
                user=user,
                description=input.description,
                amount=Decimal(str(input.amount)),
                transaction_type="expense",
                payment_method="credit",
                date=input.date,
                competence_date=invoice.due_date,
                credit_card=credit_card,
                invoice=invoice,
                installment_number=1,
                total_installments=1,
                category=category,
                is_receivable=input.is_receivable,
                debtor_name=input.debtor_name if input.is_receivable else None,
                receipt_status=receipt_status,
                notes=input.notes,
            )
            return map_transaction(t)

        # ── Débito / PIX / Dinheiro / Transferência ────────────────────────
        if not account:
            raise Exception("Conta obrigatória para esse meio de pagamento.")

        t = Transaction.objects.create(
            user=user,
            description=input.description,
            amount=Decimal(str(input.amount)),
            transaction_type=input.transaction_type,
            payment_method=input.payment_method,
            date=input.date,
            competence_date=input.competence_date,
            account=account,
            transfer_account=transfer_account,
            category=category,
            is_receivable=input.is_receivable,
            debtor_name=input.debtor_name if input.is_receivable else None,
            receipt_status=receipt_status,
            notes=input.notes,
        )
        return map_transaction(t)

    @strawberry.mutation
    def update_transaction(
        self, info: strawberry.types.Info, input: UpdateTransactionInput
    ) -> TransactionType:
        from apps.accounts.models import Account
        from apps.categories.models import Category

        user = require_auth(info)
        t = Transaction.objects.filter(id=input.id, user=user).first()
        if not t:
            raise Exception("Lançamento não encontrado.")

        if input.description is not None:
            t.description = input.description
        if input.amount is not None:
            t.amount = Decimal(str(input.amount))
        if input.transaction_type is not None:
            t.transaction_type = input.transaction_type
        if input.payment_method is not None:
            t.payment_method = input.payment_method
        if input.date is not None:
            t.date = input.date
        if input.competence_date is not None:
            t.competence_date = input.competence_date
        if input.account_id is not None:
            t.account = Account.objects.filter(id=input.account_id, user=user).first()
        if input.category_id is not None:
            t.category = Category.objects.filter(id=input.category_id, user=user).first()
        if input.is_receivable is not None:
            t.is_receivable = input.is_receivable
        if input.debtor_name is not None:
            t.debtor_name = input.debtor_name
        if input.notes is not None:
            t.notes = input.notes

        t.save()
        t.refresh_from_db()
        return map_transaction(t)

    @strawberry.mutation
    def delete_transaction(self, info: strawberry.types.Info, id: strawberry.ID) -> bool:
        user = require_auth(info)
        deleted, _ = Transaction.objects.filter(id=id, user=user).delete()
        return deleted > 0
