"""Cálculo da capacidade mensal de poupança e projeção de prazo das metas.

A ideia central: o usuário não informa o prazo da meta — ele informa quanto,
no máximo, quer destinar por mês. A partir das recorrências (salários de um ou
mais empregos, aluguel, energia, água…), das faturas de cartão e da média de
gastos variáveis, calculamos a sobra mensal e projetamos em que mês cada meta
é concluída.
"""

import calendar
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

from django.db.models import DecimalField, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone

from apps.credit_cards.models import Invoice
from apps.recurrences.models import Recurrence
from apps.transactions.models import Transaction

from .models import Goal, GoalPlanSettings

ZERO = Decimal("0")
MAX_PROJECTION_MONTHS = 600  # 50 anos — além disso a meta é tratada como inalcançável


# ─── Helpers de data ──────────────────────────────────────────────────────────

def add_months(d: date, months: int) -> date:
    total = d.month - 1 + months
    year = d.year + total // 12
    month = total % 12 + 1
    return date(year, month, min(d.day, calendar.monthrange(year, month)[1]))


def end_of_month(year: int, month: int) -> date:
    return date(year, month, calendar.monthrange(year, month)[1])


def closed_months(reference: date, window: int) -> list[tuple[int, int]]:
    """Os `window` meses já fechados antes do mês de `reference` (mais antigo primeiro)."""
    out = []
    for i in range(window, 0, -1):
        d = add_months(reference.replace(day=1), -i)
        out.append((d.year, d.month))
    return out


def months_between(start: date, end: date) -> int:
    """Meses cheios de `start` até `end` (0 se `end` já passou)."""
    return max((end.year - start.year) * 12 + (end.month - start.month), 0)


# ─── Capacidade mensal ────────────────────────────────────────────────────────

@dataclass
class IncomeSource:
    description: str
    amount: Decimal
    day_of_month: int
    account_name: str


@dataclass
class ExpenseItem:
    description: str
    amount: Decimal
    kind: str  # "recurrence" | "card" | "variable"


@dataclass
class MonthlyCapacity:
    recurring_income: Decimal = ZERO
    extra_income_average: Decimal = ZERO
    recurring_expenses: Decimal = ZERO
    card_invoice_average: Decimal = ZERO
    variable_expense_average: Decimal = ZERO
    months_window: int = 3
    income_sources: list[IncomeSource] = field(default_factory=list)
    expense_items: list[ExpenseItem] = field(default_factory=list)

    @property
    def total_income(self) -> Decimal:
        return self.recurring_income + self.extra_income_average

    @property
    def total_expenses(self) -> Decimal:
        return (
            self.recurring_expenses
            + self.card_invoice_average
            + self.variable_expense_average
        )

    @property
    def available(self) -> Decimal:
        return self.total_income - self.total_expenses


def _recurrence_is_live(rec: Recurrence, reference: date) -> bool:
    """A recorrência ainda vale no mês de referência?"""
    if rec.end_date is not None and rec.end_date < reference.replace(day=1):
        return False
    return True


