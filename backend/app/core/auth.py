"""Supabase JWT verification.

Supabase projects sign access tokens either with asymmetric keys (ES256/RS256, public keys
at /auth/v1/.well-known/jwks.json) or with a legacy shared HS256 secret. We accept both,
always check expiry, audience and (when known) issuer, and never trust unsigned claims.
"""

import asyncio
from dataclasses import dataclass
from functools import lru_cache
from uuid import UUID

import jwt
from fastapi import Header

from app.core.config import Settings, get_settings
from app.core.errors import Unauthorized

ASYMMETRIC_ALGS = ["ES256", "RS256", "EdDSA"]


@dataclass(frozen=True)
class AuthUser:
    id: UUID
    email: str
    full_name: str | None = None


@lru_cache
def _jwks_client(url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(url, cache_keys=True, lifespan=3600)


def decode_token(token: str, settings: Settings) -> dict:
    try:
        header = jwt.get_unverified_header(token)
    except jwt.PyJWTError as exc:
        raise Unauthorized("Malformed token") from exc

    alg = header.get("alg")
    options = {"require": ["exp", "sub"]}
    common = {
        "audience": settings.jwt_audience,
        "options": options,
        "leeway": 10,
    }
    if settings.jwt_issuer:
        common["issuer"] = settings.jwt_issuer

    try:
        if alg == "HS256":
            if not settings.supabase_jwt_secret:
                raise Unauthorized("HS256 tokens are not accepted by this server")
            return jwt.decode(token, settings.supabase_jwt_secret, algorithms=["HS256"], **common)
        if alg in ASYMMETRIC_ALGS:
            if not settings.supabase_url:
                raise Unauthorized("Asymmetric tokens need SUPABASE_URL configured")
            key = _jwks_client(settings.jwks_url).get_signing_key_from_jwt(token).key
            return jwt.decode(token, key, algorithms=ASYMMETRIC_ALGS, **common)
    except jwt.ExpiredSignatureError as exc:
        raise Unauthorized("Token expired", code="token_expired") from exc
    except jwt.PyJWTError as exc:
        raise Unauthorized("Invalid token") from exc
    raise Unauthorized(f"Unsupported token algorithm: {alg}")


async def get_auth_user(authorization: str | None = Header(default=None)) -> AuthUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise Unauthorized("Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    settings = get_settings()
    # JWKS lookups can hit the network on a cache miss; keep them off the event loop.
    claims = await asyncio.to_thread(decode_token, token, settings)
    if claims.get("role") not in (None, "authenticated"):
        raise Unauthorized("Token role not allowed")
    try:
        user_id = UUID(claims["sub"])
    except (KeyError, ValueError) as exc:
        raise Unauthorized("Token subject is not a user id") from exc
    email = (claims.get("email") or "").strip().lower()
    if not email:
        raise Unauthorized("Token has no email")
    meta = claims.get("user_metadata") or {}
    raw_name = meta.get("full_name") or meta.get("name") if isinstance(meta, dict) else None
    full_name = str(raw_name).strip()[:200] if raw_name else None
    return AuthUser(id=user_id, email=email, full_name=full_name or None)
