from django.contrib import admin

from .models import Receipt


@admin.register(Receipt)
class ReceiptAdmin(admin.ModelAdmin):
    list_display = ("transaction", "amount_received", "receipt_date", "destination_account")
    search_fields = ("transaction__description",)
    date_hierarchy = "receipt_date"
