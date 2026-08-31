from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

jwt_secret_key: SecretStr


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )

    database_url: str
    jwt_secret_key: SecretStr
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60


settings = Settings()  # type: ignore[call-arg] # Loaded from .env file
