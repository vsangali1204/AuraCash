from django.core.management.base import BaseCommand
from apps.transactions.models import Transaction


class Command(BaseCommand):
    help = "Renomeia todos os devedores pendentes/parciais (exceto Maria Luiza) para Casa"

    def handle(self, *args, **options):
        qs = Transaction.objects.filter(
            is_receivable=True,
            receipt_status__in=["pending", "partial"],
        ).exclude(debtor_name="Maria Luiza")

        nomes_antes = list(qs.values_list("debtor_name", flat=True).distinct())
        total = qs.count()

        updated = qs.update(debtor_name="Casa")

        self.stdout.write(f"Nomes alterados: {nomes_antes}")
        self.stdout.write(self.style.SUCCESS(f"{updated}/{total} lançamento(s) atualizados para 'Casa'."))
