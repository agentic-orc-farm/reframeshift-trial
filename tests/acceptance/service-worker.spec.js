// The service worker: it becomes active for "/", and the home page loads offline.
import { test, expect } from '@playwright/test';
import { HOME, PAGES, levelOneHeading, openPage } from './support.js';

const HOME_PAGE = PAGES[0];

// The state of the registration for scope "/" as the page sees it.
async function registrationForRoot(page) {
  return page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return { supported: false };
    const root = new URL('/', location.href).href;
    const registrations = await navigator.serviceWorker.getRegistrations();
    const registration = registrations.find((r) => r.scope === root);
    return {
      supported: true,
      scopes: registrations.map((r) => r.scope),
      root,
      found: Boolean(registration),
      activeState: registration?.active?.state ?? null,
      activeScript: registration?.active?.scriptURL ?? null,
    };
  });
}

async function waitForActiveWorker(page) {
  await expect
    .poll(async () => (await registrationForRoot(page)).activeState, {
      message: 'a service worker registered for scope "/" becomes activated',
      timeout: 15_000,
    })
    .toBe('activated');
  return registrationForRoot(page);
}

test('AC13 after loading the home page, a service worker for scope "/" becomes active', async ({ page }) => {
  await openPage(page, HOME_PAGE);
  const registration = await waitForActiveWorker(page);
  expect(registration.found, `a registration for ${registration.root} (found: ${registration.scopes})`).toBe(true);
  expect(registration.activeScript, 'the active worker has a script').toBeTruthy();
});

test('AC10 after one online visit, reloading with page and worker offline still shows "Hello World"', async ({
  page,
  context,
}) => {
  // 1. One visit with the network on, until the worker is active.
  await openPage(page, HOME_PAGE);
  await waitForActiveWorker(page);
  const origin = new URL(HOME, page.url()).origin;
  const findWorker = () => context.serviceWorkers().find((w) => w.url().startsWith(origin)) ?? null;
  await expect
    .poll(findWorker, { message: 'Playwright sees the service worker', timeout: 10_000 })
    .not.toBeNull();
  const worker = findWorker();

  // 2. The network off for the page and for the worker. setOffline alone does not reach a
  //    worker's own requests in Chromium; the context route does (Playwright 1.57+).
  await context.setOffline(true);
  await context.route('**/*', (route) => route.abort('internetdisconnected'));

  // Proof the cut reached the worker: a request the worker itself makes must fail.
  const workerFetch = () =>
    worker.evaluate(async () => {
      try {
        await fetch(`/acceptance-network-probe-${Date.now()}`, { cache: 'no-store' });
        return 'reached the network';
      } catch {
        return 'blocked';
      }
    });
  expect(await workerFetch(), "the worker's own network before the reload").toBe('blocked');

  // 3. Reload: the heading must still show.
  let reloadError = null;
  await page.reload().catch((error) => {
    reloadError = error;
  });
  expect(reloadError?.message ?? null, 'the reload with the network off').toBeNull();
  await expect(levelOneHeading(page, 'Hello World'), 'the h1 "Hello World" after an offline reload').toBeVisible();

  expect(await workerFetch(), "the worker's own network after the reload").toBe('blocked');
});
