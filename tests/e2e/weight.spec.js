// The page weight budget (UI.md 4): a first visit to "/" with an empty cache, including the
// service worker's precache, downloads no more than 50 KB of response bodies.
import { test, expect } from '@playwright/test';
import { waitForControllingWorker } from './support.js';

const BUDGET_BYTES = 50 * 1024;

test('a first visit to "/" downloads 50 KB or less', async ({ page, context }) => {
  const sizes = new Map();
  const pending = [];
  context.on('response', (response) => {
    pending.push(
      response
        .body()
        .then((body) => sizes.set(`${response.request().serviceWorker() ? 'worker' : 'page'} ${response.url()}`, body.length))
        .catch(() => {}), // a redirect has no body
    );
  });

  await page.goto('/');
  await waitForControllingWorker(page);
  await page.waitForLoadState('networkidle');
  await Promise.all(pending);

  const urls = [...sizes.keys()].map((key) => key.split(' ')[1]);
  for (const path of ['/', '/styles.css', '/tokens.css', '/sw.js', '/icons/icon-512.png']) {
    expect(urls, `${path} is counted`).toContain(new URL(path, page.url()).href);
  }
  const total = [...sizes.values()].reduce((sum, n) => sum + n, 0);
  const listing = [...sizes].map(([key, n]) => `${n} ${key}`).join('\n');
  expect(total, `bytes downloaded on a first visit:\n${listing}`).toBeLessThanOrEqual(BUDGET_BYTES);
});
