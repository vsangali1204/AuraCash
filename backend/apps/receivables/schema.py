from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional

import strawberry
from django.db.models import Sum
from django.utils import timezone

from shared.auth import require_auth
from .models import Receipt
from apps.accounts.schema import map_account
from apps.categories.schema import map_category
from apps.transactions.schema import (
    CreditCardRefType,
    RecurrenceRefType,
    TransactionType,
    map_transaction,
)
from apps.transactions.models import Transaction as TransactionModel


@strawberry.type
class ReceiptType:
    id: strawberry.ID
    transaction_id: strawberry.ID
    transaction_description: str
    amount_received: float
    receipt_date: date
    destination_account_id: strawberry.ID
    destination_account_name: str
    notes: Optional[str]
    created_at: datetime


@strawberry.type
class ReceivableSummaryType:
    debtor_name: str
    total_amount: float
    received_amount: float
    pending_amount: float
    transaction_count: int


def map_receipt(r: Receipt) -> ReceiptType:
    return ReceiptType(
        id=strawberry.ID(str(r.id)),
        transaction_id=strawberry.ID(str(r.transaction_id)),
        transaction_description=r.transaction.description,
        amount_received=float(r.amount_received),
        receipt_date=r.receipt_date,
        destination_account_id=strawberry.ID(str(r.destination_account_id)),
        destination_account_name=r.destination_account.name,
        notes=r.notes,
        created_at=r.created_at,
    )


@strawberry.input
class CreateReceiptInput:
    transaction_id: strawberry.ID
    amount_received: float
    receipt_date: date
    destination_account_id: strawberry.ID
    notes: Optional[str] = None
    defer_remaining_to_date: Optional[date] = None  # data customizada para adiar o saldo restante


@strawberry.input
class BulkReceiveInput:
    transaction_ids: list[strawberry.ID]
    receipt_date: date
    destination_account_id: strawberry.ID
    notes: Optional[str] = None
    total_amount: Optional[float] = None  # se informado, rateia proporcionalmente


def _recent_months(year: int, month: int, back: int = 2) -> list[tuple[int, int]]:
    """Retorna [ (year, month) ] dos `back` meses anteriores até o mês informado, em ordem crescente."""
    out = []
    for i in range(back, -1, -1):
        mm, yy = month - i, year
        while mm <= 0:
            mm += 12
            yy -= 1
        out.append((yy, mm))
    return out


def _build_projected_transaction(rec, exec_date: date) -> TransactionType:
    """Monta uma linha "prevista" (não salva no banco) para uma recorrência
    marcada como cobrança que ainda não gerou o Transaction real do mês."""
    credit_card_ref = None
    if rec.credit_card_id:
        credit_card_ref = CreditCardRefType(
            id=strawberry.ID(str(rec.credit_card_id)),
            name=rec.credit_card.name,
            brand=rec.credit_card.brand,
        )

    return TransactionType(
        id=strawberry.ID(f"proj-{rec.id}-{exec_date.isoformat()}"),
        description=rec.description,
        amount=round(float(rec.amount), 2),
        transaction_type=rec.recurrence_type,
        payment_method=rec.payment_method,
        date=exec_date,
        competence_date=exec_date,
        account=map_account(rec.account, movement=0.0) if rec.account_id else None,
        transfer_account=None,
        credit_card=credit_card_ref,
        invoice=None,
        installment_number=None,
        total_installments=None,
        category=map_category(rec.category) if rec.category_id else None,
        is_receivable=True,
        debtor_name=rec.debtor_name,
        receipt_status="pending",
        received_amount=0.0,
        remaining_amount=round(float(rec.amount), 2),
        is_partial_remainder=False,
        is_pending_recurrence=False,
        recurrence=RecurrenceRefType(id=strawberry.ID(str(rec.id)), description=rec.description),
        notes=None,
        created_at=timezone.now(),
        is_projected=True,
    )


