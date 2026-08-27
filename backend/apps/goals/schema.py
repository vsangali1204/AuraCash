import datetime
from decimal import Decimal
from typing import Optional

import strawberry
from django.utils import timezone

from shared.auth import require_auth

from . import services
from .models import Goal, GoalContribution, GoalPlanSettings


# ─── Types ────────────────────────────────────────────────────────────────────

@strawberry.type
class GoalContributionType:
    id: strawberry.ID
    goal_id: strawberry.ID
    amount: float
    date: datetime.date
    account_id: Optional[strawberry.ID]
    account_name: Optional[str]
    notes: Optional[str]


@strawberry.type
class GoalType:
    id: strawberry.ID
    name: str
    description: str
    target_amount: float
    initial_amount: float
    current_amount: float
    remaining_amount: float
    progress_pct: float
    monthly_contribution: Optional[float]
    priority: int
    target_date: Optional[datetime.date]
    account_id: Optional[strawberry.ID]
    account_name: Optional[str]
    color: str
    icon: str
    status: str
    contributions: list[GoalContributionType]
    # Campos vindos da projeção (só preenchidos em `goalPlan`)
    monthly_allocation: Optional[float] = None
    months_to_complete: Optional[int] = None
    forecast_date: Optional[datetime.date] = None
    required_monthly: Optional[float] = None
    on_track: Optional[bool] = None
    is_reachable: bool = False


@strawberry.type
class IncomeSourceType:
    description: str
    amount: float
    day_of_month: int
    account_name: str


@strawberry.type
class ExpenseItemType:
    description: str
    amount: float
    kind: str


@strawberry.type
class MonthlyCapacityType:
    recurring_income: float
    extra_income_average: float
    total_income: float
    recurring_expenses: float
    card_invoice_average: float
    variable_expense_average: float
    total_expenses: float
    available: float
    months_window: int
    income_sources: list[IncomeSourceType]
    expense_items: list[ExpenseItemType]


@strawberry.type
class GoalPlanType:
    monthly_budget: float
    strategy: str
    months_window: int
    budget_is_custom: bool
    exceeds_capacity: bool
    capacity: MonthlyCapacityType
    goals: list[GoalType]
    total_target: float
    total_saved: float
    total_remaining: float
    committed_monthly: float
    all_goals_forecast_date: Optional[datetime.date]
    months_until_all_goals: Optional[int]


# ─── Mappers ──────────────────────────────────────────────────────────────────

def map_contribution(c: GoalContribution) -> GoalContributionType:
    return GoalContributionType(
        id=strawberry.ID(str(c.id)),
        goal_id=strawberry.ID(str(c.goal_id)),
        amount=float(c.amount),
        date=c.date,
        account_id=strawberry.ID(str(c.account_id)) if c.account_id else None,
        account_name=c.account.name if c.account else None,
        notes=c.notes,
    )


def map_goal(goal: Goal, projection: "services.GoalProjection | None" = None) -> GoalType:
    mapped = GoalType(
        id=strawberry.ID(str(goal.id)),
        name=goal.name,
        description=goal.description,
        target_amount=float(goal.target_amount),
        initial_amount=float(goal.initial_amount),
        current_amount=float(goal.current_amount),
        remaining_amount=float(goal.remaining_amount),
        progress_pct=goal.progress_pct,
        monthly_contribution=float(goal.monthly_contribution) if goal.monthly_contribution is not None else None,
        priority=goal.priority,
        target_date=goal.target_date,
        account_id=strawberry.ID(str(goal.account_id)) if goal.account_id else None,
        account_name=goal.account.name if goal.account else None,
        color=goal.color,
        icon=goal.icon,
        status=goal.status,
        contributions=[map_contribution(c) for c in goal.contributions.all()],
    )
    if projection is not None:
        mapped.monthly_allocation = float(projection.monthly_allocation)
        mapped.months_to_complete = projection.months_to_complete
        mapped.forecast_date = projection.forecast_date
        mapped.required_monthly = (
            float(projection.required_monthly) if projection.required_monthly is not None else None
        )
        mapped.on_track = projection.on_track
        mapped.is_reachable = projection.is_reachable
    return mapped


