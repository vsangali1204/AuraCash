"""
Tarefa Celery: processa recorrências ativas diariamente.
Executada às 07:00 pelo Celery Beat.
"""
from __future__ import annotations

from decimal import Decimal

from celery import shared_task
from django.utils import timezone


@shared_task(name="apps.recurrences.tasks.process_recurrences")
def process_recurrences():
    from apps.recurrences.models import Recurrence
    from apps.transactions.models import Transaction

    today = timezone.localdate()
    created = 0

    recurrences = Recurrence.objects.filter(
        is_active=True,
        start_date__lte=today,
    ).filter(
        __import__("django.db.models", fromlist=["Q"]).Q(end_date__isnull=True)
        | __import__("django.db.models", fromlist=["Q"]).Q(end_date__gte=today)
    ).select_related("account", "credit_card", "category")

    for rec in recurrences:
        exec_date = rec.get_execution_date(today.year, today.month)
        if exec_date != today:
            continue

        # Evita duplicatas no mesmo mês
        already_done = Transaction.objects.filter(
            recurrence=rec,
            date__year=today.year,
            date__month=today.month,
        ).exists()
        if already_done:
            continue

        kwargs = dict(
            user=rec.user,
            description=rec.description,
            amount=rec.amount,
            transaction_type=rec.recurrence_type,
            payment_method=rec.payment_method,
            date=exec_date,
            account=rec.account if rec.payment_method != "credit" else None,
            category=rec.category,
            recurrence=rec,
        )

        if rec.payment_method == "credit" and rec.credit_card:
            from apps.credit_cards.models import get_first_invoice_month, get_or_create_invoice
            first_month = get_first_invoice_month(rec.credit_card, exec_date)
            invoice = get_or_create_invoice(rec.credit_card, first_month)
            kwargs["credit_card"] = rec.credit_card
            kwargs["invoice"] = invoice
            kwargs["installment_number"] = 1
            kwargs["total_installments"] = 1

        Transaction.objects.create(**kwargs, is_pending_recurrence=not rec.automatic)
        created += 1

    return f"{created} recorrência(s) processada(s) em {today}"