def _projected_receivables(user, year: int, month: int) -> list[TransactionType]:
    """Recorrências ativas marcadas como cobrança que ainda não geraram o
    lançamento real deste mês — mostradas como previsão na tela de A Receber."""
    from apps.recurrences.models import Recurrence
    from apps.credit_cards.models import get_first_invoice_month, get_or_create_invoice

    recs = Recurrence.objects.filter(
        user=user, is_active=True, is_receivable=True,
    ).select_related("category", "credit_card", "account")

    projected: list[TransactionType] = []
    for rec in recs:
        if rec.payment_method == "credit" and rec.credit_card_id:
            # O gasto só "chega" quando a fatura vence — projeta pela fatura de destino.
            for check_year, check_month in _recent_months(year, month):
                exec_date = rec.get_execution_date_in_range(check_year, check_month)
                if not exec_date:
                    continue
                already = TransactionModel.objects.filter(
                    recurrence=rec, date__year=check_year, date__month=check_month
                ).exists()
                if already:
                    continue
                invoice_ref_month = get_first_invoice_month(rec.credit_card, exec_date)
                invoice = get_or_create_invoice(rec.credit_card, invoice_ref_month)
                if invoice.due_date.year == year and invoice.due_date.month == month:
                    projected.append(_build_projected_transaction(rec, invoice.due_date))
        else:
            exec_date = rec.get_execution_date_in_range(year, month)
            if not exec_date:
                continue
            already = TransactionModel.objects.filter(
                recurrence=rec, date__year=year, date__month=month
            ).exists()
            if not already:
                projected.append(_build_projected_transaction(rec, exec_date))
    return projected


@strawberry.type
class ReceivableQuery:
    @strawberry.field
    def receivable_summary(
        self, info: strawberry.types.Info
    ) -> list[ReceivableSummaryType]:
        from apps.transactions.models import Transaction

        user = require_auth(info)

        base_qs = Transaction.objects.filter(
            user=user,
            is_receivable=True,
            receipt_status__in=["pending", "partial"],
            is_pending_recurrence=False,
        ).exclude(parent_transaction__isnull=True, total_installments__gt=1)

        from django.db.models import Count
        txs = base_qs.values("debtor_name").annotate(
            total=Sum("amount"),
            received=Sum("received_amount"),
            count=Count("id"),
        )

        return [
            ReceivableSummaryType(
                debtor_name=row["debtor_name"] or "Sem nome",
                total_amount=float(row["total"]),
                received_amount=float(row["received"]),
                pending_amount=float(row["total"] - row["received"]),
                transaction_count=row["count"],
            )
            for row in txs
        ]

    @strawberry.field
    def receivable_transactions(
        self,
        info: strawberry.types.Info,
        debtor_name: Optional[str] = None,
        status: Optional[str] = None,
        period: Optional[str] = None,  # overdue | all | "YYYY-MM" (aceita legado this_month/next_month)
    ) -> list[TransactionType]:
        user = require_auth(info)
        today = timezone.localdate()

        qs = TransactionModel.objects.filter(
            user=user,
            is_receivable=True,
            receipt_status__in=["pending", "partial"],
        ).exclude(parent_transaction__isnull=True, total_installments__gt=1).select_related(
            "account", "credit_card", "invoice", "category", "recurrence"
        ).order_by("competence_date", "date")

        if debtor_name:
            qs = qs.filter(debtor_name=debtor_name)
        if status:
            qs = qs.filter(receipt_status=status)

        # Mês projetado (year, month) quando period aponta pra um mês específico
        # atual ou futuro — usado para completar a lista com recorrências que
        # ainda não geraram o lançamento real desse mês.
        projected_month: Optional[tuple[int, int]] = None

        if period == "overdue":
            qs = qs.filter(competence_date__lt=today)
        elif period and period != "all":
            if period == "this_month":
                year, month = today.year, today.month
            elif period == "next_month":
                year, month = (today.year + 1, 1) if today.month == 12 else (today.year, today.month + 1)
            else:
                try:
                    year, month = (int(p) for p in period.split("-"))
                except ValueError:
                    year, month = today.year, today.month
            qs = qs.filter(competence_date__year=year, competence_date__month=month)
            if (year, month) >= (today.year, today.month):
                projected_month = (year, month)

        results = [map_transaction(t) for t in qs]

        if projected_month and not debtor_name and not status:
            year, month = projected_month
            for proj in _projected_receivables(user, year, month):
                results.append(proj)

        results.sort(key=lambda t: (t.competence_date or t.date, t.date))
        return results

    @strawberry.field
    def receipts(
        self, info: strawberry.types.Info, transaction_id: strawberry.ID
    ) -> list[ReceiptType]:
        user = require_auth(info)
        return [
            map_receipt(r)
            for r in Receipt.objects.filter(
                transaction_id=transaction_id,
                transaction__user=user,
            ).select_related("destination_account", "transaction")
        ]


