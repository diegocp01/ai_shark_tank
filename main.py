from __future__ import annotations

from typing import Any

try:
    from fastapi import Body, FastAPI, HTTPException
except ImportError as exc:  # pragma: no cover - import guard for local setup.
    raise RuntimeError(
        "FastAPI is not installed. Run `pip install -r requirements.txt`."
    ) from exc

from api.config import get_settings
from api.generate import generate_episodes
from api.serialization import to_jsonable

settings = get_settings()
app = FastAPI(title="AI Shark Tank API", version="0.1.0")


@app.get("/")
async def root() -> dict[str, str]:
    return {"message": "AI Shark Tank API is ready."}


@app.get("/health")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/generate-episodes")
async def api_generate(
    payload: dict[str, Any] | None = Body(default=None),
) -> dict[str, Any]:
    payload = payload or {}
    requested_count = payload.get("count", settings.default_episode_count)
    theme = payload.get("theme")

    try:
        count = int(requested_count)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail="`count` must be an integer.") from exc

    if count < 1 or count > settings.max_episode_count:
        raise HTTPException(
            status_code=422,
            detail=f"`count` must be between 1 and {settings.max_episode_count}.",
        )

    if theme is not None and not isinstance(theme, str):
        raise HTTPException(status_code=422, detail="`theme` must be a string.")

    try:
        episodes = await generate_episodes(count=count, theme=theme)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {
        "count": len(episodes),
        "episodes": to_jsonable(episodes),
    }

