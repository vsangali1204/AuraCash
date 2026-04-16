import calendar
from datetime import date

from django.db import models

from apps.users.models import User
from apps.accounts.models import Account
from apps.categories.models import Category


class Recurrence(models.Model):
    class RecurrenceType(models.TextChoices):
        INCOME = "income", "Receita"
        EXPENSE = "expense", "Despesa"

    class PaymentMethod(models.TextChoices):
        DEBIT = "debit", "Débito"
        PIX = "pix", "PIX"
        CASH = "cash", "Dinheiro"
        TRANSFER = "transfer", "Transferência"
        CREDIT = "credit", "Crédito"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="recurrences")
    description = models.CharField(max_length=500)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    recurrence_type = models.CharField(max_length=10, choices=RecurrenceType.choices)
    payment_method = models.CharField(max_length=15, choices=PaymentMethod.choices)
    account = models.ForeignKey(
        Account,
        on_delete=models.CASCADE,
        related_name="recurrences",
    )
    credit_card = models.ForeignKey(
        "credit_cards.CreditCard",
        on_delete=models.SET_NULL,
        related_name="recurrences",
        null=True,
        blank=True,
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        related_name="recurrences",
        null=True,
        blank=True,
    )
    day_of_month = models.IntegerField(help_text="Dia do mês (1-31) ou N-ésimo dia útil")
    use_business_day = models.BooleanField(
        default=False,
        help_text="Se True, usa o N-ésimo dia útil do mês",
    )
    is_active = models.BooleanField(default=True)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)

    class Meta:
        verbose_name = "Recorrência"
        verbose_name_plural = "Recorrências"
        ordering = ["description"]

    def __str__(self):
        return f"{self.description} (dia {self.day_of_month})"

    def get_execution_date(self, year: int, month: int) -> date | None:
        """Retorna a data de execução para o mês/ano informado."""
        if not self.use_business_day:
            max_day = calendar.monthrange(year, month)[1]
            return date(year, month, min(self.day_of_month, max_day))
        # N-ésimo dia útil (desconsiderando fins de semana)
        n = self.day_of_month
        count = 0
        for d in range(1, calendar.monthrange(year, month)[1] + 1):
            dt = date(year, month, d)
            if dt.weekday() < 5:  # segunda a sexta
                count += 1
                if count == n:
                    return dt
        # Se N > dias úteis do mês, retorna o último dia útil
        for d in range(calendar.monthrange(year, month)[1], 0, -1):
            dt = date(year, month, d)
            if dt.weekday() < 5:
                return dt
        return None
