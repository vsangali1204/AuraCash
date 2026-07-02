"""
Middleware que processa recorrências vencidas automaticamente.

O deploy no Fly.io roda apenas o gunicorn (sem Celery worker/beat), então o
agendamento diário nunca dispara. Este middleware garante o processamento sem
infraestrutura extra: a cada request verifica, no máximo uma vez a cada
CHECK_INTERVAL por worker, se há recorrências com execução vencida e as
processa (com catch-up do mês corrente — ver services.process_due_recurrences).

O processamento é idempotente e usa lock por recorrência, então rodar em
múltiplos workers é seguro.
"""
from __future__ import annotations

import logging
import threading
import time

logger = logging.getLogger(__name__)

CHECK_INTERVAL_SECONDS = 15 * 60

_lock = threading.Lock()
_last_check: float | None = None


class RecurrenceAutoProcessMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        global _last_check

        should_run = False
        now = time.monotonic()
        if _last_check is None or now - _last_check >= CHECK_INTERVAL_SECONDS:
            with _lock:
                if _last_check is None or now - _last_check >= CHECK_INTERVAL_SECONDS:
                    _last_check = now
                    should_run = True

        if should_run:
            try:
                from apps.recurrences.services import process_due_recurrences
                created = process_due_recurrences()
                if created:
                    logger.info("Auto-processamento criou %d lançamento(s) de recorrência.", created)
            except Exception:
                logger.exception("Falha no auto-processamento de recorrências.")

        return self.get_response(request)
