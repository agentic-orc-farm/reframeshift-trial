// Shared values and helpers for the acceptance tests. Test agent only.
// Every test uses Playwright's own fixtures (page, context, request) and test.use({...}),
// so the Access headers and cookie from playwright.config.js reach every request.
import { expect } from '@playwright/test';

export const HOME = '/';
export const NOT_FOUND_TOP = '/this-page-does-not-exist';
export const NOT_FOUND_NESTED = '/no/such/page';
export const NOT_FOUND_PATHS = [NOT_FOUND_TOP, NOT_FOUND_NESTED];

// The pages the criteria name together: "the home page" and "the 404 page".
export const PAGES = [
  { name: 'home page', path: HOME, status: 200, heading: 'Hello World' },
  { name: '404 page', path: NOT_FOUND_TOP, status: 404, heading: 'Page not found' },
];

export const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];

// The single visible level-one heading with exactly this text.
export function levelOneHeading(page, text) {
  return page.getByRole('heading', { level: 1, name: text, exact: true });
}

// Opens a path, checks the status, and checks the page is the one expected (its h1),
// so no test can pass on an empty page, an error page or a login page.
export async function openPage(page, { path, status, heading }) {
  const response = await page.goto(path);
  expect(response, `no response for ${path}`).not.toBeNull();
  expect(response.status(), `HTTP status of ${path}`).toBe(status);
  await expect(levelOneHeading(page, heading), `the h1 "${heading}" on ${path}`).toBeVisible();
  return response;
}

// The absolute URL of the site's home page, from wherever the page is.
export function homeUrl(page) {
  return new URL('/', page.url()).href;
}
