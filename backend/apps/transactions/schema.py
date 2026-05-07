import logging
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

# Alias para evitar shadowing em @strawberry.input onde o campo se chama 'date'
Date = date

import strawberry
from django.db.models import Case, Count, DecimalField, F, Sum, Value, When
from django.db.models.functions import Coalesce, ExtractMonth, ExtractYear

from shared.auth import require_auth
from apps.accounts.schema import AccountType, map_account
from apps.categories.schema import CategoryType, map_category
from .models import Transaction

logger = logging.getLogger(__name__)

VALID_TRANSACTION_TYPES = {"income", "expense", "transfer"}
VALID_PAYMENT_METHODS = {"debit", "pix", "cash", "transfer", "credit"}


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
    is_pending_recurrence: bool
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
        except Exception as e:
            logger.warning("Falha ao carregar credit_card para transaction %s: %s", t.id, e)

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
        except Exception as e:
            logger.warning("Falha ao carregar invoice para transaction %s: %s", t.id, e)

    return TransactionType(
        id=strawberry.ID(str(t.id)),
        description=t.description,
        amount=round(float(t.amount), 2),
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
        received_amount=round(float(t.received_amount), 2),
        remaining_amount=round(float(t.remaining_amount), 2),
        is_pending_recurrence=t.is_pending_recurrence,
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
    month_receivable: float        # a receber com previsão para este mês
    future_income_amount: float    # receitas ainda a entrar este mês (date > hoje)
    pending_invoices_amount: float # faturas com vencimento este mês, ainda não pagas
    future_expenses_amount: float  # despesas não-cartão futuras este mês (date > hoje)
    projected_balance: float       # total_balance + future_income + receivable - invoices - future_expenses
    pending_recurrences_count: int
    expense_by_category: list[CategoryExpense]
    income_by_category: list[CategoryExpense]
    balance_history: list[MonthBalance]


@strawberry.type
class CalendarEvent:
    date: date
    event_type: str  # transaction, invoice_due, recurrence, receivable
    title: str
    amount: Optional[float]
    color: str


@strawberry.type
class InstallmentMonthSummary:
    month: str
    total: float
    count: int


@strawberry.type
class PaymentMethodSummary:
    payment_method: str
    total: float
    count: int
    percentage: float


@strawberry.type
class InvoiceMonthSummary:
    total: float
    receivable: float
    personal: float


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
    date: Optional[Date] = None
    competence_date: Optional[Date] = None
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
    date_from: Optional[Date] = None
    date_to: Optional[Date] = None
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
        ).select_related("account", "transfer_account", "credit_card", "invoice", "category")
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
    def pending_recurrences(self, info: strawberry.types.Info) -> list[TransactionType]:
        user = require_auth(info)
        qs = Transaction.objects.filter(
            user=user, is_pending_recurrence=True
        ).select_related("account", "transfer_account", "credit_card", "invoice", "category", "recurrence").order_by("date")
        return [map_transaction(t) for t in qs]

    @strawberry.field
    def dashboard_summary(
        self, info: strawberry.types.Info, year: int, month: int
    ) -> DashboardSummary:
        from apps.accounts.models import Account

        user = require_auth(info)

        # ── Saldo total: 2 queries ao invés de 4×N ───────────────────────────
        accounts = list(Account.objects.filter(user=user, is_active=True))
        initial_sum = sum(float(a.initial_balance) for a in accounts)
        account_ids = [a.id for a in accounts]

        movements = (
            Transaction.objects.filter(user=user, account_id__in=account_ids, is_pending_recurrence=False)
            .aggregate(
                total_income=Coalesce(
                    Sum(Case(When(transaction_type="income", then=F("amount")), default=Value(0), output_field=DecimalField())),
                    Value(0), output_field=DecimalField(),
                ),
                total_expense=Coalesce(
                    Sum(Case(When(transaction_type="expense", then=F("amount")), default=Value(0), output_field=DecimalField())),
                    Value(0), output_field=DecimalField(),
                ),
                total_transfer_out=Coalesce(
                    Sum(Case(When(transaction_type="transfer", then=F("amount")), default=Value(0), output_field=DecimalField())),
                    Value(0), output_field=DecimalField(),
                ),
            )
        )
        transfer_in = Transaction.objects.filter(
            user=user, transaction_type="transfer", transfer_account_id__in=account_ids, is_pending_recurrence=False
        ).aggregate(
            total=Coalesce(Sum("amount"), Value(0), output_field=DecimalField())
        )["total"]

        total_balance = (
            initial_sum
            + float(movements["total_income"])
            - float(movements["total_expense"])
            - float(movements["total_transfer_out"])
            + float(transfer_in)
        )

        # ── Mês corrente ─────────────────────────────────────────────────────
        month_agg = Transaction.objects.filter(
            user=user, date__year=year, date__month=month, is_pending_recurrence=False
        ).aggregate(
            month_income=Coalesce(
                Sum(Case(When(transaction_type="income", then=F("amount")), default=Value(0), output_field=DecimalField())),
                Value(0), output_field=DecimalField(),
            ),
            month_expense=Coalesce(
                Sum(Case(When(transaction_type="expense", then=F("amount")), default=Value(0), output_field=DecimalField())),
                Value(0), output_field=DecimalField(),
            ),
        )
        month_income = float(month_agg["month_income"])
        month_expense = float(month_agg["month_expense"])

        # ── Recorrências pendentes de confirmação ─────────────────────────────
        pending_recurrences_count = Transaction.objects.filter(
            user=user, is_pending_recurrence=True
        ).count()

        # ── Total a receber (todos pendentes) ────────────────────────────────
        # exclude: transações-pai de parcelamentos evitam dupla contagem com as parcelas filhas
        receivable_qs = Transaction.objects.filter(
            user=user, is_receivable=True, receipt_status__in=["pending", "partial"], is_pending_recurrence=False
        ).exclude(parent_transaction__isnull=True, total_installments__gt=1)

        receivable_agg = receivable_qs.aggregate(
            total_amount=Coalesce(Sum("amount"), Value(0), output_field=DecimalField()),
            total_received=Coalesce(Sum("received_amount"), Value(0), output_field=DecimalField()),
        )
        total_receivable = float(receivable_agg["total_amount"]) - float(receivable_agg["total_received"])

        # ── A receber com previsão para este mês ─────────────────────────────
        month_recv_agg = receivable_qs.filter(
            competence_date__year=year,
            competence_date__month=month,
        ).aggregate(
            total_amount=Coalesce(Sum("amount"), Value(0), output_field=DecimalField()),
            total_received=Coalesce(Sum("received_amount"), Value(0), output_field=DecimalField()),
        )
        month_receivable = float(month_recv_agg["total_amount"]) - float(month_recv_agg["total_received"])

        # ── Projeção de caixa: receitas/despesas futuras e faturas pendentes ──
        from apps.credit_cards.models import Invoice as InvoiceModel
        from apps.recurrences.models import Recurrence
        today = date.today()

        # Receitas ainda a entrar este mês: transações já lançadas com date > hoje
        future_income_tx = float(Transaction.objects.filter(
            user=user, transaction_type="income",
            date__year=year, date__month=month, date__gt=today,
            is_pending_recurrence=False,
        ).aggregate(total=Coalesce(Sum("amount"), Value(0), output_field=DecimalField()))["total"])

        # + recorrências de receita que ainda não geraram transação neste mês
        rec_income = Decimal("0")
        for rec in Recurrence.objects.filter(user=user, is_active=True, recurrence_type="income"):
            exec_date = rec.get_execution_date(year, month)
            if exec_date and exec_date > today:
                already = Transaction.objects.filter(
                    recurrence=rec, date__year=year, date__month=month
                ).exists()
                if not already:
                    rec_income += rec.amount

        future_income_amount = future_income_tx + float(rec_income)

        # Faturas com vencimento este mês ainda não pagas
        pending_invoices_qs = InvoiceModel.objects.filter(
            credit_card__user=user,
            due_date__year=year,
            due_date__month=month,
        ).exclude(status=InvoiceModel.Status.PAID)

        inv_tx_total = Transaction.objects.filter(
            user=user, invoice__in=pending_invoices_qs,
        ).aggregate(total=Coalesce(Sum("amount"), Value(0), output_field=DecimalField()))["total"]

        inv_paid_total = pending_invoices_qs.aggregate(
            total=Coalesce(Sum("paid_amount"), Value(0), output_field=DecimalField())
        )["total"]

        pending_invoices_amount = max(0.0, float(inv_tx_total) - float(inv_paid_total))

        # Despesas futuras não-cartão: transações já lançadas com date > hoje
        future_expenses_tx = float(Transaction.objects.filter(
            user=user, transaction_type="expense",
            date__year=year, date__month=month, date__gt=today,
            is_pending_recurrence=False,
        ).exclude(payment_method="credit").aggregate(
            total=Coalesce(Sum("amount"), Value(0), output_field=DecimalField())
        )["total"])

        # + recorrências de despesa não-cartão que ainda não geraram transação
        rec_expenses = Decimal("0")
        for rec in Recurrence.objects.filter(
            user=user, is_active=True, recurrence_type="expense"
        ).exclude(payment_method="credit"):
            exec_date = rec.get_execution_date(year, month)
            if exec_date and exec_date > today:
                already = Transaction.objects.filter(
                    recurrence=rec, date__year=year, date__month=month
                ).exists()
                if not already:
                    rec_expenses += rec.amount

        future_expenses_amount = future_expenses_tx + float(rec_expenses)

        # ── Despesas por categoria ────────────────────────────────────────────
        cat_data = (
            Transaction.objects.filter(
                user=user, date__year=year, date__month=month,
                transaction_type="expense", category__isnull=False,
                is_pending_recurrence=False,
            )
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

        # ── Receitas por categoria ────────────────────────────────────────────
        inc_cat_data = (
            Transaction.objects.filter(
                user=user, date__year=year, date__month=month,
                transaction_type="income", category__isnull=False,
                is_pending_recurrence=False,
            )
            .values("category__name", "category__color")
            .annotate(total=Sum("amount"))
            .order_by("-total")
        )
        total_inc_cat = sum(float(r["total"]) for r in inc_cat_data) or 1
        income_by_category = [
            CategoryExpense(
                category_name=r["category__name"],
                category_color=r["category__color"],
                total=float(r["total"]),
                percentage=round(float(r["total"]) / total_inc_cat * 100, 1),
            )
            for r in inc_cat_data
        ]

        # ── Histórico dos últimos 6 meses: 1 query com GROUP BY ───────────────
        # Determina os 6 meses alvo
        target_months = []
        for i in range(5, -1, -1):
            m = month - i
            y = year
            if m <= 0:
                m += 12
                y -= 1
            target_months.append((y, m))

        first_y, first_m = target_months[0]
        last_y, last_m = target_months[-1]
        first_date = date(first_y, first_m, 1)
        last_date = date(last_y, last_m, 28)  # inclui até final do mês

        raw = (
            Transaction.objects.filter(
                user=user,
                date__gte=first_date,
                date__lte=date(last_y, last_m, 31) if last_m in (1,3,5,7,8,10,12) else date(last_y, last_m, 30),
                transaction_type__in=["income", "expense"],
                is_pending_recurrence=False,
            )
            .annotate(y=ExtractYear("date"), m=ExtractMonth("date"))
            .values("y", "m")
            .annotate(
                income=Coalesce(
                    Sum(Case(When(transaction_type="income", then=F("amount")), default=Value(0), output_field=DecimalField())),
                    Value(0), output_field=DecimalField(),
                ),
                expense=Coalesce(
                    Sum(Case(When(transaction_type="expense", then=F("amount")), default=Value(0), output_field=DecimalField())),
                    Value(0), output_field=DecimalField(),
                ),
            )
        )
        raw_map = {(r["y"], r["m"]): r for r in raw}

        history = []
        for y, m in target_months:
            label = f"{y:04d}-{m:02d}"
            row = raw_map.get((y, m))
            inc = float(row["income"]) if row else 0.0
            exp = float(row["expense"]) if row else 0.0
            history.append(MonthBalance(month=label, income=inc, expense=exp, balance=inc - exp))

        return DashboardSummary(
            total_balance=total_balance,
            month_income=month_income,
            month_expense=month_expense,
            month_net=month_income - month_expense,
            total_receivable=total_receivable,
            month_receivable=month_receivable,
            future_income_amount=future_income_amount,
            pending_invoices_amount=pending_invoices_amount,
            future_expenses_amount=future_expenses_amount,
            projected_balance=total_balance + future_income_amount + month_receivable - pending_invoices_amount - future_expenses_amount,
            pending_recurrences_count=pending_recurrences_count,
            expense_by_category=expense_by_category,
            income_by_category=income_by_category,
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

    @strawberry.field
    def installments_by_month(self, info: strawberry.types.Info) -> list["InstallmentMonthSummary"]:
        user = require_auth(info)
        today = date.today()

        rows = (
            Transaction.objects.filter(
                user=user,
                total_installments__gt=1,
                parent_transaction__isnull=False,
                competence_date__gt=today,
            )
            .values(year=ExtractYear("competence_date"), month_num=ExtractMonth("competence_date"))
            .annotate(total=Sum("amount"), count=Count("id"))
            .order_by("year", "month_num")
        )

        return [
            InstallmentMonthSummary(
                month=f"{row['year']}-{str(row['month_num']).zfill(2)}",
                total=round(float(row["total"]), 2),
                count=row["count"],
            )
            for row in rows
        ]

    @strawberry.field
    def payment_method_summary(
        self, info: strawberry.types.Info, year: int, month: int
    ) -> list["PaymentMethodSummary"]:
        user = require_auth(info)

        rows = (
            Transaction.objects.filter(
                user=user,
                transaction_type="expense",
                date__year=year,
                date__month=month,
                parent_transaction__isnull=True,
            )
            .values("payment_method")
            .annotate(total=Sum("amount"), count=Count("id"))
            .order_by("-total")
        )

        rows_list = list(rows)
        grand_total = sum(float(r["total"]) for r in rows_list) or 1

        return [
            PaymentMethodSummary(
                payment_method=r["payment_method"],
                total=round(float(r["total"]), 2),
                count=r["count"],
                percentage=round(float(r["total"]) / grand_total * 100, 1),
            )
            for r in rows_list
        ]


    @strawberry.field
    def invoice_month_summary(
        self, info: strawberry.types.Info, year: int, month: int
    ) -> "InvoiceMonthSummary":
        from apps.credit_cards.models import Invoice as InvoiceModel
        user = require_auth(info)

        invoice_ids = InvoiceModel.objects.filter(
            credit_card__user=user,
            reference_month__year=year,
            reference_month__month=month,
        ).values_list("id", flat=True)

        txs = Transaction.objects.filter(
            user=user,
            invoice_id__in=invoice_ids,
            parent_transaction__isnull=True,
        )

        total = float(txs.aggregate(s=Coalesce(Sum("amount"), Value(0.0), output_field=DecimalField()))["s"])
        receivable = float(
            txs.filter(is_receivable=True)
            .aggregate(s=Coalesce(Sum("amount"), Value(0.0), output_field=DecimalField()))["s"]
        )
        return InvoiceMonthSummary(total=total, receivable=receivable, personal=total - receivable)


# ── Helpers de propagação para parcelas ───────────────────────────────────────

def _get_base_description(desc: str) -> str:
    import re
    m = re.match(r"^(.*)\s+\(\d+/\d+\)$", desc)
    return m.group(1) if m else desc


def _propagate_installment_fields(t: Transaction, input: "UpdateTransactionInput") -> None:
    """Propaga descrição, categoria, notas e status de recebimento para todas as parcelas da série."""
    is_child = t.parent_transaction_id is not None
    is_parent = (
        t.total_installments is not None
        and t.total_installments > 1
        and t.parent_transaction_id is None
        and t.installment_number is None
    )
    if not is_child and not is_parent:
        return

    updates: dict = {}
    if input.category_id is not None:
        updates["category_id"] = t.category_id
    if input.notes is not None:
        updates["notes"] = t.notes
    if input.is_receivable is not None:
        updates["is_receivable"] = t.is_receivable
        updates["debtor_name"] = t.debtor_name
        if not t.is_receivable:
            updates["receipt_status"] = None
            updates["received_amount"] = Decimal("0")

    base_desc = _get_base_description(t.description) if input.description is not None else None

    if not updates and base_desc is None:
        return

    if is_child:
        parent = t.parent_transaction
        if base_desc is not None:
            parent.description = base_desc
        for field, value in updates.items():
            setattr(parent, field, value)
        parent.save()

        for sibling in Transaction.objects.filter(parent_transaction=parent).exclude(id=t.id):
            if base_desc is not None:
                sibling.description = f"{base_desc} ({sibling.installment_number}/{sibling.total_installments})"
            for field, value in updates.items():
                setattr(sibling, field, value)
            sibling.save()

    elif is_parent:
        for child in Transaction.objects.filter(parent_transaction=t):
            if base_desc is not None:
                child.description = f"{base_desc} ({child.installment_number}/{child.total_installments})"
            for field, value in updates.items():
                setattr(child, field, value)
            child.save()


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

        # ── Validação de input ─────────────────────────────────────────────
        if input.amount <= 0:
            raise ValueError("Valor deve ser positivo.")
        if not (1 <= input.total_installments <= 48):
            raise ValueError("Parcelas devem ser entre 1 e 48.")
        if input.transaction_type not in VALID_TRANSACTION_TYPES:
            raise ValueError(f"Tipo inválido. Use: {', '.join(VALID_TRANSACTION_TYPES)}")
        if input.payment_method not in VALID_PAYMENT_METHODS:
            raise ValueError(f"Meio de pagamento inválido. Use: {', '.join(VALID_PAYMENT_METHODS)}")
        if input.description.strip() == "":
            raise ValueError("Descrição não pode ser vazia.")

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

        # ── Crédito parcelado (apenas despesas podem ser parceladas) ──────────
        if credit_card and input.total_installments > 1:
            total = Decimal(str(input.amount))
            n = input.total_installments
            base_installment = (total / n).quantize(Decimal("0.01"))
            remainder = total - base_installment * n

            first_month = get_first_invoice_month(credit_card, input.date)

            parent = Transaction.objects.create(
                user=user,
                description=input.description,
                amount=total,
                transaction_type=input.transaction_type,
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
                    transaction_type=input.transaction_type,
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

        # ── Crédito à vista (inclui estornos/receitas no cartão) ───────────
        if credit_card:
            first_month = get_first_invoice_month(credit_card, input.date)
            invoice = get_or_create_invoice(credit_card, first_month)
            t = Transaction.objects.create(
                user=user,
                description=input.description,
                amount=Decimal(str(input.amount)),
                transaction_type=input.transaction_type,
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
        from apps.credit_cards.models import get_first_invoice_month, get_or_create_invoice

        user = require_auth(info)
        t = Transaction.objects.filter(id=input.id, user=user).first()
        if not t:
            raise Exception("Lançamento não encontrado.")

        if input.amount is not None and input.amount <= 0:
            raise ValueError("Valor deve ser positivo.")

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
            # Trocou para conta avulsa → remove da fatura do cartão
            if t.credit_card is not None:
                t.invoice = None
                t.credit_card = None
        if input.category_id is not None:
            t.category = Category.objects.filter(id=input.category_id, user=user).first()
        if input.is_receivable is not None:
            t.is_receivable = input.is_receivable
            if not input.is_receivable:
                # Desmarcou "a receber" → limpa todos os campos de recebimento
                t.receipt_status = None
                t.received_amount = Decimal("0")
                t.debtor_name = None
        if input.debtor_name is not None and t.is_receivable:
            t.debtor_name = input.debtor_name
        if input.notes is not None:
            t.notes = input.notes

        # Data mudou e lançamento ainda está num cartão → reatribui à fatura correta
        if input.date is not None and t.credit_card is not None:
            new_month = get_first_invoice_month(t.credit_card, t.date)
            current_month = t.invoice.reference_month if t.invoice else None
            if current_month != new_month:
                t.invoice = get_or_create_invoice(t.credit_card, new_month)

        t.save()
        _propagate_installment_fields(t, input)
        t.refresh_from_db()
        return map_transaction(t)

    @strawberry.mutation
    def delete_transaction(self, info: strawberry.types.Info, id: strawberry.ID) -> bool:
        user = require_auth(info)
        deleted, _ = Transaction.objects.filter(id=id, user=user).delete()
        return deleted > 0

    @strawberry.mutation
    def confirm_pending_recurrence(
        self,
        info: strawberry.types.Info,
        id: strawberry.ID,
        amount: Optional[float] = None,
    ) -> TransactionType:
        user = require_auth(info)
        t = Transaction.objects.filter(id=id, user=user, is_pending_recurrence=True).select_related(
            "account", "transfer_account", "credit_card", "invoice", "category"
        ).first()
        if not t:
            raise Exception("Lançamento pendente não encontrado.")
        if amount is not None:
            if amount <= 0:
                raise ValueError("Valor deve ser positivo.")
            t.amount = Decimal(str(amount))
        t.is_pending_recurrence = False
        t.save()
        t.refresh_from_db()
        return map_transaction(t)

    @strawberry.mutation
    def skip_pending_recurrence(self, info: strawberry.types.Info, id: strawberry.ID) -> bool:
        user = require_auth(info)
        deleted, _ = Transaction.objects.filter(id=id, user=user, is_pending_recurrence=True).delete()
        return deleted > 0