def compute_monthly_capacity(user, months_window: int = 3, reference: date | None = None) -> MonthlyCapacity:
    reference = reference or timezone.localdate()
    months_window = max(1, min(months_window, 12))
    cap = MonthlyCapacity(months_window=months_window)

    # ── Receitas recorrentes: salários (pode ser mais de um emprego) ──────────
    income_recs = Recurrence.objects.filter(
        user=user, is_active=True, recurrence_type="income", is_receivable=False
    ).select_related("account")
    for rec in income_recs:
        if not _recurrence_is_live(rec, reference):
            continue
        cap.recurring_income += rec.amount
        cap.income_sources.append(
            IncomeSource(
                description=rec.description,
                amount=rec.amount,
                day_of_month=rec.day_of_month,
                account_name=rec.account.name,
            )
        )

    # ── Despesas fixas recorrentes fora do cartão (aluguel, energia, água…) ───
    # As recorrências no crédito ficam de fora: elas já entram na média das
    # faturas, somá-las aqui contaria o mesmo gasto duas vezes.
    expense_recs = (
        Recurrence.objects.filter(user=user, is_active=True, recurrence_type="expense")
        .exclude(payment_method="credit")
        .select_related("account")
    )
    for rec in expense_recs:
        if not _recurrence_is_live(rec, reference):
            continue
        cap.recurring_expenses += rec.amount
        cap.expense_items.append(
            ExpenseItem(description=rec.description, amount=rec.amount, kind="recurrence")
        )

    window = closed_months(reference, months_window)

    # ── Média das faturas de cartão pagas/fechadas na janela ──────────────────
    card_total = ZERO
    for card_year, card_month in window:
        invoices = Invoice.objects.filter(
            credit_card__user=user,
            due_date__year=card_year,
            due_date__month=card_month,
        ).select_related("credit_card")
        for invoice in invoices:
            card_total += invoice.total_amount
    cap.card_invoice_average = (card_total / months_window).quantize(Decimal("0.01"))
    if cap.card_invoice_average > 0:
        cap.expense_items.append(
            ExpenseItem(
                description=f"Faturas de cartão (média de {months_window} meses)",
                amount=cap.card_invoice_average,
                kind="card",
            )
        )

    # ── Média de gastos variáveis (fora do cartão e fora das recorrências) ────
    variable_total = ZERO
    extra_income_total = ZERO
    for var_year, var_month in window:
        base = Transaction.objects.filter(
            user=user,
            date__year=var_year,
            date__month=var_month,
            is_pending_recurrence=False,
            recurrence__isnull=True,
            credit_card__isnull=True,
        )
        variable_total += base.filter(transaction_type="expense").aggregate(
            total=Coalesce(Sum("amount"), Value(0), output_field=DecimalField())
        )["total"]
        extra_income_total += base.filter(
            transaction_type="income", is_receivable=False
        ).aggregate(
            total=Coalesce(Sum("amount"), Value(0), output_field=DecimalField())
        )["total"]

    cap.variable_expense_average = (variable_total / months_window).quantize(Decimal("0.01"))
    cap.extra_income_average = (extra_income_total / months_window).quantize(Decimal("0.01"))
    if cap.variable_expense_average > 0:
        cap.expense_items.append(
            ExpenseItem(
                description=f"Gastos variáveis (média de {months_window} meses)",
                amount=cap.variable_expense_average,
                kind="variable",
            )
        )

    return cap


# ─── Projeção das metas ───────────────────────────────────────────────────────

@dataclass
class GoalProjection:
    goal: Goal
    monthly_allocation: Decimal = ZERO
    months_to_complete: int | None = None
    forecast_date: date | None = None
    required_monthly: Decimal | None = None
    on_track: bool | None = None
    is_reachable: bool = False


def _split_proportional(actives: list, remaining: dict, budget: Decimal) -> dict:
    """Rateia `budget` entre as metas ativas, proporcional ao que falta em cada uma.

    Sobras de metas que se completam no meio do mês voltam para o bolo e são
    redistribuídas entre as que continuam abertas.
    """
    allocated = {g.id: ZERO for g in actives}
    pool = list(actives)
    while budget > ZERO and pool:
        total_remaining = sum(remaining[g.id] for g in pool)
        if total_remaining <= ZERO:
            break
        leftover_pool = []
        distributed = ZERO
        for goal in pool:
            share = (budget * remaining[goal.id] / total_remaining).quantize(Decimal("0.01"))
            # O arredondamento do share pode passar do orçamento — o teto do mês
            # é o que resta dele, para o rateio nunca somar mais do que o budget.
            take = min(share, remaining[goal.id], budget - distributed)
            allocated[goal.id] += take
            remaining[goal.id] -= take
            distributed += take
            if remaining[goal.id] > ZERO:
                leftover_pool.append(goal)
        budget -= distributed
        if distributed <= ZERO:
            # Orçamento pequeno demais para render um centavo por meta no rateio:
            # entrega o resto para a primeira meta em vez de travar a simulação.
            first = pool[0]
            take = min(budget, remaining[first.id])
            allocated[first.id] += take
            remaining[first.id] -= take
            break
        pool = leftover_pool
    return allocated


