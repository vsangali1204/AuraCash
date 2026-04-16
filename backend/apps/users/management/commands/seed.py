"""
Seed inicial do AuraCash.
Cria: usuário demo, contas, categorias, cartão de crédito,
recorrências, lançamentos dos últimos 3 meses e valores a receber.
"""

from datetime import date, timedelta
from decimal import Decimal
import random

from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = "Popula o banco com dados de demonstração"

    def add_arguments(self, parser):
        parser.add_argument(
            "--email", default="demo@auracash.com", help="E-mail do usuário demo"
        )
        parser.add_argument(
            "--password", default="demo1234", help="Senha do usuário demo"
        )
        parser.add_argument(
            "--flush", action="store_true", help="Remove dados do usuário antes de sedar"
        )

    @transaction.atomic
    def handle(self, *args, **options):
        from apps.users.models import User
        from apps.accounts.models import Account
        from apps.categories.models import Category
        from apps.credit_cards.models import CreditCard, get_or_create_invoice, get_first_invoice_month, add_months
        from apps.transactions.models import Transaction
        from apps.recurrences.models import Recurrence

        email = options["email"]
        password = options["password"]

        # ── Usuário ──────────────────────────────────────────────────────────
        user, created = User.objects.get_or_create(
            email=email,
            defaults={"name": "Demo User", "is_active": True},
        )
        if created:
            user.set_password(password)
            user.save()
            self.stdout.write(self.style.SUCCESS(f"Usuário criado: {email}"))
        else:
            self.stdout.write(f"Usuário já existia: {email}")

        if options["flush"]:
            Transaction.objects.filter(user=user).delete()
            Recurrence.objects.filter(user=user).delete()
            CreditCard.objects.filter(user=user).delete()
            Account.objects.filter(user=user).delete()
            Category.objects.filter(user=user).delete()
            self.stdout.write(self.style.WARNING("Dados removidos."))

        # ── Contas ───────────────────────────────────────────────────────────
        conta_corrente, _ = Account.objects.get_or_create(
            user=user, name="Conta Corrente Nubank",
            defaults=dict(bank="Nubank", account_type="checking",
                          initial_balance=Decimal("2500.00"), color="#8b5cf6"),
        )
        conta_poupanca, _ = Account.objects.get_or_create(
            user=user, name="Poupança Bradesco",
            defaults=dict(bank="Bradesco", account_type="savings",
                          initial_balance=Decimal("8000.00"), color="#10b981"),
        )
        carteira, _ = Account.objects.get_or_create(
            user=user, name="Carteira",
            defaults=dict(bank="", account_type="cash",
                          initial_balance=Decimal("350.00"), color="#f97316"),
        )

        # ── Categorias ───────────────────────────────────────────────────────
        cats = [
            ("Salário",        "income",  "#10b981", "💼"),
            ("Freelance",      "income",  "#06b6d4", "💻"),
            ("Investimentos",  "income",  "#8b5cf6", "📈"),
            ("Alimentação",    "expense", "#ef4444", "🍔"),
            ("Transporte",     "expense", "#f97316", "🚗"),
            ("Moradia",        "expense", "#eab308", "🏠"),
            ("Saúde",          "expense", "#ec4899", "💊"),
            ("Lazer",          "expense", "#6366f1", "🎮"),
            ("Educação",       "expense", "#14b8a6", "📚"),
            ("Vestuário",      "expense", "#a855f7", "👕"),
            ("Assinaturas",    "expense", "#64748b", "📺"),
            ("Transferência",  "both",    "#94a3b8", "↔️"),
        ]
        cat_objs = {}
        for name, ctype, color, icon in cats:
            obj, _ = Category.objects.get_or_create(
                user=user, name=name,
                defaults=dict(category_type=ctype, color=color, icon=icon),
            )
            cat_objs[name] = obj

        # ── Cartão de crédito ────────────────────────────────────────────────
        card, _ = CreditCard.objects.get_or_create(
            user=user, name="Nubank Roxinho",
            defaults=dict(brand="mastercard", total_limit=Decimal("5000.00"),
                          closing_day=20, due_day=27, account=conta_corrente),
        )

        # ── Recorrências ─────────────────────────────────────────────────────
        recs = [
            dict(description="Salário", amount="6500.00", recurrence_type="income",
                 payment_method="pix", account=conta_corrente,
                 category=cat_objs["Salário"], day_of_month=5),
            dict(description="Aluguel", amount="1800.00", recurrence_type="expense",
                 payment_method="pix", account=conta_corrente,
                 category=cat_objs["Moradia"], day_of_month=10),
            dict(description="Netflix", amount="55.90", recurrence_type="expense",
                 payment_method="credit", account=conta_corrente, credit_card=card,
                 category=cat_objs["Assinaturas"], day_of_month=15),
            dict(description="Spotify", amount="21.90", recurrence_type="expense",
                 payment_method="credit", account=conta_corrente, credit_card=card,
                 category=cat_objs["Assinaturas"], day_of_month=15),
            dict(description="Academia", amount="89.90", recurrence_type="expense",
                 payment_method="debit", account=conta_corrente,
                 category=cat_objs["Saúde"], day_of_month=1),
        ]
        today = date.today()
        for r in recs:
            Recurrence.objects.get_or_create(
                user=user, description=r["description"],
                defaults=dict(
                    amount=Decimal(r["amount"]),
                    recurrence_type=r["recurrence_type"],
                    payment_method=r["payment_method"],
                    account=r.get("account"),
                    credit_card=r.get("credit_card"),
                    category=r.get("category"),
                    day_of_month=r["day_of_month"],
                    use_business_day=False,
                    start_date=date(today.year, today.month, 1),
                    is_active=True,
                ),
            )

        # ── Lançamentos (últimos 3 meses) ────────────────────────────────────
        def d(days_ago: int) -> date:
            return today - timedelta(days=days_ago)

        debit_txs = [
            # ── receitas ──
            ("Salário Março",      "6500.00", "income",  "pix",      conta_corrente, None, cat_objs["Salário"],       d(75)),
            ("Salário Abril",      "6500.00", "income",  "pix",      conta_corrente, None, cat_objs["Salário"],       d(45)),
            ("Salário Maio",       "6500.00", "income",  "pix",      conta_corrente, None, cat_objs["Salário"],       d(15)),
            ("Freelance - Site",   "1200.00", "income",  "pix",      conta_corrente, None, cat_objs["Freelance"],     d(60)),
            ("Freelance - App",    "800.00",  "income",  "pix",      conta_corrente, None, cat_objs["Freelance"],     d(20)),
            # ── despesas conta corrente ──
            ("Aluguel Março",      "1800.00", "expense", "pix",      conta_corrente, None, cat_objs["Moradia"],       d(80)),
            ("Aluguel Abril",      "1800.00", "expense", "pix",      conta_corrente, None, cat_objs["Moradia"],       d(50)),
            ("Aluguel Maio",       "1800.00", "expense", "pix",      conta_corrente, None, cat_objs["Moradia"],       d(20)),
            ("Supermercado",       "430.50",  "expense", "debit",    conta_corrente, None, cat_objs["Alimentação"],   d(5)),
            ("Supermercado",       "380.00",  "expense", "debit",    conta_corrente, None, cat_objs["Alimentação"],   d(35)),
            ("Supermercado",       "410.20",  "expense", "debit",    conta_corrente, None, cat_objs["Alimentação"],   d(65)),
            ("Academia",           "89.90",   "expense", "debit",    conta_corrente, None, cat_objs["Saúde"],         d(14)),
            ("Academia",           "89.90",   "expense", "debit",    conta_corrente, None, cat_objs["Saúde"],         d(44)),
            ("Uber",               "32.00",   "expense", "pix",      conta_corrente, None, cat_objs["Transporte"],    d(3)),
            ("Uber",               "28.50",   "expense", "pix",      conta_corrente, None, cat_objs["Transporte"],    d(10)),
            ("Farmácia",           "67.80",   "expense", "debit",    conta_corrente, None, cat_objs["Saúde"],         d(7)),
            ("Curso Online",       "199.00",  "expense", "pix",      conta_corrente, None, cat_objs["Educação"],      d(25)),
            # ── transferência ──
            ("Reserva de emergência", "500.00", "transfer", "transfer", conta_corrente, None, cat_objs["Transferência"], d(30)),
        ]

        for desc, amt, ttype, method, account, card_obj, cat, tx_date in debit_txs:
            if Transaction.objects.filter(user=user, description=desc, date=tx_date).exists():
                continue
            extra = {}
            if ttype == "transfer":
                extra["transfer_account"] = conta_poupanca
            Transaction.objects.create(
                user=user, description=desc,
                amount=Decimal(amt), transaction_type=ttype,
                payment_method=method, date=tx_date,
                account=account, category=cat, **extra,
            )

        # ── Lançamentos no cartão (com parcelas) ─────────────────────────────
        credit_txs = [
            ("TV 55\" Samsung",   "3499.00", 12, d(40),  cat_objs["Lazer"]),
            ("Notebook Dell",     "4200.00", 10, d(55),  cat_objs["Educação"]),
            ("Tênis Nike",        "399.90",  3,  d(10),  cat_objs["Vestuário"]),
            ("Jantar especial",   "180.00",  1,  d(8),   cat_objs["Alimentação"]),
            ("Netflix",           "55.90",   1,  d(15),  cat_objs["Assinaturas"]),
            ("Spotify",           "21.90",   1,  d(15),  cat_objs["Assinaturas"]),
        ]

        for desc, total_amt, installments, purchase_date, cat in credit_txs:
            if Transaction.objects.filter(user=user, description=desc, payment_method="credit").exists():
                continue
            total = Decimal(total_amt)
            installment_value = (total / installments).quantize(Decimal("0.01"))
            remainder = total - installment_value * (installments - 1)

            first_month = get_first_invoice_month(card, purchase_date)
            parent = Transaction.objects.create(
                user=user, description=desc, amount=total,
                transaction_type="expense", payment_method="credit",
                date=purchase_date, credit_card=card, category=cat,
                total_installments=installments, installment_number=0,
            )
            for i in range(installments):
                inv_month = add_months(first_month, i)
                invoice = get_or_create_invoice(card, inv_month)
                amt_i = installment_value if i < installments - 1 else remainder
                Transaction.objects.create(
                    user=user,
                    description=f"{desc} ({i+1}/{installments})" if installments > 1 else desc,
                    amount=amt_i,
                    transaction_type="expense",
                    payment_method="credit",
                    date=purchase_date,
                    credit_card=card,
                    invoice=invoice,
                    category=cat,
                    parent_transaction=parent,
                    installment_number=i + 1,
                    total_installments=installments,
                )

        # ── Valores a receber ────────────────────────────────────────────────
        receivables = [
            ("João Alves",     "450.00",  d(60), "Empréstimo pessoal"),
            ("João Alves",     "450.00",  d(30), "Empréstimo pessoal (2/2)"),
            ("Maria Costa",    "1200.00", d(45), "Freelance - landing page"),
            ("Pedro Rocha",    "300.00",  d(20), "Aluguel de equipamento"),
        ]
        for debtor, amt, tx_date, desc in receivables:
            if Transaction.objects.filter(user=user, description=desc, is_receivable=True, debtor_name=debtor).exists():
                continue
            Transaction.objects.create(
                user=user, description=desc,
                amount=Decimal(amt), transaction_type="income",
                payment_method="pix", date=tx_date,
                account=conta_corrente, category=cat_objs["Freelance"],
                is_receivable=True, debtor_name=debtor,
                receipt_status="pending", received_amount=Decimal("0"),
            )

        # ── Resumo ───────────────────────────────────────────────────────────
        self.stdout.write(self.style.SUCCESS("\nSeed concluido!"))
        self.stdout.write(f"  Email:    {email}")
        self.stdout.write(f"  Senha:    {password}")
        self.stdout.write(f"  Contas:   {Account.objects.filter(user=user).count()}")
        self.stdout.write(f"  Categ.:   {Category.objects.filter(user=user).count()}")
        self.stdout.write(f"  Cartões:  {CreditCard.objects.filter(user=user).count()}")
        self.stdout.write(f"  Lanç.:    {Transaction.objects.filter(user=user).count()}")
        self.stdout.write(f"  Recorr.:  {Recurrence.objects.filter(user=user).count()}")
