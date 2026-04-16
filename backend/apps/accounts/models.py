from django.db import models

from apps.users.models import User


class Account(models.Model):
    class AccountType(models.TextChoices):
        CHECKING = "checking", "Conta Corrente"
        SAVINGS = "savings", "Poupança"
        DIGITAL = "digital", "Carteira Digital"
        CASH = "cash", "Dinheiro"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="accounts")
    name = models.CharField(max_length=200)
    bank = models.CharField(max_length=200, blank=True, default="")
    account_type = models.CharField(
        max_length=20, choices=AccountType.choices, default=AccountType.CHECKING
    )
    initial_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    color = models.CharField(max_length=7, default="#6366f1")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Conta"
        verbose_name_plural = "Contas"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.user.email})"
