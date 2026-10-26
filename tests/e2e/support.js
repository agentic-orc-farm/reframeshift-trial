// Helpers for the engineering checks in tests/e2e.
import { expect } from '@playwright/test';

// Waits until a service worker is active and controls the page.
export async function waitForControllingWorker(page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null), {
      message: 'the service worker controls the page',
      timeout: 15_000,
    })
    .toBe(true);
}

// Cuts the network for the page and for the service worker's own requests.
// setOffline alone does not reach a worker's fetches in Chromium (Playwright issue 2311);
// the context route does, since Playwright 1.57.
export async function goOffline(context) {
  await context.setOffline(true);
  await context.route('**/*', (route) => route.abort('internetdisconnected'));
}

// Records failed requests, split into the page's own and the worker's own.
export function recordFailures(page, context) {
  const failures = { page: [], worker: [] };
  page.on('requestfailed', (request) => {
    if (request.serviceWorker()) return;
    failures.page.push(`${request.url()} (${request.failure()?.errorText})`);
  });
  context.on('requestfailed', (request) => {
    if (request.serviceWorker()) failures.worker.push(request.url());
  });
  return failures;
}
