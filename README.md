# AI Shark Tank

<p align="center">
  <img src="static/image.png" alt="AI Shark Tank preview" width="900" />
</p>

`AI Shark Tank` is a cinematic browser-based Shark Tank simulator where the founder, the five sharks, the offers, and the counters are all AI agents. The app is built for screenshots, short videos, and social-ready demos.

## Demo

[Demo](https://x.com/diegocabezas01/status/2036499979934572573?s=20)

## Quick start

```bash
npm install
cp .env.example .env
npm start
```

Open [http://127.0.0.1:5050](http://127.0.0.1:5050).

Edit `.env` before running:

- `OPENAI_API_KEY` enables live agents and voice
- `OPENAI_DEFAULT_MODEL` or `SHARK_TANK_OPENAI_MODEL` optionally overrides the default model
- `SHARK_TANK_REASONING_EFFORT` optionally overrides reasoning effort
- `OPENAI_TTS_MODEL` optionally overrides the text-to-speech model

If `OPENAI_API_KEY` is not set, the app still runs in polished `demo` mode with a full fake episode so the UI can be styled, recorded, and tested locally.

## Project structure

- `server.js`: Express server for the browser UI and `/api/*` endpoints
- `src/lib/sharkTankEngine.js`: OpenAI Agents SDK orchestration and structured outputs
- `src/lib/demoEpisode.js`: no-key fallback episode for demos and screenshot work
- `src/lib/sharkProfiles.js`: shark identities, personas, and UI colors
- `src/lib/allTimeStatsStore.js`: report pricing and all-time stats persistence
- `public/index.html`: TV-style browser UI
- `public/styles.css`: cinematic broadcast styling
- `public/app.js`: client rendering, live playback, audio handling, and report download flow
- `tests/node-server.test.mjs`: Node smoke tests
- `tests/e2e/shark-tank.spec.mjs`: Playwright end-to-end coverage

## Agents SDK approach

The app uses code-level orchestration instead of handoffs because every episode follows a fixed founder -> sharks -> founder counter -> shark resolution sequence.

- Structured outputs use Zod schemas for pitch, offers, counters, and display packaging
- Sharks use SDK tools to make and cancel offers
- The founder uses an SDK tool to counter
- Guardrails validate offer state before an episode is accepted

## Useful commands

```bash
npm start
npm run check
npm run test:node
npm run test:e2e
```
