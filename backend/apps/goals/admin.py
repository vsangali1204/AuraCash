from django.contrib import admin

from .models import Goal, GoalContribution, GoalPlanSettings


@admin.register(Goal)
class GoalAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "target_amount", "priority", "target_date", "status")
    list_filter = ("status",)
    search_fields = ("name", "user__email")


@admin.register(GoalContribution)
class GoalContributionAdmin(admin.ModelAdmin):
    list_display = ("goal", "amount", "date", "account")
    search_fields = ("goal__name",)
    date_hierarchy = "date"


@admin.register(GoalPlanSettings)
class GoalPlanSettingsAdmin(admin.ModelAdmin):
    list_display = ("user", "monthly_budget", "strategy", "months_window")
