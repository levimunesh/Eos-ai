"""Alembic environment. Runs as the schema owner (MIGRATIONS_DATABASE_URL), never as eos_app.

Offline mode (`alembic upgrade head --sql`) emits plain SQL, used to apply migrations
through the Supabase dashboard or MCP when a direct owner connection is not available.
"""

import asyncio

from alembic import context
from sqlalchemy import pool, text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

import app.audit.models  # noqa: F401  (register tables)
import app.catalog.models  # noqa: F401
import app.orgs.models  # noqa: F401
from app.core.config import get_settings
from app.core.db import SCHEMA, Base

config = context.config
target_metadata = Base.metadata


def _configure(**kwargs) -> None:
    context.configure(
        target_metadata=target_metadata,
        version_table_schema=SCHEMA,
        include_schemas=True,
        include_name=lambda name, type_, _: type_ != "schema" or name == SCHEMA,
        **kwargs,
    )


def run_migrations_offline() -> None:
    _configure(url=get_settings().migrations_database_url, literal_binds=True)
    with context.begin_transaction():
        context.execute(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}")
        context.run_migrations()


def _do_run(connection: Connection) -> None:
    connection.execute(text(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}"))
    _configure(connection=connection)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    engine = async_engine_from_config(
        {"sqlalchemy.url": get_settings().migrations_database_url},
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with engine.connect() as connection:
        await connection.run_sync(_do_run)
        await connection.commit()
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
