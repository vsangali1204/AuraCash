import base64
from datetime import datetime
from typing import Optional

import strawberry
from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail

from shared.auth import generate_tokens, decode_token, require_auth
from .models import User


@strawberry.type
class UserType:
    id: strawberry.ID
    email: str
    name: str
    date_joined: datetime


@strawberry.type
class AuthPayload:
    access_token: str
    refresh_token: str
    user: UserType


def map_user(user: User) -> UserType:
    return UserType(
        id=strawberry.ID(str(user.id)),
        email=user.email,
        name=user.name,
        date_joined=user.date_joined,
    )


@strawberry.input
class RegisterInput:
    name: str
    email: str
    password: str


@strawberry.input
class LoginInput:
    email: str
    password: str


@strawberry.type
class UserQuery:
    @strawberry.field
    def me(self, info: strawberry.types.Info) -> UserType:
        user = require_auth(info)
        return map_user(user)


@strawberry.type
class UserMutation:
    @strawberry.mutation
    def register(self, input: RegisterInput) -> AuthPayload:
        if User.objects.filter(email=input.email).exists():
            raise Exception("Este e-mail já está cadastrado.")

        user = User.objects.create_user(
            email=input.email,
            name=input.name,
            password=input.password,
        )
        tokens = generate_tokens(user.id)
        return AuthPayload(
            access_token=tokens["access_token"],
            refresh_token=tokens["refresh_token"],
            user=map_user(user),
        )

    @strawberry.mutation
    def login(self, input: LoginInput) -> AuthPayload:
        user = authenticate(username=input.email, password=input.password)
        if not user:
            raise Exception("Credenciais inválidas.")
        if not user.is_active:
            raise Exception("Conta desativada.")

        tokens = generate_tokens(user.id)
        return AuthPayload(
            access_token=tokens["access_token"],
            refresh_token=tokens["refresh_token"],
            user=map_user(user),
        )

    @strawberry.mutation
    def refresh_token(self, refresh_token: str) -> AuthPayload:
        payload = decode_token(refresh_token)
        if not payload or payload.get("type") != "refresh":
            raise Exception("Refresh token inválido ou expirado.")

        user = User.objects.filter(id=payload["user_id"], is_active=True).first()
        if not user:
            raise Exception("Usuário não encontrado.")

        tokens = generate_tokens(user.id)
        return AuthPayload(
            access_token=tokens["access_token"],
            refresh_token=tokens["refresh_token"],
            user=map_user(user),
        )

    @strawberry.mutation
    def request_password_reset(self, email: str) -> bool:
        user = User.objects.filter(email=email, is_active=True).first()
        if not user:
            # Retorna True mesmo se o e-mail não existir para não revelar cadastros
            return True

        uid = base64.urlsafe_b64encode(str(user.pk).encode()).decode()
        token = default_token_generator.make_token(user)
        reset_link = f"{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}"

        send_mail(
            subject="Redefinição de senha — AuraCash",
            message=(
                f"Olá, {user.name}!\n\n"
                f"Clique no link abaixo para redefinir sua senha (válido por 1 hora):\n\n"
                f"{reset_link}\n\n"
                f"Se você não solicitou isso, ignore este e-mail."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=True,
        )
        return True

    @strawberry.mutation
    def reset_password(self, uid: str, token: str, new_password: str) -> bool:
        try:
            user_pk = base64.urlsafe_b64decode(uid.encode()).decode()
            user = User.objects.get(pk=user_pk, is_active=True)
        except Exception:
            raise Exception("Link inválido ou expirado.")

        if not default_token_generator.check_token(user, token):
            raise Exception("Link inválido ou expirado.")

        user.set_password(new_password)
        user.save()
        return True
