// Deterministic provider stand-ins only. This file never imports an SDK or fetches.
export function scriptedClients({ decision = 'offer', choice = 'accept', response = 'accept', rejectFinal = false } = {}) {
  const calls = [];
  let choices = 0;
  function client(provider) {
    return { settings: { model: provider === 'openai' ? 'gpt-6.1-sol' : 'claude-sonnet-5-5' },
      async json(request) {
        const { name, input } = request;
        calls.push({ provider, ...structuredClone(request) });
        let data;
        if (name === 'opening') data = { problem: 'Our dog collar helps families find their pets.', traction: 'We have customers and a working product.' };
        else if (['question', 'answer'].includes(name)) data = { text: name === 'question' ? 'How will you reach customers?' : 'We sell directly and build partnerships.' };
        else if (name === 'decision') data = decision === 'out' ? { action: 'out', reason: 'This is outside my focus.', offer: null } : { action: 'offer', reason: 'I see a path to growth.', offer: { cashUsd: 200000, equityPct: 20 } };
        else if (name === 'choice') {
          choices++;
          const sharkId = Object.keys(input.offers)[0];
          if (!sharkId || choice === 'decline' || (rejectFinal && choices > 1)) data = { action: 'decline', reason: 'I will keep building.', sharkId: null, offer: null };
          else if (choice === 'counter' && choices === 1) data = { action: 'counter', reason: 'I need to retain more ownership.', sharkId, offer: { cashUsd: 200000, equityPct: 15 } };
          else data = { action: 'accept', reason: 'We are aligned.', sharkId, offer: { cashUsd: input.offers[sharkId].cashUsd, equityPct: input.offers[sharkId].equityPct } };
        } else if (name === 'response') data = { action: response, reason: 'That reflects my investment thesis.', offer: response === 'out' ? null : response === 'revise' ? { cashUsd: 250000, equityPct: 17.5 } : { cashUsd: input.counter.cashUsd, equityPct: input.counter.equityPct } };
        else throw new Error(`Unexpected fixture request: ${name}`);
        return { data, metadata: { model: this.settings.model, servedTier: provider === 'openai' ? 'ultrafast' : null } };
      } };
  }
  return { openai: client('openai'), anthropic: client('anthropic'), calls };
}
