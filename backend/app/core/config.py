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
