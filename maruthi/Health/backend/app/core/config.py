"""
HealthContinuum AI — Core Application Configuration
Loads and validates all settings from environment variables.
"""
from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All configurable settings, loaded from .env / environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ─────────────────────────────────────────────────────────
    app_name: str = "HealthContinuum AI"
    app_env: str = "production"
    debug: bool = False

    # ── Database ──────────────────────────────────────────────────────────────
    database_url: str = "sqlite+aiosqlite:///./healthcontinuum.db"

    # ── JWT ───────────────────────────────────────────────────────────────────
    jwt_secret_key: str = ""
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60

    # ── CORS ──────────────────────────────────────────────────────────────────
    allowed_origins: str = ""

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    # ── Doctor Access Codes ───────────────────────────────────────────────────
    access_code_expire_minutes: int = 20

    # ── Storage ───────────────────────────────────────────────────────────────
    storage_backend: str = "local"
    storage_local_path: str = "./uploads"

    # ── Supabase (optional) ───────────────────────────────────────────────────
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        if self.app_env.strip().lower() == "production":
            secret = self.jwt_secret_key.strip()
            if len(secret) < 32 or secret.lower() in {
                "", "change_me", "change_me_jwt_secret", "changeme", "secret"
            }:
                raise ValueError(
                    "Production requires JWT_SECRET_KEY to be a unique random value of at least 32 characters."
                )
            if self.debug:
                raise ValueError("DEBUG must be false in production.")
            origins = self.cors_origins
            if not origins:
                raise ValueError("Production requires ALLOWED_ORIGINS to contain exact trusted HTTPS origins.")
            for origin in origins:
                lower = origin.lower()
                if (
                    "*" in origin
                    or lower == "null"
                    or "localhost" in lower
                    or "127.0.0.1" in lower
                    or not lower.startswith("https://")
                ):
                    raise ValueError(
                        "Production ALLOWED_ORIGINS must contain exact HTTPS origins only; wildcards, null, and localhost are forbidden."
                    )
        return self


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings singleton."""
    return Settings()


settings = get_settings()

