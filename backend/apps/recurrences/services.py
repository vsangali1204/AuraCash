"""
Serviço compartilhado de processamento de recorrências.

Usado pelo middleware de auto-processamento, pela mutation GraphQL,
pela task Celery e pelo comando de management.
"""
from __future__ import annotations

from datetime import date

from django.db import transaction as db_transaction
from django.db.models import Q
from django.utils import timezone


def create_transaction_for_recurrence(rec, exec_date: date):
    """Cria o lançamento (Transaction) correspondente a uma recorrência."""
    from apps.transactions.models import Transaction

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

    return Transaction.objects.create(**kwargs, is_pending_recurrence=not rec.automatic)


def process_due_recurrences(user=None, today: date | None = None) -> int:
    """Gera lançamentos para recorrências com execução vencida no mês corrente.

    Faz catch-up: qualquer recorrência ativa cujo dia de execução deste mês
    já chegou (exec_date <= hoje) e ainda não gerou lançamento no mês é
    processada — mesmo que o dia exato tenha passado sem o processamento
    rodar (máquina fora do ar, app fechado etc.).

    Retorna a quantidade de lançamentos criados.
    """
    from apps.recurrences.models import Recurrence
    from apps.transactions.models import Transaction

    today = today or timezone.localdate()
    first_of_month = today.replace(day=1)
    created = 0

    qs = (
        Recurrence.objects.filter(is_active=True, start_date__lte=today)
        .filter(Q(end_date__isnull=True) | Q(end_date__gte=first_of_month))
        .select_related("account", "credit_card", "category")
    )
    if user is not None:
        qs = qs.filter(user=user)

    for rec in qs:
        exec_date = rec.get_execution_date(today.year, today.month)
        if not exec_date or exec_date > today:
            continue
        if exec_date < rec.start_date:
            continue
        if rec.end_date is not None and exec_date > rec.end_date:
            continue

        # Lock na recorrência serializa workers concorrentes e evita duplicatas
        with db_transaction.atomic():
            Recurrence.objects.select_for_update().get(pk=rec.pk)
            already_done = Transaction.objects.filter(
                recurrence=rec,
                date__year=today.year,
                date__month=today.month,
            ).exists()
            if already_done:
                continue
            create_transaction_for_recurrence(rec, exec_date)
        created += 1

    return created
