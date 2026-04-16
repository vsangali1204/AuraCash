from django.db import models

from apps.accounts.models import Account


class Receipt(models.Model):
    """Registra cada recebimento (total ou parcial) de um valor a receber."""

    transaction = models.ForeignKey(
        "transactions.Transaction",
        on_delete=models.CASCADE,
        related_name="receipts",
    )
    amount_received = models.DecimalField(max_digits=12, decimal_places=2)
    receipt_date = models.DateField()
    destination_account = models.ForeignKey(
        Account,
        on_delete=models.CASCADE,
        related_name="receipts",
    )
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Recebimento"
        verbose_name_plural = "Recebimentos"
        ordering = ["-receipt_date"]

    def __str__(self):
        return f"Recebimento R${self.amount_received} - {self.transaction.description}"
