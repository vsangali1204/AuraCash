from django.core.management.base import BaseCommand

from apps.recurrences.services import process_due_recurrences


class Command(BaseCommand):
    help = "Processa recorrências com execução vencida (catch-up do mês corrente)."

    def handle(self, *args, **options):
        created = process_due_recurrences()
        self.stdout.write(self.style.SUCCESS(f"{created} lançamento(s) de recorrência criado(s)."))
