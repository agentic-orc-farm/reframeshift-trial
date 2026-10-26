// The service worker: everything the home page needs is cached after one visit, it is
// network first, and it removes caches it does not own. See the design's "Turning the
// network off in the tests" for why the network is cut with both setOffline and a route.
import { test, expect } from '@playwright/test';
import { goOffline, recordFailures, waitForControllingWorker } from './support.js';

const heading = (page, name) => page.getByRole('heading', { level: 1, name, exact: true });

test('offline, the home page reloads with no failed request', async ({ page, context }) => {
  await page.goto('/');
  await waitForControllingWorker(page);

  await goOffline(context);
  const failures = recordFailures(page, context);
  await page.reload();

  await expect(heading(page, 'Hello World')).toBeVisible();
  // Every file the page asks for must come from the cache: a missing precache entry fails here.
  expect(failures.page, 'page requests that failed with the network off').toEqual([]);
  // Proof the cut reached the worker: its own network attempts were aborted.
  expect(failures.worker.length, "the worker's aborted network requests").toBeGreaterThan(0);
});

test('the worker caches only clean URLs, never an .html address or the 404 page', async ({ page }) => {
  // The host redirects /index.html (and any .html address) to its clean URL, and cache.addAll
  // rejects a redirect, so the worker would never install there; the local server does not
  // redirect, so this checks the cache contents instead.
  await page.goto('/');
  await waitForControllingWorker(page);
  const cached = await page.evaluate(async () =>
    (await (await caches.open('site')).keys()).map((request) => new URL(request.url).pathname),
  );
  expect(cached).toContain('/');
  expect(cached.filter((path) => path.endsWith('.html')), '.html addresses in the cache').toEqual([]);
});

test('online, the worker serves the network copy, not the cache, and keeps it for offline', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await waitForControllingWorker(page);

  // A changed home page on the "server": the route answers the worker's own fetch of "/".
  const changed = (await (await page.request.get('/')).text()).replace('<h1>Hello World</h1>', '<h1>Hello Again</h1>');
  expect(changed, 'the changed page').toContain('<h1>Hello Again</h1>');
  await context.route(
    (url) => url.pathname === '/',
    (route) => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: changed }),
  );
  await page.reload();
  await expect(heading(page, 'Hello Again'), 'the network copy, not the cached one').toBeVisible();

  // The network copy replaced the cached one.
  await expect
    .poll(() => page.evaluate(async () => (await (await caches.match('/'))?.text()) ?? ''), {
      message: 'the cached "/" is the network copy',
    })
    .toContain('Hello Again');

  await context.unroute((url) => url.pathname === '/');
  await goOffline(context);
  await page.reload();
  await expect(heading(page, 'Hello Again'), 'offline, the last network copy').toBeVisible();
});

test('on activation the worker deletes every cache but its own', async ({ page }) => {
  // The 404 page registers no worker, so a stale cache can be made before one exists.
  await page.goto('/this-page-does-not-exist');
  await page.evaluate(async () => {
    await (await caches.open('site-old')).put('/stale', new Response('stale'));
  });

  await page.goto('/');
  await waitForControllingWorker(page);
  await expect
    .poll(() => page.evaluate(() => caches.keys()), { message: 'the cache names after activation' })
    .toEqual(['site']);
});

test('the worker registers for the whole site, from /sw.js', async ({ page }) => {
  await page.goto('/');
  await waitForControllingWorker(page);
  const registration = await page.evaluate(async () => {
    const r = await navigator.serviceWorker.ready;
    return { scope: r.scope, script: r.active.scriptURL };
  });
  expect(registration.scope).toBe(new URL('/', page.url()).href);
  expect(registration.script).toBe(new URL('/sw.js', page.url()).href);
});
