import calendar
from datetime import date
from decimal import Decimal

from django.db import models

from apps.users.models import User
from apps.accounts.models import Account


class CreditCard(models.Model):
    class Brand(models.TextChoices):
        VISA = "visa", "Visa"
        MASTERCARD = "mastercard", "Mastercard"
        ELO = "elo", "Elo"
        AMEX = "amex", "American Express"
        HIPERCARD = "hipercard", "Hipercard"
        OTHER = "other", "Outro"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="credit_cards")
    account = models.ForeignKey(
        Account,
        on_delete=models.SET_NULL,
        related_name="credit_cards",
        null=True,
        blank=True,
        help_text="Conta usada para pagamento da fatura",
    )
    name = models.CharField(max_length=200)
    brand = models.CharField(max_length=15, choices=Brand.choices, default=Brand.VISA)
    total_limit = models.DecimalField(max_digits=12, decimal_places=2)
    closing_day = models.IntegerField(help_text="Dia de fechamento (1-31)")
    due_day = models.IntegerField(help_text="Dia de vencimento (1-31)")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Cartão de Crédito"
        verbose_name_plural = "Cartões de Crédito"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.user.email})"

    @property
    def available_limit(self) -> Decimal:
        """Limite disponível = limite_total - soma das parcelas em faturas não pagas."""
        from apps.transactions.models import Transaction
        from django.db.models import Case, When, F, DecimalField

        used = (
            Transaction.objects.filter(
                credit_card=self,
                invoice__isnull=False,
                invoice__status__in=["open", "closed"],
            ).aggregate(
                total=models.Sum(
                    Case(
                        When(transaction_type="income", then=-F("amount")),
                        default=F("amount"),
                        output_field=DecimalField(max_digits=12, decimal_places=2),
                    )
                )
            )["total"]
            or Decimal("0")
        )
        return self.total_limit - used


class Invoice(models.Model):
    class Status(models.TextChoices):
        OPEN = "open", "Aberta"
        CLOSED = "closed", "Fechada"
        PAID = "paid", "Paga"
        PARTIAL = "partial", "Paga Parcial"

    credit_card = models.ForeignKey(
        CreditCard, on_delete=models.CASCADE, related_name="invoices"
    )
    reference_month = models.DateField(help_text="Primeiro dia do mês de referência")
    closing_date = models.DateField()
    due_date = models.DateField()
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.OPEN
    )
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        verbose_name = "Fatura"
        verbose_name_plural = "Faturas"
        ordering = ["-reference_month"]
        unique_together = [("credit_card", "reference_month")]

    def __str__(self):
        return f"Fatura {self.reference_month.strftime('%m/%Y')} - {self.credit_card.name}"

    @property
    def total_amount(self) -> Decimal:
        from apps.transactions.models import Transaction
        from django.db.models import Case, When, F, DecimalField

        return (
            Transaction.objects.filter(invoice=self).aggregate(
                total=models.Sum(
                    Case(
                        When(transaction_type="income", then=-F("amount")),
                        default=F("amount"),
                        output_field=DecimalField(max_digits=12, decimal_places=2),
                    )
                )
            )["total"]
            or Decimal("0")
        )


def get_first_invoice_month(credit_card: CreditCard, purchase_date: date) -> date:
    """Retorna o primeiro dia do mês da fatura que receberá a compra."""
    closing_day = credit_card.closing_day
    if purchase_date.day < closing_day:
        return purchase_date.replace(day=1)
    # Após o fechamento → próxima fatura
    if purchase_date.month == 12:
        return date(purchase_date.year + 1, 1, 1)
    return date(purchase_date.year, purchase_date.month + 1, 1)


def add_months(d: date, months: int) -> date:
    month = d.month - 1 + months
    year = d.year + month // 12
    month = month % 12 + 1
    return date(year, month, 1)


def get_or_create_invoice(credit_card: CreditCard, reference_month: date) -> Invoice:
    """Obtém ou cria a fatura de um cartão para determinado mês."""
    closing_day = credit_card.closing_day
    due_day = credit_card.due_day

    max_cd = calendar.monthrange(reference_month.year, reference_month.month)[1]
    closing_date = reference_month.replace(day=min(closing_day, max_cd))

    if due_day >= closing_day:
        max_dd = calendar.monthrange(reference_month.year, reference_month.month)[1]
        due_date = reference_month.replace(day=min(due_day, max_dd))
    else:
        next_m = add_months(reference_month, 1)
        max_dd = calendar.monthrange(next_m.year, next_m.month)[1]
        due_date = next_m.replace(day=min(due_day, max_dd))

    invoice, _ = Invoice.objects.get_or_create(
        credit_card=credit_card,
        reference_month=reference_month,
        defaults={
            "closing_date": closing_date,
            "due_date": due_date,
            "status": Invoice.Status.OPEN,
            "paid_amount": Decimal("0"),
        },
    )
    return invoice
