from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional

import strawberry
from django.db.models import Sum
from django.utils import timezone

from shared.auth import require_auth
from .models import Receipt
from apps.transactions.schema import TransactionType, map_transaction
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


@strawberry.input
class BulkReceiveInput:
    transaction_ids: list[strawberry.ID]
    receipt_date: date
    destination_account_id: strawberry.ID
    notes: Optional[str] = None
    total_amount: Optional[float] = None  # se informado, rateia proporcionalmente


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
        ).exclude(parent_transaction__isnull=True, total_installments__gt=1)

        txs = base_qs.values("debtor_name").annotate(
            total=Sum("amount"),
            received=Sum("received_amount"),
        )

        return [
            ReceivableSummaryType(
                debtor_name=row["debtor_name"] or "Sem nome",
                total_amount=float(row["total"]),
                received_amount=float(row["received"]),
                pending_amount=float(row["total"] - row["received"]),
                transaction_count=base_qs.filter(debtor_name=row["debtor_name"]).count(),
            )
            for row in txs
        ]

    @strawberry.field
    def receivable_transactions(
        self,
        info: strawberry.types.Info,
        debtor_name: Optional[str] = None,
        status: Optional[str] = None,
        period: Optional[str] = None,  # overdue | this_month | next_month | all
    ) -> list[TransactionType]:
        user = require_auth(info)
        today = timezone.localdate()

        qs = TransactionModel.objects.filter(
            user=user,
            is_receivable=True,
            receipt_status__in=["pending", "partial"],
        ).exclude(parent_transaction__isnull=True, total_installments__gt=1).select_related(
            "account", "credit_card", "invoice", "category"
        ).order_by("competence_date", "date")

        if debtor_name:
            qs = qs.filter(debtor_name=debtor_name)
        if status:
            qs = qs.filter(receipt_status=status)

        if period == "overdue":
            qs = qs.filter(competence_date__lt=today)
        elif period == "this_month":
            qs = qs.filter(competence_date__year=today.year, competence_date__month=today.month)
        elif period == "next_month":
            if today.month == 12:
                qs = qs.filter(competence_date__year=today.year + 1, competence_date__month=1)
            else:
                qs = qs.filter(competence_date__year=today.year, competence_date__month=today.month + 1)

        return [map_transaction(t) for t in qs]

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

        TransactionModel.objects.create(
            user=user,
            description=f"Recebimento: {tx.description} ({tx.debtor_name or ''})",
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
            # Pagamento parcial: quita o original e cria novo recebível para daqui a 30 dias
            defer_date = input.receipt_date + timedelta(days=30)
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
                    description=f"Recebimento: {tx.description} ({tx.debtor_name or ''})",
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
                    description=f"Recebimento: {tx.description} ({tx.debtor_name or ''})",
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
