// The headers file ships with the site and the local server applies it, and both pages load
// cleanly: every file they ask for answers, and nothing is logged as an error.
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const EXPECTED = {
  'content-security-policy':
    "default-src 'self'; base-uri 'none'; object-src 'none'; form-action 'none'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
};
const PAGES = [
  { path: '/', status: 200 },
  { path: '/this-page-does-not-exist', status: 404 },
  { path: '/no/such/page', status: 404 },
];

test('site/_headers has one rule, for /*, with the three headers', () => {
  const text = readFileSync(new URL('../../site/_headers', import.meta.url), 'utf8');
  const lines = text.split('\n').filter((line) => line.trim() !== '');
  expect(lines[0], 'the only rule is /*').toBe('/*');
  const headers = Object.fromEntries(
    lines.slice(1).map((line) => {
      expect(line, 'header lines are indented').toMatch(/^\s+\S/);
      const colon = line.indexOf(':');
      return [line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim()];
    }),
  );
  expect(headers).toEqual(EXPECTED);
});

for (const { path, status } of PAGES) {
  test(`${path} answers ${status} with the three headers`, async ({ request }) => {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(status);
    for (const [name, value] of Object.entries(EXPECTED)) {
      expect(response.headers()[name], name).toBe(value);
    }
  });

  test(`${path} loads every file it asks for and logs no error`, async ({ page }) => {
    const problems = [];
    page.on('console', (message) => {
      if (message.type() !== 'error' && message.type() !== 'warning') return;
      // Chromium logs the 404 page's own status; that one is expected.
      const ownStatus = status === 404 && message.location().url === page.url() && /status of 404/.test(message.text());
      if (!ownStatus) problems.push(`console: ${message.text()} (${message.location().url})`);
    });
    page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
    page.on('requestfailed', (request) => problems.push(`failed: ${request.url()}`));
    page.on('response', (response) => {
      const isDocument = response.request().resourceType() === 'document';
      if (response.status() >= 400 && !(isDocument && status === 404)) {
        problems.push(`${response.status()}: ${response.url()}`);
      }
    });
    const response = await page.goto(path);
    expect(response.status()).toBe(status);
    await page.waitForLoadState('networkidle');
    expect(problems).toEqual([]);

    // Headless Chromium never asks for /favicon.ico, so check the icon link directly: without
    // one, a real browser requests /favicon.ico and gets a 404.
    const icons = await page.locator('link[rel~="icon"]').evaluateAll((links) => links.map((l) => l.href));
    expect(icons.length, 'a <link rel="icon">').toBeGreaterThan(0);
    for (const href of icons) {
      expect((await page.request.get(href, { maxRedirects: 0 })).status(), href).toBe(200);
    }
  });
}

test('the headers file itself is never served', async ({ request }) => {
  const response = await request.get('/_headers', { maxRedirects: 0 });
  expect(response.status()).toBe(404);
  expect(await response.text()).not.toContain('Content-Security-Policy');
});
