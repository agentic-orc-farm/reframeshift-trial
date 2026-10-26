// Playwright for `make test` (tests/e2e) and `make acceptance` (tests/acceptance).
// - BASE_URL unset: a webServer runs scripts/serve.mjs on port 8788 (the local copy).
// - BASE_URL set: the tests run against that address and no server is started.
// - BASE_URL, CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET all set (a private
//   environment): every request carries the two Access headers, and every browser context
//   starts with the Access cookie saved by tests/support/access-setup.js.
// Never set PLAYWRIGHT_DISABLE_SERVICE_WORKER_NETWORK: the offline tests route the
// service worker's own requests, which needs Playwright 1.57 or later in Chromium.
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

export const ACCESS_STATE = fileURLToPath(new URL('./.auth/access.json', import.meta.url));

const PORT = Number(process.env.PORT || 8788);
const baseURL = process.env.BASE_URL || undefined;
const accessId = process.env.CF_ACCESS_CLIENT_ID;
const accessSecret = process.env.CF_ACCESS_CLIENT_SECRET;
const access = Boolean(baseURL && accessId && accessSecret);

export default defineConfig({
  testDir: './tests',
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  globalSetup: access ? './tests/support/access-setup.js' : undefined,
  use: {
    baseURL: baseURL ?? `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    ...(access && {
      extraHTTPHeaders: {
        'CF-Access-Client-Id': accessId,
        'CF-Access-Client-Secret': accessSecret,
      },
      storageState: ACCESS_STATE,
    }),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Waits on the port, not a URL: before the site exists, "/" answers 404.
  webServer: baseURL
    ? undefined
    : {
        command: `node scripts/serve.mjs --port ${PORT}`,
        port: PORT,
        reuseExistingServer: !process.env.CI,
      },
});
