// Preloaded in every Node test and Playwright's server. Even with credentials
// on the developer's machine, tests cannot contact model providers.
import http from 'node:http';
import https from 'node:https';
import { syncBuiltinESMExports } from 'node:module';
process.env.AI_SHARK_TANK_TESTING = '1';
process.env.AI_SHARK_TANK_MODE = 'mock';
const local = value => ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(value);
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  const url = new URL(input instanceof Request ? input.url : input);
  if (!local(url.hostname)) throw new Error('Offline tests prohibit external requests. Inject a scripted transport.');
  return originalFetch(input, options);
};
for (const mod of [http, https]) {
  for (const method of ['request', 'get']) {
    const original = mod[method];
    mod[method] = function(input, ...args) {
      const host = typeof input === 'string' || input instanceof URL ? new URL(input).hostname : input?.hostname || input?.host || 'localhost';
      if (!local(host)) throw new Error('Offline tests prohibit external HTTP requests.');
      return original.call(this, input, ...args);
    };
  }
}
syncBuiltinESMExports();
