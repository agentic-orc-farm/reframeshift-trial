// Playwright global setup, used only when BASE_URL, CF_ACCESS_CLIENT_ID and
// CF_ACCESS_CLIENT_SECRET are all set (a private dev or staging address).
// It requests BASE_URL with the Access service token's headers, requires a 200 and a
// CF_Authorization cookie, and saves the storage state, so every browser context starts
// with the cookie. The cookie is for the service worker, whose own requests carry the
// browser's cookies but may not carry Playwright's extraHTTPHeaders.
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { request } from '@playwright/test';
import { ACCESS_STATE } from '../../playwright.config.js';

export default async function accessSetup() {
  const address = process.env.BASE_URL;
  const context = await request.newContext({
    extraHTTPHeaders: {
      'CF-Access-Client-Id': process.env.CF_ACCESS_CLIENT_ID,
      'CF-Access-Client-Secret': process.env.CF_ACCESS_CLIENT_SECRET,
    },
  });
  try {
    const response = await context.get(address, { maxRedirects: 0, failOnStatusCode: false });
    const state = await context.storageState();
    const cookie = state.cookies.find((c) => c.name === 'CF_Authorization');
    if (response.status() !== 200 || !cookie) {
      throw new Error(
        `could not reach ${address} through Cloudflare Access with the service token ` +
          `(status ${response.status()}, ${cookie ? 'a' : 'no'} CF_Authorization cookie)`,
      );
    }
    await mkdir(dirname(ACCESS_STATE), { recursive: true });
    await context.storageState({ path: ACCESS_STATE });
  } finally {
    await context.dispose();
  }
}
