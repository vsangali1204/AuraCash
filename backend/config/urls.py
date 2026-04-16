from django.contrib import admin
from django.urls import path
from django.views.decorators.csrf import csrf_exempt
from strawberry.django.views import GraphQLView

from config.schema import schema
from shared.auth import get_user_from_request


class AuraCashGraphQLView(GraphQLView):
    def get_context(self, request, response=None):
        return {
            "request": request,
            "user": get_user_from_request(request),
        }


urlpatterns = [
    path("admin/", admin.site.urls),
    path("graphql/", csrf_exempt(AuraCashGraphQLView.as_view(schema=schema))),
]
