# AI Shark Tank

`AI Shark Tank` is a social-ready Shark Tank remix where the founder, the five sharks, the offers, and the counters are all AI agents. The preferred local demo path is now a Node server with a cinematic HTML UI built for screenshots, short videos, and tweet posts.

## Preferred run path

```bash
npm install
export OPENAI_API_KEY="sk-your-key-here"
export OPENAI_TTS_MODEL="gpt-4o-mini-tts"
npm start
```

Then open [http://127.0.0.1:5050](http://127.0.0.1:5050).

If `OPENAI_API_KEY` is not set, the app still works in polished `demo` mode with a full fake episode so the UI can be styled, recorded, and tested locally.
With an API key configured, the founder and sharks also auto-voice their lines in sequence using OpenAI text-to-speech.

## What is in the Node app

- `server.js`: Express server for the browser UI and `/api/*` endpoints
- `src/lib/sharkTankEngine.js`: OpenAI Agents SDK orchestration and structured outputs
- `src/lib/demoEpisode.js`: no-key fallback episode for demos and screenshot work
- `src/lib/sharkProfiles.js`: shark identities, personas, and UI colors
- `public/index.html`: TV-style browser UI
- `public/styles.css`: cinematic broadcast styling
- `public/app.js`: client rendering, timeline playback, poster mode, and caption copy
- `tests/node-server.test.mjs`: sandbox-safe Node smoke tests

## Agents SDK approach

The Node implementation follows current OpenAI Agents SDK guidance for deterministic orchestration:

- Code-level orchestration is used instead of handoffs because every episode must always run founder -> all 5 sharks -> package-for-display in a fixed order.
- Structured outputs use Zod schemas for the founder pitch, shark opening round, founder counter, shark final resolution, and the social packaging copy.
- Sharks use real SDK tools to `make_offer` and `cancel_offer`.
- The founder uses a real SDK tool to `counter_offer`.
- Tool input guardrails keep the offer/counter mechanics valid.
- Output guardrails verify that structured outputs match live tool state before an episode is accepted.

## Useful commands

```bash
npm run check
npm run test:node
```

## Python path

The original Python/Flask and FastAPI implementation is still in the repo:

- `app.py`
- `main.py`
- `api/`
- `templates/`
- `static/`

That path is still useful if you want the earlier Python backend flow, but the Node server is the main demo path for the new front end.
