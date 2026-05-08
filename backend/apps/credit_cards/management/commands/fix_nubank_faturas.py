"""
Management command: python manage.py fix_nubank_faturas [--apply]

Compara os valores das faturas Nubank com os CSVs exportados e corrige discrepâncias.
Sem --apply: apenas reporta. Com --apply: aplica as correções.
"""
from decimal import Decimal
from django.core.management.base import BaseCommand
from apps.transactions.models import Transaction
from apps.credit_cards.models import Invoice

NUBANK_ID = 5

# ─── Mapa de correções por fatura ───────────────────────────────────────────
# Formato: invoice_id → lista de (texto_na_descricao, valor_errado, valor_correto)
CORRECOES = {
    # Junho (inv 54): parcelas 2/2 com 1-3 cents a mais
    54: [
        ("Dois Amigos", Decimal("85.50"), Decimal("85.49")),   # Parcela 2/2
        ("Dois Amigos", Decimal("39.20"), Decimal("39.19")),   # Parcela 2/2
        ("Serra",       Decimal("145.98"), Decimal("145.95")),  # Parcela 2/5
        ("Shein",       Decimal("31.73"), Decimal("31.72")),    # Parcela 2/6
    ],
    # Julho (inv 55)
    55: [
        ("Serra",  Decimal("145.98"), Decimal("145.95")),
        ("Shein",  Decimal("31.73"),  Decimal("31.72")),
    ],
    # Agosto (inv 56)
    56: [
        ("Serra",  Decimal("145.98"), Decimal("145.95")),
        ("Shein",  Decimal("31.73"),  Decimal("31.72")),
    ],
    # Setembro (inv 57)
    57: [
        ("Serra",  Decimal("145.98"), Decimal("145.95")),
        ("Shein",  Decimal("31.73"),  Decimal("31.72")),
    ],
    # Outubro (inv 58): F.D. Serra termina (5/5 = 145.95), Shein continua
    58: [
        ("Serra",  Decimal("145.98"), Decimal("145.95")),
        ("Shein",  Decimal("31.73"),  Decimal("31.72")),
    ],
    # Novembro (inv 59): Shein última (6/6 = 31.72)
    59: [
        ("Shein",  Decimal("31.73"),  Decimal("31.72")),
    ],
}

# Estorno do TikTok que deve estar na fatura junho
ESTORNO_TIKTOK = {
    "invoice_id": 54,
    "amount": Decimal("-62.19"),
    "description_contains": "TikTok",
}


class Command(BaseCommand):
    help = "Corrige valores de parcelas Nubank com base nos CSVs exportados"

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Aplica as correções")

    def handle(self, *args, **options):
        apply = options["apply"]
        total_erros = 0
        total_corrigidos = 0

        self.stdout.write("\n===== RELATÓRIO DE FATURAS NUBANK =====\n")

        for inv_id, correcoes in CORRECOES.items():
            inv = Invoice.objects.filter(id=inv_id).first()
            if not inv:
                self.stdout.write(f"  [SKIP] Fatura {inv_id} não encontrada")
                continue

            self.stdout.write(f"\nFatura {inv_id} (venc {inv.due_date}):")

            for texto, valor_errado, valor_correto in correcoes:
                txs = Transaction.objects.filter(
                    invoice_id=inv_id,
                    amount=valor_errado,
                    description__icontains=texto,
                )
                for tx in txs:
                    total_erros += 1
                    self.stdout.write(
                        f"  [ERRO] id={tx.id} '{tx.description[:45]}' "
                        f"R${valor_errado} → deveria ser R${valor_correto}"
                    )
                    if apply:
                        tx.amount = valor_correto
                        tx.save()
                        total_corrigidos += 1
                        self.stdout.write(f"         [CORRIGIDO]")

                if not txs.exists():
                    # Verifica se já está correto
                    ok = Transaction.objects.filter(
                        invoice_id=inv_id,
                        amount=valor_correto,
                        description__icontains=texto,
                    ).exists()
                    if ok:
                        self.stdout.write(
                            f"  [OK]   '{texto}' já está R${valor_correto}"
                        )
                    # Se não encontrou nem o errado nem o correto, é outra coisa
                    else:
                        self.stdout.write(
                            f"  [INFO] '{texto}' não encontrado com R${valor_errado} "
                            f"nem R${valor_correto} — verificar manualmente"
                        )

        # Verifica estorno TikTok
        self.stdout.write(f"\nFatura {ESTORNO_TIKTOK['invoice_id']} — Estorno TikTok:")
        estorno = Transaction.objects.filter(
            invoice_id=ESTORNO_TIKTOK["invoice_id"],
            amount=ESTORNO_TIKTOK["amount"],
        ).first()

        if estorno:
            self.stdout.write(
                f"  [OK]   Estorno já existe: id={estorno.id} '{estorno.description}'"
            )
        else:
            self.stdout.write("  [FALTA] Estorno TikTok -62.19 não encontrado na fatura junho")
            total_erros += 1
            if apply:
                # Busca usuário e categoria de referência
                ref_tx = Transaction.objects.filter(
                    invoice__credit_card_id=NUBANK_ID
                ).first()
                if ref_tx:
                    tiktok_tx = Transaction.objects.filter(
                        invoice_id=13, amount=Decimal("62.19")
                    ).first()
                    tx = Transaction.objects.create(
                        user=ref_tx.user,
                        description="Estorno TikTok Shop",
                        amount=Decimal("-62.19"),
                        transaction_type="expense",
                        payment_method="credit",
                        date="2026-05-06",
                        invoice_id=ESTORNO_TIKTOK["invoice_id"],
                        credit_card_id=NUBANK_ID,
                        category=tiktok_tx.category if tiktok_tx else None,
                        notes="Estorno de compra (Dl*Tiktok Shop V) — CSV Nubank jun/26",
                    )
                    total_corrigidos += 1
                    self.stdout.write(f"  [CRIADO] Estorno id={tx.id}")

        # Totais por fatura após análise
        self.stdout.write("\n\n===== TOTAIS POR FATURA =====")
        from django.db.models import Sum
        for inv_id in [13, 54, 55, 56, 57, 58, 59, 60, 61, 62]:
            inv = Invoice.objects.filter(id=inv_id).first()
            if not inv:
                continue
            total = Transaction.objects.filter(invoice_id=inv_id).aggregate(
                t=Sum("amount")
            )["t"] or Decimal(0)
            self.stdout.write(f"  Inv {inv_id} venc={inv.due_date}: R${total:.2f}")

        self.stdout.write(f"\nTotal de erros encontrados: {total_erros}")
        if apply:
            self.stdout.write(f"Total corrigidos: {total_corrigidos}")
        else:
            self.stdout.write("Execute com --apply para corrigir.")
