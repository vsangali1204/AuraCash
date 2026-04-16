from django.contrib import admin

from .models import Transaction


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = (
        "description", "amount", "transaction_type", "payment_method",
        "date", "account", "category", "user",
    )
    list_filter = ("transaction_type", "payment_method", "date")
    search_fields = ("description", "user__email")
    date_hierarchy = "date"
