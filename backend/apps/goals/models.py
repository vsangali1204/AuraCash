from decimal import Decimal

from django.db import models

from apps.users.models import User
from apps.accounts.models import Account


class Goal(models.Model):
    """Meta financeira: um valor-alvo que o usuário quer juntar.

    O prazo não é informado pelo usuário — ele é calculado a partir da sobra
    mensal (receitas recorrentes − despesas fixas − faturas − gastos variáveis)
    e do teto que o usuário decide destinar às metas. `target_date` é apenas o
    desejo do usuário, usado para dizer se a projeção fica dentro do prazo.
    """

    class Status(models.TextChoices):
        ACTIVE = "active", "Ativa"
        COMPLETED = "completed", "Concluída"
        ARCHIVED = "archived", "Arquivada"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="goals")
    name = models.CharField(max_length=200)
    description = models.CharField(max_length=500, blank=True, default="")
    target_amount = models.DecimalField(max_digits=12, decimal_places=2)
    initial_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text="Valor que o usuário já tinha guardado quando criou a meta",
    )
    monthly_contribution = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Aporte mensal fixo desta meta. Se vazio, o rateio automático decide.",
    )
    priority = models.IntegerField(
        default=0,
        help_text="Menor valor = maior prioridade no rateio sequencial",
    )
    target_date = models.DateField(
        null=True,
        blank=True,
        help_text="Prazo desejado (opcional) — usado só para comparar com a projeção",
    )
    account = models.ForeignKey(
        Account,
        on_delete=models.SET_NULL,
        related_name="goals",
        null=True,
        blank=True,
        help_text="Conta onde o dinheiro da meta fica guardado (opcional)",
    )
    color = models.CharField(max_length=7, default="#6366f1")
    icon = models.CharField(max_length=50, blank=True, default="target")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Meta"
        verbose_name_plural = "Metas"
        ordering = ["priority", "created_at"]

    def __str__(self):
        return f"{self.name} — R${self.target_amount}"

    @property
    def contributed_amount(self) -> Decimal:
        total = self.contributions.aggregate(total=models.Sum("amount"))["total"]
        return total or Decimal("0")

    @property
    def current_amount(self) -> Decimal:
        return self.initial_amount + self.contributed_amount

    @property
    def remaining_amount(self) -> Decimal:
        return max(self.target_amount - self.current_amount, Decimal("0"))

    @property
    def progress_pct(self) -> float:
        if self.target_amount <= 0:
            return 100.0
        return min(float(self.current_amount / self.target_amount * 100), 100.0)


class GoalContribution(models.Model):
    """Aporte feito para uma meta."""

    goal = models.ForeignKey(Goal, on_delete=models.CASCADE, related_name="contributions")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    date = models.DateField()
    account = models.ForeignKey(
        Account,
        on_delete=models.SET_NULL,
        related_name="goal_contributions",
        null=True,
        blank=True,
    )
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Aporte"
        verbose_name_plural = "Aportes"
        ordering = ["-date", "-created_at"]

    def __str__(self):
        return f"Aporte R${self.amount} — {self.goal.name}"


class GoalPlanSettings(models.Model):
    """Configuração do plano de metas do usuário (uma por usuário)."""

    class Strategy(models.TextChoices):
        SEQUENTIAL = "sequential", "Sequencial (uma meta por vez)"
        PROPORTIONAL = "proportional", "Proporcional (todas ao mesmo tempo)"

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="goal_plan_settings")
    monthly_budget = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Valor máximo por mês destinado às metas. Vazio = usa a sobra mensal calculada.",
    )
    strategy = models.CharField(
        max_length=15, choices=Strategy.choices, default=Strategy.SEQUENTIAL
    )
    months_window = models.IntegerField(
        default=3,
        help_text="Quantos meses fechados são usados para calcular as médias de gastos",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Plano de metas"
        verbose_name_plural = "Planos de metas"

    def __str__(self):
        return f"Plano de metas de {self.user.email}"
