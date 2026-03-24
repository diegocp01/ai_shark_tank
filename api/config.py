from __future__ import annotations

from dataclasses import dataclass
import os


def _int_env(name: str, default: int) -> int:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default

    try:
        return int(raw_value)
    except ValueError:
        return default


@dataclass(frozen=True, slots=True)
class Settings:
    explicit_openai_model: str | None = None
    default_episode_count: int = 5
    max_episode_count: int = 10


def get_settings() -> Settings:
    max_episode_count = max(1, _int_env("SHARK_TANK_MAX_EPISODE_COUNT", 10))
    default_episode_count = _int_env("SHARK_TANK_DEFAULT_EPISODE_COUNT", 5)

    return Settings(
        explicit_openai_model=os.getenv("SHARK_TANK_OPENAI_MODEL") or None,
        default_episode_count=max(1, min(default_episode_count, max_episode_count)),
        max_episode_count=max_episode_count,
    )

