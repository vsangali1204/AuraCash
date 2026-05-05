from django.db import models

from apps.users.models import User
from apps.accounts.models import Account
from apps.categories.models import Category


class Transaction(models.Model):
    class TransactionType(models.TextChoices):
        INCOME = "income", "Receita"
        EXPENSE = "expense", "Despesa"
        TRANSFER = "transfer", "Transferência"

    class PaymentMethod(models.TextChoices):
        DEBIT = "debit", "Débito"
        PIX = "pix", "PIX"
        CASH = "cash", "Dinheiro"
        TRANSFER = "transfer", "Transferência"
        CREDIT = "credit", "Crédito"

    class ReceiptStatus(models.TextChoices):
        PENDING = "pending", "Pendente"
        PARTIAL = "partial", "Recebido Parcial"
        RECEIVED = "received", "Recebido"

    # ── Core ──────────────────────────────────────────────────────────────────
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="transactions")
    description = models.CharField(max_length=500)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    transaction_type = models.CharField(max_length=15, choices=TransactionType.choices)
    payment_method = models.CharField(max_length=15, choices=PaymentMethod.choices)
    date = models.DateField()
    competence_date = models.DateField(null=True, blank=True)

    # ── Account / Card ────────────────────────────────────────────────────────
    account = models.ForeignKey(
        Account,
        on_delete=models.CASCADE,
        related_name="transactions",
        null=True,
        blank=True,
    )
    transfer_account = models.ForeignKey(
        Account,
        on_delete=models.SET_NULL,
        related_name="incoming_transfers",
        null=True,
        blank=True,
    )
    credit_card = models.ForeignKey(
        "credit_cards.CreditCard",
        on_delete=models.SET_NULL,
        related_name="transactions",
        null=True,
        blank=True,
    )
    invoice = models.ForeignKey(
        "credit_cards.Invoice",
        on_delete=models.SET_NULL,
        related_name="transactions",
        null=True,
        blank=True,
    )

    # ── Installments ──────────────────────────────────────────────────────────
    installment_number = models.IntegerField(null=True, blank=True)
    total_installments = models.IntegerField(null=True, blank=True)
    parent_transaction = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        related_name="installments",
        null=True,
        blank=True,
    )

    # ── Category ──────────────────────────────────────────────────────────────
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        related_name="transactions",
        null=True,
        blank=True,
    )

    # ── Receivable ────────────────────────────────────────────────────────────
    is_receivable = models.BooleanField(default=False)
    debtor_name = models.CharField(max_length=200, blank=True, null=True)
    receipt_status = models.CharField(
        max_length=10,
        choices=ReceiptStatus.choices,
        null=True,
        blank=True,
    )
    received_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # ── Recurrence ────────────────────────────────────────────────────────────
    recurrence = models.ForeignKey(
        "recurrences.Recurrence",
        on_delete=models.SET_NULL,
        related_name="generated_transactions",
        null=True,
        blank=True,
    )
    is_pending_recurrence = models.BooleanField(
        default=False,
        help_text="Criado pela task de recorrência, aguarda confirmação do usuário",
    )

    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Lançamento"
        verbose_name_plural = "Lançamentos"
        ordering = ["-date", "-created_at"]

    def __str__(self):
        return f"{self.description} — R${self.amount}"

    @property
    def remaining_amount(self):
        return self.amount - self.received_amount
