"""
Tarefa Celery: processa recorrências ativas diariamente.
Executada às 07:00 pelo Celery Beat (quando houver worker/beat rodando).

Obs.: em produção no Fly.io não há worker Celery; o processamento é garantido
pelo RecurrenceAutoProcessMiddleware e pelo comando `process_recurrences`.
"""
from __future__ import annotations

from celery import shared_task
from django.utils import timezone

from apps.recurrences.services import process_due_recurrences


@shared_task(name="apps.recurrences.tasks.process_recurrences")
def process_recurrences():
    created = process_due_recurrences()
    return f"{created} recorrência(s) processada(s) em {timezone.localdate()}"
