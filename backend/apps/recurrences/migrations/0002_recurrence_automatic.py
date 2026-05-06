from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('recurrences', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='recurrence',
            name='automatic',
            field=models.BooleanField(
                default=False,
                help_text='Se True, efetiva o lançamento direto no saldo sem pedir confirmação',
            ),
        ),
    ]
