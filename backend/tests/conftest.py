"""Test setup: a throwaway database migrated with the real migrations, the app connected
as the restricted eos_app role, and HS256 tokens signed with a test secret.

Env:
  TEST_PG_ADMIN_URL  owner connection to the server (default postgres@localhost:5432)
"""

import os
import subprocess
import sys
import time
import uuid
from collections.abc import AsyncIterator
from pathlib import Path

import asyncpg
import jwt
import pytest
from httpx import ASGITransport, AsyncClient

BACKEND = Path(__file__).resolve().parents[1]
ADMIN = os.environ.get("TEST_PG_ADMIN_URL", "postgresql://postgres@localhost:5432")
DB_NAME = os.environ.get("TEST_DB_NAME", "eos_test")
APP_PASSWORD = "eos_app_test"
JWT_SECRET = "test-secret-that-is-long-enough-for-hs256-signing"

_host_part = ADMIN.split("://", 1)[1].split("@", 1)[1]
OWNER_URL = f"{ADMIN}/{DB_NAME}"
APP_URL = f"postgresql://eos_app:{APP_PASSWORD}@{_host_part}/{DB_NAME}"

os.environ["DATABASE_URL"] = APP_URL.replace("postgresql://", "postgresql+asyncpg://")
os.environ["MIGRATIONS_DATABASE_URL"] = OWNER_URL.replace("postgresql://", "postgresql+asyncpg://")
os.environ["SUPABASE_JWT_SECRET"] = JWT_SECRET
os.environ["SUPABASE_URL"] = ""
os.environ["INLINE_JOBS"] = "false"


async def _admin_exec(sql: str) -> None:
    conn = await asyncpg.connect(f"{ADMIN}/postgres")
    try:
        await conn.execute(sql)
    finally:
        await conn.close()


@pytest.fixture(scope="session", autouse=True)
async def database() -> AsyncIterator[None]:
    await _admin_exec(f'DROP DATABASE IF EXISTS "{DB_NAME}" WITH (FORCE)')
    await _admin_exec(f'CREATE DATABASE "{DB_NAME}"')
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=BACKEND,
        env=os.environ.copy(),
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr
    await _admin_exec(f"ALTER ROLE eos_app WITH PASSWORD '{APP_PASSWORD}'")

    from app.core.config import get_settings

    get_settings.cache_clear()
    yield
    from app.core.db import dispose_engine

    await dispose_engine()


@pytest.fixture(scope="session")
async def client(database) -> AsyncIterator[AsyncClient]:
    from app.main import create_app

    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


def make_token(
    user_id: uuid.UUID, email: str, *, exp_in: int = 3600, secret: str = JWT_SECRET, **extra
) -> str:
    now = int(time.time())
    claims = {
        "sub": str(user_id),
        "email": email,
        "aud": "authenticated",
        "role": "authenticated",
        "iat": now,
        "exp": now + exp_in,
        **extra,
    }
    return jwt.encode(claims, secret, algorithm="HS256")


class Actor:
    """A signed-in user. `h()` builds headers, optionally scoped to an org."""

    def __init__(self, email: str):
        self.id = uuid.uuid4()
        self.email = email
        self.token = make_token(self.id, email)

    def h(self, org_id: str | uuid.UUID | None = None) -> dict[str, str]:
        headers = {"Authorization": f"Bearer {self.token}"}
        if org_id:
            headers["X-Org-Id"] = str(org_id)
        return headers


@pytest.fixture(scope="session")
def actor():
    def _make(prefix: str = "user") -> Actor:
        return Actor(f"{prefix}-{uuid.uuid4().hex[:8]}@example.com")

    return _make


ORG_BODY = {"name": "Test Co", "base_currency": "OMR", "timezone": "Asia/Muscat"}


@pytest.fixture(scope="session")
def new_org(client):
    async def _create(owner: Actor, **overrides) -> dict:
        r = await client.post("/api/v1/orgs", json={**ORG_BODY, **overrides}, headers=owner.h())
        assert r.status_code == 201, r.text
        return r.json()

    return _create


@pytest.fixture
async def app_conn(database) -> AsyncIterator[asyncpg.Connection]:
    """A raw connection as eos_app, for testing RLS without the API in front."""
    conn = await asyncpg.connect(APP_URL)
    try:
        yield conn
    finally:
        await conn.close()
