from typing import Optional

import strawberry

from shared.auth import require_auth
from .models import Category


@strawberry.type
class CategoryType:
    id: strawberry.ID
    name: str
    category_type: str
    color: str
    icon: Optional[str]


def map_category(cat: Category) -> CategoryType:
    return CategoryType(
        id=strawberry.ID(str(cat.id)),
        name=cat.name,
        category_type=cat.category_type,
        color=cat.color,
        icon=cat.icon,
    )


@strawberry.input
class CreateCategoryInput:
    name: str
    category_type: str = "expense"
    color: str = "#6366f1"
    icon: Optional[str] = None


@strawberry.input
class UpdateCategoryInput:
    id: strawberry.ID
    name: Optional[str] = None
    category_type: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None


@strawberry.type
class CategoryQuery:
    @strawberry.field
    def categories(
        self,
        info: strawberry.types.Info,
        category_type: Optional[str] = None,
    ) -> list[CategoryType]:
        user = require_auth(info)
        qs = Category.objects.filter(user=user)
        if category_type:
            qs = qs.filter(category_type__in=[category_type, "both"])
        return [map_category(c) for c in qs]

    @strawberry.field
    def category(self, info: strawberry.types.Info, id: strawberry.ID) -> CategoryType:
        user = require_auth(info)
        cat = Category.objects.filter(id=id, user=user).first()
        if not cat:
            raise Exception("Categoria não encontrada.")
        return map_category(cat)


@strawberry.type
class CategoryMutation:
    @strawberry.mutation
    def create_category(
        self, info: strawberry.types.Info, input: CreateCategoryInput
    ) -> CategoryType:
        user = require_auth(info)
        if Category.objects.filter(user=user, name=input.name).exists():
            raise Exception("Já existe uma categoria com esse nome.")
        cat = Category.objects.create(
            user=user,
            name=input.name,
            category_type=input.category_type,
            color=input.color,
            icon=input.icon,
        )
        return map_category(cat)

    @strawberry.mutation
    def update_category(
        self, info: strawberry.types.Info, input: UpdateCategoryInput
    ) -> CategoryType:
        user = require_auth(info)
        cat = Category.objects.filter(id=input.id, user=user).first()
        if not cat:
            raise Exception("Categoria não encontrada.")

        if input.name is not None:
            cat.name = input.name
        if input.category_type is not None:
            cat.category_type = input.category_type
        if input.color is not None:
            cat.color = input.color
        if input.icon is not None:
            cat.icon = input.icon

        cat.save()
        return map_category(cat)

    @strawberry.mutation
    def delete_category(self, info: strawberry.types.Info, id: strawberry.ID) -> bool:
        user = require_auth(info)
        deleted, _ = Category.objects.filter(id=id, user=user).delete()
        return deleted > 0
