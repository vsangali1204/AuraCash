from django.db import models

from apps.users.models import User


class Category(models.Model):
    class CategoryType(models.TextChoices):
        INCOME = "income", "Receita"
        EXPENSE = "expense", "Despesa"
        BOTH = "both", "Ambos"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="categories")
    name = models.CharField(max_length=200)
    category_type = models.CharField(
        max_length=10, choices=CategoryType.choices, default=CategoryType.EXPENSE
    )
    color = models.CharField(max_length=7, default="#6366f1")
    icon = models.CharField(max_length=50, blank=True, null=True)

    class Meta:
        verbose_name = "Categoria"
        verbose_name_plural = "Categorias"
        ordering = ["name"]
        unique_together = [("user", "name")]

    def __str__(self):
        return f"{self.name} ({self.user.email})"
