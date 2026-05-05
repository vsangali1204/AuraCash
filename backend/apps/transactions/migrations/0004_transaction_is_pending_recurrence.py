from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("transactions", "0003_transaction_competence_date_transaction_credit_card_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="transaction",
            name="is_pending_recurrence",
            field=models.BooleanField(
                default=False,
                help_text="Criado pela task de recorrência, aguarda confirmação do usuário",
            ),
        ),
    ]
