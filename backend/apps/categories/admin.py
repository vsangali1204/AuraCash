from django.contrib import admin

from .models import Category


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "category_type", "color", "user")
    list_filter = ("category_type",)
    search_fields = ("name", "user__email")
