from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("transactions", "0004_transaction_is_pending_recurrence"),
    ]

    operations = [
        migrations.AddField(
            model_name="transaction",
            name="is_partial_remainder",
            field=models.BooleanField(
                default=False,
                help_text="Criado automaticamente como saldo de um recebimento parcial",
            ),
        ),
    ]