@strawberry.type
class ReceivableMutation:
    @strawberry.mutation
    def create_receipt(
        self, info: strawberry.types.Info, input: CreateReceiptInput
    ) -> ReceiptType:
        from apps.accounts.models import Account

        user = require_auth(info)

        tx = TransactionModel.objects.filter(id=input.transaction_id, user=user, is_receivable=True).first()
        if not tx:
            raise Exception("Lançamento a receber não encontrado.")

        dest_account = Account.objects.filter(id=input.destination_account_id, user=user).first()
        if not dest_account:
            raise Exception("Conta destino não encontrada.")

        amount = Decimal(str(input.amount_received))
        if amount <= Decimal("0"):
            raise Exception("Valor deve ser positivo.")

        remaining = tx.amount - tx.received_amount

        receipt = Receipt.objects.create(
            transaction=tx,
            amount_received=amount,
            receipt_date=input.receipt_date,
            destination_account=dest_account,
            notes=input.notes,
        )

        debtor_suffix = f" ({tx.debtor_name})" if tx.debtor_name else ""
        TransactionModel.objects.create(
            user=user,
            description=f"Recebimento: {tx.description}{debtor_suffix}",
            amount=amount,
            transaction_type="income",
            payment_method="pix",
            date=input.receipt_date,
            account=dest_account,
            category=tx.category,
            notes=input.notes,
        )

        leftover = remaining - amount  # positivo = ainda falta; negativo = pagamento a mais

        if leftover > Decimal("0"):
            # Pagamento parcial: quita o original e cria novo recebível
            # Usa a data informada pelo usuário ou fallback de 30 dias
            defer_date = input.defer_remaining_to_date or (input.receipt_date + timedelta(days=30))
            TransactionModel.objects.create(
                user=user,
                description=tx.description,
                amount=leftover,
                transaction_type=tx.transaction_type,
                payment_method=tx.payment_method,
                date=defer_date,
                competence_date=defer_date,
                account=tx.account,
                category=tx.category,
                is_receivable=True,
                debtor_name=tx.debtor_name,
                receipt_status="pending",
                received_amount=Decimal("0"),
                is_partial_remainder=True,
                notes=tx.notes,
            )

        # Sempre quita o lançamento original (seja pagamento parcial ou integral)
        tx.received_amount = tx.amount
        tx.receipt_status = "received"
        tx.save()
        return map_receipt(receipt)

    @strawberry.mutation
    def bulk_receive(
        self, info: strawberry.types.Info, input: BulkReceiveInput
    ) -> int:
        """Recebe lançamentos em lote. Se total_amount for informado, rateia proporcionalmente."""
        from apps.accounts.models import Account

        user = require_auth(info)

        dest_account = Account.objects.filter(id=input.destination_account_id, user=user).first()
        if not dest_account:
            raise Exception("Conta destino não encontrada.")

        # Carrega todas as transações válidas de uma vez
        txs = []
        for tx_id in input.transaction_ids:
            tx = TransactionModel.objects.filter(
                id=tx_id, user=user, is_receivable=True
            ).first()
            if not tx or tx.receipt_status == "received":
                continue
            remaining = tx.amount - tx.received_amount
            if remaining <= Decimal("0"):
                continue
            txs.append((tx, remaining))

        if not txs:
            return 0

        if input.total_amount is not None:
            # ── Rateio proporcional ──────────────────────────────────────────
            total_to_distribute = Decimal(str(input.total_amount))
            if total_to_distribute <= Decimal("0"):
                raise Exception("Valor deve ser positivo.")

            total_pending = sum(r for _, r in txs)
            distributed = Decimal("0")
            count = 0

            for i, (tx, remaining) in enumerate(txs):
                # Última transação absorve o arredondamento
                if i == len(txs) - 1:
                    prorated = total_to_distribute - distributed
                else:
                    prorated = (remaining / total_pending * total_to_distribute).quantize(Decimal("0.01"))

                if prorated <= Decimal("0"):
                    continue

                # Não ultrapassa o que falta na transação
                prorated = min(prorated, remaining)

                Receipt.objects.create(
                    transaction=tx,
                    amount_received=prorated,
                    receipt_date=input.receipt_date,
                    destination_account=dest_account,
                    notes=input.notes,
                )
                TransactionModel.objects.create(
                    user=user,
                    description=f"Recebimento: {tx.description}" + (f" ({tx.debtor_name})" if tx.debtor_name else ""),
                    amount=prorated,
                    transaction_type="income",
                    payment_method="pix",
                    date=input.receipt_date,
                    account=dest_account,
                    category=tx.category,
                )
                tx.received_amount += prorated
                tx.receipt_status = "received" if tx.received_amount >= tx.amount else "partial"
                tx.save()
                distributed += prorated
                count += 1

            return count

        else:
            # ── Pagamento integral do pendente de cada transação ─────────────
            count = 0
            for tx, remaining in txs:
                Receipt.objects.create(
                    transaction=tx,
                    amount_received=remaining,
                    receipt_date=input.receipt_date,
                    destination_account=dest_account,
                    notes=input.notes,
                )
                TransactionModel.objects.create(
                    user=user,
                    description=f"Recebimento: {tx.description}" + (f" ({tx.debtor_name})" if tx.debtor_name else ""),
                    amount=remaining,
                    transaction_type="income",
                    payment_method="pix",
                    date=input.receipt_date,
                    account=dest_account,
                    category=tx.category,
                )
                tx.received_amount += remaining
                tx.receipt_status = "received"
                tx.save()
                count += 1

            return count

    @strawberry.mutation
    def migrate_partial_receivables(self, info: strawberry.types.Info) -> int:
        """Corrige todos os recebíveis com status 'partial': quita o original e cria novo
        recebível com o saldo restante para daqui a 30 dias (a partir de hoje)."""
        from django.utils import timezone

        user = require_auth(info)
        today = timezone.localdate()
        defer_date = today + timedelta(days=30)

        partials = TransactionModel.objects.filter(
            user=user,
            is_receivable=True,
            receipt_status="partial",
        )

        count = 0
        for tx in partials:
            leftover = tx.amount - tx.received_amount
            if leftover <= Decimal("0"):
                # Não tem mais saldo — apenas fecha
                tx.received_amount = tx.amount
                tx.receipt_status = "received"
                tx.save()
                count += 1
                continue

            TransactionModel.objects.create(
                user=user,
                description=tx.description,
                amount=leftover,
                transaction_type=tx.transaction_type,
                payment_method=tx.payment_method,
                date=defer_date,
                competence_date=defer_date,
                account=tx.account,
                category=tx.category,
                is_receivable=True,
                debtor_name=tx.debtor_name,
                receipt_status="pending",
                received_amount=Decimal("0"),
                is_partial_remainder=True,
                notes=tx.notes,
            )

            tx.received_amount = tx.amount
            tx.receipt_status = "received"
            tx.save()
            count += 1

        return count

    @strawberry.mutation
    def delete_receipt(self, info: strawberry.types.Info, id: strawberry.ID) -> bool:
        user = require_auth(info)
        receipt = Receipt.objects.filter(id=id, transaction__user=user).select_related("transaction").first()
        if not receipt:
            raise Exception("Recebimento não encontrado.")

        tx = receipt.transaction
        tx.received_amount -= receipt.amount_received
        if tx.received_amount <= 0:
            tx.received_amount = Decimal("0")
            tx.receipt_status = "pending"
        else:
            tx.receipt_status = "partial"
        tx.save()

        receipt.delete()
        return True