def project_goals(
    goals: list[Goal],
    monthly_budget: Decimal,
    strategy: str,
    reference: date | None = None,
) -> list[GoalProjection]:
    """Simula mês a mês a distribuição do orçamento até cada meta ser concluída.

    O primeiro aporte é considerado no mês seguinte ao de referência — o mês
    corrente costuma já estar comprometido quando o usuário abre a tela.
    """
    reference = reference or timezone.localdate()
    projections = {g.id: GoalProjection(goal=g) for g in goals}

    for goal in goals:
        if goal.target_date:
            months_left = months_between(reference, goal.target_date)
            projections[goal.id].required_monthly = (
                goal.remaining_amount
                if months_left <= 0
                else (goal.remaining_amount / months_left).quantize(Decimal("0.01"))
            )

    pending = [g for g in goals if g.remaining_amount > ZERO]
    for goal in goals:
        if goal.remaining_amount <= ZERO:
            projections[goal.id].months_to_complete = 0
            projections[goal.id].forecast_date = reference
            projections[goal.id].is_reachable = True
            projections[goal.id].on_track = True

    if not pending or monthly_budget <= ZERO:
        return [projections[g.id] for g in goals]

    remaining = {g.id: g.remaining_amount for g in pending}
    month = 0
    while any(v > ZERO for v in remaining.values()) and month < MAX_PROJECTION_MONTHS:
        month += 1
        budget = monthly_budget
        actives = [g for g in pending if remaining[g.id] > ZERO]

        # Aportes fixos definidos na própria meta têm precedência sobre o rateio.
        for goal in actives:
            if goal.monthly_contribution and budget > ZERO:
                take = min(goal.monthly_contribution, remaining[goal.id], budget)
                remaining[goal.id] -= take
                budget -= take
                if month == 1:
                    projections[goal.id].monthly_allocation += take

        still_open = [g for g in actives if remaining[g.id] > ZERO]
        if budget > ZERO and still_open:
            if strategy == GoalPlanSettings.Strategy.PROPORTIONAL:
                allocated = _split_proportional(still_open, remaining, budget)
                if month == 1:
                    for goal_id, amount in allocated.items():
                        projections[goal_id].monthly_allocation += amount
            else:  # sequencial — respeita a ordem de prioridade
                for goal in still_open:
                    if budget <= ZERO:
                        break
                    take = min(budget, remaining[goal.id])
                    remaining[goal.id] -= take
                    budget -= take
                    if month == 1:
                        projections[goal.id].monthly_allocation += take

        for goal in actives:
            if remaining[goal.id] <= ZERO and projections[goal.id].months_to_complete is None:
                projections[goal.id].months_to_complete = month
                forecast_month = add_months(reference.replace(day=1), month)
                projections[goal.id].forecast_date = end_of_month(
                    forecast_month.year, forecast_month.month
                )
                projections[goal.id].is_reachable = True

    for goal in pending:
        proj = projections[goal.id]
        if proj.forecast_date and goal.target_date:
            proj.on_track = proj.forecast_date <= goal.target_date

    return [projections[g.id] for g in goals]


def get_or_create_settings(user) -> GoalPlanSettings:
    settings_obj, _ = GoalPlanSettings.objects.get_or_create(user=user)
    return settings_obj


def build_plan(
    user,
    monthly_budget_override: Decimal | None = None,
    strategy_override: str | None = None,
    months_window_override: int | None = None,
):
    """Monta o plano completo: capacidade, orçamento efetivo e projeções.

    Os `*_override` permitem simular ("e se eu destinar R$ 800?") sem gravar
    nada — a tela usa isso para o slider de valor mensal.
    """
    settings_obj = get_or_create_settings(user)
    months_window = months_window_override or settings_obj.months_window
    strategy = strategy_override or settings_obj.strategy

    capacity = compute_monthly_capacity(user, months_window=months_window)

    if monthly_budget_override is not None:
        monthly_budget = monthly_budget_override
    elif settings_obj.monthly_budget is not None:
        monthly_budget = settings_obj.monthly_budget
    else:
        monthly_budget = max(capacity.available, ZERO)

    monthly_budget = max(monthly_budget, ZERO)

    goals = list(
        Goal.objects.filter(user=user, status=Goal.Status.ACTIVE)
        .select_related("account")
        .prefetch_related("contributions")
    )
    projections = project_goals(goals, monthly_budget, strategy)

    return {
        "settings": settings_obj,
        "capacity": capacity,
        "monthly_budget": monthly_budget,
        "strategy": strategy,
        "goals": goals,
        "projections": projections,
    }
