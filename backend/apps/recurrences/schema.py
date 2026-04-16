from datetime import date, datetime
from decimal import Decimal
from typing import Optional

import strawberry

from shared.auth import require_auth
from .models import Recurrence


@strawberry.type
class RecurrenceType:
    id: strawberry.ID
    description: str
    amount: float
    recurrence_type: str
    payment_method: str
    day_of_month: int
    use_business_day: bool
    is_active: bool
    start_date: date
    end_date: Optional[date]
    account_id: strawberry.ID
    account_name: str
    credit_card_id: Optional[strawberry.ID]
    credit_card_name: Optional[str]
    category_id: Optional[strawberry.ID]
    category_name: Optional[str]
    next_execution_date: Optional[date]


def map_recurrence(rec: Recurrence) -> RecurrenceType:
    today = date.today()
    next_exec = rec.get_execution_date(today.year, today.month)
    if next_exec and next_exec < today:
        # Already past this month, compute for next
        nm = today.month + 1 if today.month < 12 else 1
        ny = today.year if today.month < 12 else today.year + 1
        next_exec = rec.get_execution_date(ny, nm)

    return RecurrenceType(
        id=strawberry.ID(str(rec.id)),
        description=rec.description,
        amount=float(rec.amount),
        recurrence_type=rec.recurrence_type,
        payment_method=rec.payment_method,
        day_of_month=rec.day_of_month,
        use_business_day=rec.use_business_day,
        is_active=rec.is_active,
        start_date=rec.start_date,
        end_date=rec.end_date,
        account_id=strawberry.ID(str(rec.account_id)),
        account_name=rec.account.name,
        credit_card_id=strawberry.ID(str(rec.credit_card_id)) if rec.credit_card_id else None,
        credit_card_name=rec.credit_card.name if rec.credit_card else None,
        category_id=strawberry.ID(str(rec.category_id)) if rec.category_id else None,
        category_name=rec.category.name if rec.category else None,
        next_execution_date=next_exec,
    )


@strawberry.input
class CreateRecurrenceInput:
    description: str
    amount: float
    recurrence_type: str
    payment_method: str
    account_id: strawberry.ID
    day_of_month: int
    start_date: date
    credit_card_id: Optional[strawberry.ID] = None
    category_id: Optional[strawberry.ID] = None
    use_business_day: bool = False
    end_date: Optional[date] = None


@strawberry.input
class UpdateRecurrenceInput:
    id: strawberry.ID
    description: Optional[str] = None
    amount: Optional[float] = None
    recurrence_type: Optional[str] = None
    payment_method: Optional[str] = None
    account_id: Optional[strawberry.ID] = None
    day_of_month: Optional[int] = None
    use_business_day: Optional[bool] = None
    is_active: Optional[bool] = None
    end_date: Optional[date] = None
    category_id: Optional[strawberry.ID] = None


@strawberry.type
class RecurrenceQuery:
    @strawberry.field
    def recurrences(
        self,
        info: strawberry.types.Info,
        active_only: bool = False,
    ) -> list[RecurrenceType]:
        user = require_auth(info)
        qs = Recurrence.objects.filter(user=user).select_related(
            "account", "credit_card", "category"
        )
        if active_only:
            qs = qs.filter(is_active=True)
        return [map_recurrence(r) for r in qs]

    @strawberry.field
    def recurrence(self, info: strawberry.types.Info, id: strawberry.ID) -> RecurrenceType:
        user = require_auth(info)
        rec = Recurrence.objects.filter(id=id, user=user).select_related(
            "account", "credit_card", "category"
        ).first()
        if not rec:
            raise Exception("Recorrência não encontrada.")
        return map_recurrence(rec)


@strawberry.type
class RecurrenceMutation:
    @strawberry.mutation
    def create_recurrence(
        self, info: strawberry.types.Info, input: CreateRecurrenceInput
    ) -> RecurrenceType:
        from apps.accounts.models import Account
        from apps.categories.models import Category
        from apps.credit_cards.models import CreditCard

        user = require_auth(info)

        account = Account.objects.filter(id=input.account_id, user=user).first()
        if not account:
            raise Exception("Conta não encontrada.")

        credit_card = None
        if input.credit_card_id:
            credit_card = CreditCard.objects.filter(id=input.credit_card_id, user=user).first()

        category = None
        if input.category_id:
            category = Category.objects.filter(id=input.category_id, user=user).first()

        rec = Recurrence.objects.create(
            user=user,
            description=input.description,
            amount=Decimal(str(input.amount)),
            recurrence_type=input.recurrence_type,
            payment_method=input.payment_method,
            account=account,
            credit_card=credit_card,
            category=category,
            day_of_month=input.day_of_month,
            use_business_day=input.use_business_day,
            start_date=input.start_date,
            end_date=input.end_date,
        )
        return map_recurrence(rec)

    @strawberry.mutation
    def update_recurrence(
        self, info: strawberry.types.Info, input: UpdateRecurrenceInput
    ) -> RecurrenceType:
        from apps.accounts.models import Account
        from apps.categories.models import Category

        user = require_auth(info)
        rec = Recurrence.objects.filter(id=input.id, user=user).select_related(
            "account", "credit_card", "category"
        ).first()
        if not rec:
            raise Exception("Recorrência não encontrada.")

        if input.description is not None:
            rec.description = input.description
        if input.amount is not None:
            rec.amount = Decimal(str(input.amount))
        if input.recurrence_type is not None:
            rec.recurrence_type = input.recurrence_type
        if input.payment_method is not None:
            rec.payment_method = input.payment_method
        if input.account_id is not None:
            acc = Account.objects.filter(id=input.account_id, user=user).first()
            if acc:
                rec.account = acc
        if input.day_of_month is not None:
            rec.day_of_month = input.day_of_month
        if input.use_business_day is not None:
            rec.use_business_day = input.use_business_day
        if input.is_active is not None:
            rec.is_active = input.is_active
        if input.end_date is not None:
            rec.end_date = input.end_date
        if input.category_id is not None:
            rec.category = Category.objects.filter(id=input.category_id, user=user).first()

        rec.save()
        return map_recurrence(rec)

    @strawberry.mutation
    def delete_recurrence(self, info: strawberry.types.Info, id: strawberry.ID) -> bool:
        user = require_auth(info)
        deleted, _ = Recurrence.objects.filter(id=id, user=user).delete()
        return deleted > 0

    @strawberry.mutation
    def toggle_recurrence(self, info: strawberry.types.Info, id: strawberry.ID) -> RecurrenceType:
        user = require_auth(info)
        rec = Recurrence.objects.filter(id=id, user=user).select_related(
            "account", "credit_card", "category"
        ).first()
        if not rec:
            raise Exception("Recorrência não encontrada.")
        rec.is_active = not rec.is_active
        rec.save()
        return map_recurrence(rec)
