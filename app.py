from __future__ import annotations

import asyncio
from typing import Any

try:
    from flask import Flask, jsonify, render_template, request
except ImportError as exc:  # pragma: no cover - import guard for local setup.
    raise RuntimeError(
        "Flask is not installed. Run `pip install -r requirements.txt`."
    ) from exc

from api.config import get_settings
from api.generate import generate_episodes
from api.serialization import to_jsonable

settings = get_settings()
app = Flask(__name__, template_folder="templates", static_folder="static")


def _run_generate_episodes(count: int, theme: str | None) -> list[dict[str, Any]]:
    episodes = asyncio.run(generate_episodes(count=count, theme=theme))
    return to_jsonable(episodes)


@app.get("/")
def index() -> str:
    return render_template(
        "index.html",
        default_count=settings.default_episode_count,
        max_count=settings.max_episode_count,
    )


@app.get("/health")
def healthcheck() -> tuple[dict[str, str], int]:
    return {"status": "ok"}, 200


@app.post("/api/generate-episodes")
def api_generate() -> tuple[Any, int]:
    payload = request.get_json(silent=True) or {}
    requested_count = payload.get("count", settings.default_episode_count)
    theme = payload.get("theme")

    try:
        count = int(requested_count)
    except (TypeError, ValueError):
        return jsonify({"detail": "`count` must be an integer."}), 422

    if count < 1 or count > settings.max_episode_count:
        return (
            jsonify(
                {
                    "detail": (
                        f"`count` must be between 1 and {settings.max_episode_count}."
                    )
                }
            ),
            422,
        )

    if theme is not None and not isinstance(theme, str):
        return jsonify({"detail": "`theme` must be a string."}), 422

    try:
        episodes = _run_generate_episodes(count=count, theme=theme)
    except RuntimeError as exc:
        return jsonify({"detail": str(exc)}), 500
    except ValueError as exc:
        return jsonify({"detail": str(exc)}), 422

    return jsonify({"count": len(episodes), "episodes": episodes}), 200


if __name__ == "__main__":
    app.run(debug=True)

