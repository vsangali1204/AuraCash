from datetime import datetime
from decimal import Decimal
from typing import Optional

import strawberry
from django.db.models import Case, DecimalField, F, Sum, Value, When
from django.db.models.functions import Coalesce
from django.utils import timezone

from shared.auth import require_auth
from .models import Account


@strawberry.type
class AccountType:
    id: strawberry.ID
    name: str
    bank: str
    account_type: str
    initial_balance: float
    current_balance: float
    color: str
    is_active: bool
    created_at: datetime


def _compute_balance(account: Account) -> float:
    """Calcula saldo para uma única conta (usado na query de detalhe).

    Considera apenas lançamentos com data até hoje: um lançamento com data
    futura ainda não aconteceu de fato, então não deve reduzir o saldo atual
    (ele entra nas projeções futuras do dashboard, não aqui).
    """
    from apps.transactions.models import Transaction

    today = timezone.localdate()
    base = Transaction.objects.filter(account=account, is_pending_recurrence=False, date__lte=today)
    income = base.filter(transaction_type="income").aggregate(total=Sum("amount"))["total"] or Decimal("0")
    expense = base.filter(transaction_type="expense").aggregate(total=Sum("amount"))["total"] or Decimal("0")
    transfer_out = base.filter(transaction_type="transfer").aggregate(total=Sum("amount"))["total"] or Decimal("0")
    transfer_in = (
        Transaction.objects.filter(
            transfer_account=account, transaction_type="transfer", is_pending_recurrence=False, date__lte=today
        )
        .aggregate(total=Sum("amount"))["total"]
        or Decimal("0")
    )
    return float(account.initial_balance + income - expense - transfer_out + transfer_in)


def _build_balance_map(account_ids: list) -> dict:
    """
    Calcula o saldo de todas as contas em bulk (2 queries ao invés de 4×N).
    Retorna um dict {account_id: current_balance}.
    """
    from apps.transactions.models import Transaction

    zero = Value(Decimal("0"), output_field=DecimalField())
    today = timezone.localdate()

    # Movimentos de saída/entrada por conta de origem
    out_rows = (
        Transaction.objects.filter(account_id__in=account_ids, is_pending_recurrence=False, date__lte=today)
        .values("account_id")
        .annotate(
            income=Coalesce(
                Sum(Case(When(transaction_type="income", then=F("amount")), default=Value(0), output_field=DecimalField())),
                zero,
            ),
            expense=Coalesce(
                Sum(Case(When(transaction_type="expense", then=F("amount")), default=Value(0), output_field=DecimalField())),
                zero,
            ),
            transfer_out=Coalesce(
                Sum(Case(When(transaction_type="transfer", then=F("amount")), default=Value(0), output_field=DecimalField())),
                zero,
            ),
        )
    )
    out_map = {r["account_id"]: r for r in out_rows}

    # Transferências recebidas por conta de destino
    in_rows = (
        Transaction.objects.filter(
            transfer_account_id__in=account_ids,
            transaction_type="transfer",
            is_pending_recurrence=False,
            date__lte=today,
        )
        .values("transfer_account_id")
        .annotate(transfer_in=Coalesce(Sum("amount"), zero))
    )
    in_map = {r["transfer_account_id"]: float(r["transfer_in"]) for r in in_rows}

    return {
        aid: (
            float(out_map[aid]["income"]) - float(out_map[aid]["expense"]) - float(out_map[aid]["transfer_out"])
            if aid in out_map else 0.0
        ) + in_map.get(aid, 0.0)
        for aid in account_ids
    }


def map_account(account: Account, movement: float | None = None) -> AccountType:
    if movement is None:
        movement = _compute_balance(account) - float(account.initial_balance)
    return AccountType(
        id=strawberry.ID(str(account.id)),
        name=account.name,
        bank=account.bank,
        account_type=account.account_type,
        initial_balance=float(account.initial_balance),
        current_balance=float(account.initial_balance) + movement,
        color=account.color,
        is_active=account.is_active,
        created_at=account.created_at,
    )


@strawberry.input
class CreateAccountInput:
    name: str
    bank: str = ""
    account_type: str = "checking"
    initial_balance: float = 0.0
    color: str = "#6366f1"


@strawberry.input
class UpdateAccountInput:
    id: strawberry.ID
    name: Optional[str] = None
    bank: Optional[str] = None
    account_type: Optional[str] = None
    initial_balance: Optional[float] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None


@strawberry.type
class AccountQuery:
    @strawberry.field
    def accounts(self, info: strawberry.types.Info) -> list[AccountType]:
        user = require_auth(info)
        accs = list(Account.objects.filter(user=user, is_active=True))
        if not accs:
            return []
        account_ids = [a.id for a in accs]
        balance_movements = _build_balance_map(account_ids)
        return [map_account(a, balance_movements.get(a.id, 0.0)) for a in accs]

    @strawberry.field
    def account(self, info: strawberry.types.Info, id: strawberry.ID) -> AccountType:
        user = require_auth(info)
        account = Account.objects.filter(id=id, user=user).first()
        if not account:
            raise Exception("Conta não encontrada.")
        return map_account(account)


@strawberry.type
class AccountMutation:
    @strawberry.mutation
    def create_account(self, info: strawberry.types.Info, input: CreateAccountInput) -> AccountType:
        user = require_auth(info)
        account = Account.objects.create(
            user=user,
            name=input.name,
            bank=input.bank,
            account_type=input.account_type,
            initial_balance=Decimal(str(input.initial_balance)),
            color=input.color,
        )
        return map_account(account)

    @strawberry.mutation
    def update_account(self, info: strawberry.types.Info, input: UpdateAccountInput) -> AccountType:
        user = require_auth(info)
        account = Account.objects.filter(id=input.id, user=user).first()
        if not account:
            raise Exception("Conta não encontrada.")

        if input.name is not None:
            account.name = input.name
        if input.bank is not None:
            account.bank = input.bank
        if input.account_type is not None:
            account.account_type = input.account_type
        if input.initial_balance is not None:
            account.initial_balance = Decimal(str(input.initial_balance))
        if input.color is not None:
            account.color = input.color
        if input.is_active is not None:
            account.is_active = input.is_active

        account.save()
        return map_account(account)

    @strawberry.mutation
    def delete_account(self, info: strawberry.types.Info, id: strawberry.ID) -> bool:
        user = require_auth(info)
        deleted, _ = Account.objects.filter(id=id, user=user).delete()
        return deleted > 0