def map_capacity(cap: services.MonthlyCapacity) -> MonthlyCapacityType:
    return MonthlyCapacityType(
        recurring_income=float(cap.recurring_income),
        extra_income_average=float(cap.extra_income_average),
        total_income=float(cap.total_income),
        recurring_expenses=float(cap.recurring_expenses),
        card_invoice_average=float(cap.card_invoice_average),
        variable_expense_average=float(cap.variable_expense_average),
        total_expenses=float(cap.total_expenses),
        available=float(cap.available),
        months_window=cap.months_window,
        income_sources=[
            IncomeSourceType(
                description=s.description,
                amount=float(s.amount),
                day_of_month=s.day_of_month,
                account_name=s.account_name,
            )
            for s in cap.income_sources
        ],
        expense_items=[
            ExpenseItemType(description=e.description, amount=float(e.amount), kind=e.kind)
            for e in cap.expense_items
        ],
    )


# ─── Inputs ───────────────────────────────────────────────────────────────────

@strawberry.input
class CreateGoalInput:
    name: str
    target_amount: float
    description: str = ""
    initial_amount: float = 0
    monthly_contribution: Optional[float] = None
    priority: Optional[int] = None
    target_date: Optional[datetime.date] = None
    account_id: Optional[strawberry.ID] = None
    color: str = "#6366f1"
    icon: str = "target"


@strawberry.input
class UpdateGoalInput:
    id: strawberry.ID
    name: Optional[str] = None
    description: Optional[str] = None
    target_amount: Optional[float] = None
    initial_amount: Optional[float] = None
    monthly_contribution: Optional[float] = strawberry.UNSET
    priority: Optional[int] = None
    target_date: Optional[datetime.date] = strawberry.UNSET
    account_id: Optional[strawberry.ID] = strawberry.UNSET
    color: Optional[str] = None
    icon: Optional[str] = None
    status: Optional[str] = None


@strawberry.input
class CreateGoalContributionInput:
    goal_id: strawberry.ID
    amount: float
    date: Optional[datetime.date] = None
    account_id: Optional[strawberry.ID] = None
    notes: Optional[str] = None


@strawberry.input
class UpdateGoalPlanSettingsInput:
    monthly_budget: Optional[float] = strawberry.UNSET
    strategy: Optional[str] = None
    months_window: Optional[int] = None


# ─── Query ────────────────────────────────────────────────────────────────────

@strawberry.type
class GoalQuery:
    @strawberry.field
    def goals(self, info: strawberry.types.Info, status: Optional[str] = None) -> list[GoalType]:
        user = require_auth(info)
        qs = Goal.objects.filter(user=user).select_related("account").prefetch_related("contributions")
        if status:
            qs = qs.filter(status=status)
        return [map_goal(g) for g in qs]

    @strawberry.field
    def goal_plan(
        self,
        info: strawberry.types.Info,
        monthly_budget: Optional[float] = None,
        strategy: Optional[str] = None,
        months_window: Optional[int] = None,
    ) -> GoalPlanType:
        """Plano de metas: capacidade mensal + projeção de prazo de cada meta.

        Os argumentos permitem simular outro orçamento/estratégia sem gravar nada.
        """
        user = require_auth(info)
        plan = services.build_plan(
            user,
            monthly_budget_override=Decimal(str(monthly_budget)) if monthly_budget is not None else None,
            strategy_override=strategy,
            months_window_override=months_window,
        )

        capacity = plan["capacity"]
        goals = plan["goals"]
        projections = plan["projections"]
        settings_obj = plan["settings"]

        mapped_goals = [map_goal(g, p) for g, p in zip(goals, projections)]

        total_target = sum((g.target_amount for g in goals), Decimal("0"))
        total_saved = sum((g.current_amount for g in goals), Decimal("0"))
        total_remaining = sum((g.remaining_amount for g in goals), Decimal("0"))
        committed_monthly = sum(
            (p.monthly_allocation for p in projections), Decimal("0")
        )

        finish_months = [p.months_to_complete for p in projections if p.months_to_complete]
        all_forecast_dates = [p.forecast_date for p in projections if p.forecast_date]
        unreachable = any(p.months_to_complete is None for p in projections)

        return GoalPlanType(
            monthly_budget=float(plan["monthly_budget"]),
            strategy=plan["strategy"],
            months_window=capacity.months_window,
            budget_is_custom=settings_obj.monthly_budget is not None,
            exceeds_capacity=plan["monthly_budget"] > capacity.available,
            capacity=map_capacity(capacity),
            goals=mapped_goals,
            total_target=float(total_target),
            total_saved=float(total_saved),
            total_remaining=float(total_remaining),
            committed_monthly=float(committed_monthly),
            all_goals_forecast_date=None if unreachable or not all_forecast_dates else max(all_forecast_dates),
            months_until_all_goals=None if unreachable or not finish_months else max(finish_months),
        )


