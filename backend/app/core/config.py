from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"

    # Runtime connection: the eos_app role (no table ownership, RLS applies).
    database_url: str = "postgresql+asyncpg://eos_app:eos_app_dev@localhost:5432/eos"
    # Migrations connection: the owner role.
    migrations_database_url: str = "postgresql+asyncpg://postgres@localhost:5432/eos"
    db_schema: str = "eos"

    # Supabase Auth. Asymmetric keys (JWKS) are preferred; the shared secret is a fallback
    # for projects still on the legacy HS256 secret, and for tests.
    supabase_url: str = ""
    supabase_jwt_secret: str = ""
    jwt_audience: str = "authenticated"

    # Run import jobs inside the API process after each request (single-process hosting).
    # Set false when a separate `python worker.py` process is running.
    inline_jobs: bool = True

    # AI assistant (Phase 4). No key = the assistant reports itself as not configured.
    anthropic_api_key: str = ""
    ai_model: str = "claude-sonnet-5-5"
    ai_max_rounds: int = 8
    ai_max_tokens: int = 2000
    # Optional, USD per million tokens. Left empty, cost is recorded as unknown rather
    # than guessed; set them from the current Anthropic pricing page.
    ai_price_input_per_mtok: float | None = None
    ai_price_output_per_mtok: float | None = None

    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])

    @property
    def jwks_url(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"

    @property
    def jwt_issuer(self) -> str | None:
        return f"{self.supabase_url.rstrip('/')}/auth/v1" if self.supabase_url else None


@lru_cache
def get_settings() -> Settings:
    return Settings()
