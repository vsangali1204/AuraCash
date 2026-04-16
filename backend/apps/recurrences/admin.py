from django.contrib import admin

from .models import Recurrence


@admin.register(Recurrence)
class RecurrenceAdmin(admin.ModelAdmin):
    list_display = ("description", "amount", "recurrence_type", "day_of_month", "use_business_day", "is_active", "user")
    list_filter = ("recurrence_type", "is_active", "use_business_day")
    search_fields = ("description", "user__email")
