import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


def _parse_bool(value: str | None, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _parse_csv(value: str | None, default: list[str]) -> list[str]:
    if not value:
        return default
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "Stock Market Simulation Game")
    auto_create_tables: bool = _parse_bool(os.getenv("AUTO_CREATE_TABLES"), False)
    cors_allow_origins: list[str] = None  # type: ignore[assignment]
    cors_allow_credentials: bool = _parse_bool(os.getenv("CORS_ALLOW_CREDENTIALS"), True)

    remote_database_url: str | None = os.getenv("REMOTE_DATABASE_URL")
    database_url: str = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost/stockgame")
    upstash_redis_rest_url: str | None = os.getenv("UPSTASH_REDIS_REST_URL")
    upstash_redis_token: str | None = os.getenv("UPSTASH_REDIS_TOKEN")
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    google_application_credentials: str = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "serviceAccountKey.json")

    def __post_init__(self):
        origins = _parse_csv(
            os.getenv("CORS_ALLOW_ORIGINS"),
            ["http://localhost:5173", "http://127.0.0.1:5173"],
        )
        object.__setattr__(self, "cors_allow_origins", origins)


settings = Settings()
