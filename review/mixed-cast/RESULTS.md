# Named mixed-provider cast — offline validation

- 99 Node tests passed with external HTTP/fetch blocked by `tests/offline.mjs`.
- 23 distinct browser tests passed: the existing 21-test suite plus two new mixed-provider contract cases. The two Barbara viewer tests also passed again after moving their screenshots into test output.
- Browser tests use a fresh mock server, verify its config before each test, and block external browser requests. Provider adapters receive injected scripted transports; TTS receives local audio fixtures. No OpenAI or Anthropic inference or TTS API calls were made for this change.
- Verified all six on-screen actors route to their configured providers and receive prior dialogue; offers, counter acceptance/revision/withdrawal, founder rejection and no-deal outcomes replay consistently through the board.
- Missing Anthropic configuration fails before any OpenAI episode-generation request. Refusals, incomplete responses, invalid schemas and invented negotiation terms fail without a scripted fallback.
- New browser cases cover a model-shaped counteroffer ending in Kevin O’Leary's deal and a founder declining available offers. All five real names are returned by the mock preview config.
- Local preview at port 5056 was restarted explicitly in mock mode.
- Syntax and whitespace checks passed. Anthropic credentials are not configured; live integration and subjective dialogue quality remain unverified. Previous OpenAI paid-check artifacts are historical; their entry points are disabled.
