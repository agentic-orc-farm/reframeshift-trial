// Installable as a PWA (UI.md 4): Chromium reports no installability errors for the home page.
import { test, expect } from '@playwright/test';
import { waitForControllingWorker } from './support.js';

test('Chromium reports no installability errors on the home page', async ({ page, context }) => {
  await page.goto('/');
  await waitForControllingWorker(page);

  const cdp = await context.newCDPSession(page);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  expect(installabilityErrors.map((e) => e.errorId)).toEqual([]);

  // The same manifest Chromium judged, as the browser parsed it: the check really saw one.
  const { url, errors } = await cdp.send('Page.getAppManifest');
  expect(url, 'the manifest Chromium found').toBe(new URL('/manifest.webmanifest', page.url()).href);
  expect(errors, 'manifest parse errors').toEqual([]);
});
