// Manual review scripts must also refuse live servers before opening a browser.
export async function assertScriptedServer(baseURL = 'http://127.0.0.1:5056') {
  const config = await (await fetch(`${baseURL}/api/config`)).json();
  if (config.provider?.id !== 'scripted' || config.generation || config.speech?.provider === 'openai') {
    throw new Error('Review requires a scripted mock server. Start with AI_SHARK_TANK_MODE=mock; no paid test requests are allowed.');
  }
}
