from datetime import datetime
from typing import Optional

import strawberry
from django.contrib.auth import authenticate

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
