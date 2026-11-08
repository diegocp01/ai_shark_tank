import { test as base, expect } from '@playwright/test';
export { expect };
export const test = base.extend({
  offlineOnly: [async ({ context, request, baseURL }, use) => {
    const config = await (await request.get(`${baseURL}/api/config`)).json();
    expect(config.provider.id).toBe('scripted');
    expect(config.generation).toBeNull();
    const external = [];
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (['http:', 'https:'].includes(url.protocol) && url.origin !== new URL(baseURL).origin) {
        external.push(url.origin); return route.abort();
      }
      return route.continue();
    });
    await use();
    expect(external, 'No external requests during browser tests').toEqual([]);
  }, { auto: true }],
});