# ─── Mutation ─────────────────────────────────────────────────────────────────

def _get_goal(user, goal_id) -> Goal:
    goal = (
        Goal.objects.filter(id=goal_id, user=user)
        .select_related("account")
        .prefetch_related("contributions")
        .first()
    )
    if not goal:
        raise Exception("Meta não encontrada.")
    return goal


def _resolve_account(user, account_id):
    from apps.accounts.models import Account

    if not account_id:
        return None
    return Account.objects.filter(id=account_id, user=user).first()


def _sync_completion(goal: Goal) -> None:
    """Marca a meta como concluída (ou reabre) conforme o valor acumulado."""
    if goal.status == Goal.Status.ARCHIVED:
        return
    reached = goal.current_amount >= goal.target_amount
    new_status = Goal.Status.COMPLETED if reached else Goal.Status.ACTIVE
    if goal.status != new_status:
        goal.status = new_status
        goal.save(update_fields=["status", "updated_at"])


@strawberry.type
class GoalMutation:
    @strawberry.mutation
    def create_goal(self, info: strawberry.types.Info, input: CreateGoalInput) -> GoalType:
        user = require_auth(info)

        if input.target_amount <= 0:
            raise Exception("O valor da meta precisa ser maior que zero.")

        priority = input.priority
        if priority is None:
            last = Goal.objects.filter(user=user).order_by("-priority").first()
            priority = (last.priority + 1) if last else 0

        goal = Goal.objects.create(
            user=user,
            name=input.name,
            description=input.description,
            target_amount=Decimal(str(input.target_amount)),
            initial_amount=Decimal(str(input.initial_amount)),
            monthly_contribution=(
                Decimal(str(input.monthly_contribution))
                if input.monthly_contribution is not None
                else None
            ),
            priority=priority,
            target_date=input.target_date,
            account=_resolve_account(user, input.account_id),
            color=input.color,
            icon=input.icon,
        )
        _sync_completion(goal)
        return map_goal(goal)

    @strawberry.mutation
    def update_goal(self, info: strawberry.types.Info, input: UpdateGoalInput) -> GoalType:
        user = require_auth(info)
        goal = _get_goal(user, input.id)

        if input.name is not None:
            goal.name = input.name
        if input.description is not None:
            goal.description = input.description
        if input.target_amount is not None:
            if input.target_amount <= 0:
                raise Exception("O valor da meta precisa ser maior que zero.")
            goal.target_amount = Decimal(str(input.target_amount))
        if input.initial_amount is not None:
            goal.initial_amount = Decimal(str(input.initial_amount))
        if input.monthly_contribution is not strawberry.UNSET:
            goal.monthly_contribution = (
                Decimal(str(input.monthly_contribution))
                if input.monthly_contribution is not None
                else None
            )
        if input.priority is not None:
            goal.priority = input.priority
        if input.target_date is not strawberry.UNSET:
            goal.target_date = input.target_date
        if input.account_id is not strawberry.UNSET:
            goal.account = _resolve_account(user, input.account_id)
        if input.color is not None:
            goal.color = input.color
        if input.icon is not None:
            goal.icon = input.icon
        if input.status is not None:
            if input.status not in Goal.Status.values:
                raise Exception("Status inválido.")
            goal.status = input.status

        goal.save()
        _sync_completion(goal)
        return map_goal(goal)

    @strawberry.mutation
    def delete_goal(self, info: strawberry.types.Info, id: strawberry.ID) -> bool:
        user = require_auth(info)
        deleted, _ = Goal.objects.filter(id=id, user=user).delete()
        return deleted > 0

    @strawberry.mutation
    def archive_goal(self, info: strawberry.types.Info, id: strawberry.ID) -> GoalType:
        """Arquiva a meta ou, se já arquivada, devolve para o plano ativo."""
        user = require_auth(info)
        goal = _get_goal(user, id)
        if goal.status == Goal.Status.ARCHIVED:
            goal.status = Goal.Status.ACTIVE
            goal.save(update_fields=["status", "updated_at"])
            _sync_completion(goal)
        else:
            goal.status = Goal.Status.ARCHIVED
            goal.save(update_fields=["status", "updated_at"])
        return map_goal(goal)

    @strawberry.mutation
    def reorder_goals(self, info: strawberry.types.Info, ids: list[strawberry.ID]) -> list[GoalType]:
        """Redefine a prioridade das metas na ordem em que os ids são enviados."""
        user = require_auth(info)
        goals = {str(g.id): g for g in Goal.objects.filter(user=user, id__in=[str(i) for i in ids])}
        for index, goal_id in enumerate(ids):
            goal = goals.get(str(goal_id))
            if goal:
                goal.priority = index
                goal.save(update_fields=["priority", "updated_at"])
        qs = Goal.objects.filter(user=user).select_related("account").prefetch_related("contributions")
        return [map_goal(g) for g in qs]

    @strawberry.mutation
    def create_goal_contribution(
        self, info: strawberry.types.Info, input: CreateGoalContributionInput
    ) -> GoalType:
        user = require_auth(info)
        goal = _get_goal(user, input.goal_id)

        if input.amount == 0:
            raise Exception("Informe um valor de aporte diferente de zero.")

        GoalContribution.objects.create(
            goal=goal,
            amount=Decimal(str(input.amount)),
            date=input.date or timezone.localdate(),
            account=_resolve_account(user, input.account_id),
            notes=input.notes,
        )
        goal.refresh_from_db()
        _sync_completion(goal)
        return map_goal(_get_goal(user, goal.id))

    @strawberry.mutation
    def delete_goal_contribution(self, info: strawberry.types.Info, id: strawberry.ID) -> bool:
        user = require_auth(info)
        deleted, _ = GoalContribution.objects.filter(id=id, goal__user=user).delete()
        return deleted > 0

    @strawberry.mutation
    def update_goal_plan_settings(
        self, info: strawberry.types.Info, input: UpdateGoalPlanSettingsInput
    ) -> GoalPlanType:
        user = require_auth(info)
        settings_obj = services.get_or_create_settings(user)

        if input.monthly_budget is not strawberry.UNSET:
            settings_obj.monthly_budget = (
                Decimal(str(input.monthly_budget)) if input.monthly_budget is not None else None
            )
        if input.strategy is not None:
            if input.strategy not in GoalPlanSettings.Strategy.values:
                raise Exception("Estratégia inválida.")
            settings_obj.strategy = input.strategy
        if input.months_window is not None:
            settings_obj.months_window = max(1, min(input.months_window, 12))
        settings_obj.save()

        return GoalQuery().goal_plan(info)
