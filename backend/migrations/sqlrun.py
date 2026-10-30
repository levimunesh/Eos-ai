"""Run a multi-statement SQL script from a migration.

asyncpg refuses several statements in one prepared statement, so online migrations send
the script through the driver's simple-query path. Offline (`--sql`) mode just emits it.
"""

from alembic import context, op
from sqlalchemy.util import await_only


def run_script(sql: str) -> None:
    if context.is_offline_mode():
        op.execute(sql)
        return
    raw = op.get_bind().connection.driver_connection
    await_only(raw.execute(sql))
