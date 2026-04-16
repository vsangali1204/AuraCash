from django.contrib import admin

from .models import CreditCard, Invoice


@admin.register(CreditCard)
class CreditCardAdmin(admin.ModelAdmin):
    list_display = ("name", "brand", "total_limit", "closing_day", "due_day", "is_active", "user")
    list_filter = ("brand", "is_active")
    search_fields = ("name", "user__email")


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ("credit_card", "reference_month", "closing_date", "due_date", "status", "paid_amount")
    list_filter = ("status",)
    search_fields = ("credit_card__name",)
