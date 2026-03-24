from __future__ import annotations

import asyncio
import json

from api.generate import generate_episodes
from api.serialization import to_jsonable


async def main() -> None:
    episodes = await generate_episodes()
    print(json.dumps({"episodes": to_jsonable(episodes)}, indent=2))


if __name__ == "__main__":
    asyncio.run(main())

