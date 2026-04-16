import strawberry

from apps.users.schema import UserQuery, UserMutation
from apps.accounts.schema import AccountQuery, AccountMutation
from apps.categories.schema import CategoryQuery, CategoryMutation
from apps.transactions.schema import TransactionQuery, TransactionMutation
from apps.credit_cards.schema import CreditCardQuery, CreditCardMutation
from apps.recurrences.schema import RecurrenceQuery, RecurrenceMutation
from apps.receivables.schema import ReceivableQuery, ReceivableMutation


@strawberry.type
class Query(
    UserQuery,
    AccountQuery,
    CategoryQuery,
    TransactionQuery,
    CreditCardQuery,
    RecurrenceQuery,
    ReceivableQuery,
):
    pass


@strawberry.type
class Mutation(
    UserMutation,
    AccountMutation,
    CategoryMutation,
    TransactionMutation,
    CreditCardMutation,
    RecurrenceMutation,
    ReceivableMutation,
):
    pass


schema = strawberry.Schema(query=Query, mutation=Mutation)
