from datetime import datetime, timedelta, timezone

import jwt
from django.conf import settings


def generate_tokens(user_id: int) -> dict:
    now = datetime.now(tz=timezone.utc)

    access_payload = {
        "user_id": user_id,
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=settings.JWT_ACCESS_TOKEN_LIFETIME_MINUTES),
    }
    refresh_payload = {
        "user_id": user_id,
        "type": "refresh",
        "iat": now,
        "exp": now + timedelta(days=settings.JWT_REFRESH_TOKEN_LIFETIME_DAYS),
    }

    access_token = jwt.encode(access_payload, settings.JWT_SECRET_KEY, algorithm="HS256")
    refresh_token = jwt.encode(refresh_payload, settings.JWT_SECRET_KEY, algorithm="HS256")

    return {"access_token": access_token, "refresh_token": refresh_token}


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None


def get_user_from_request(request):
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header[7:]
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        return None

    from apps.users.models import User
    return User.objects.filter(id=payload["user_id"], is_active=True).first()


def require_auth(info) -> "User":
    user = info.context.get("user")
    if not user:
        raise Exception("Autenticação necessária.")
    return user
