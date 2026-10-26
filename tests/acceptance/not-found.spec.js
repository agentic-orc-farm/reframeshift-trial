// The 404 page: status, content and stylesheet at any depth, and keyboard focus.
import { test, expect } from '@playwright/test';
import { NOT_FOUND_PATHS, NOT_FOUND_TOP, homeUrl, levelOneHeading } from './support.js';

for (const path of NOT_FOUND_PATHS) {
  test(`AC7 "${path}" answers 404 with "Page not found", a home link and its stylesheet`, async ({ page, request }) => {
    const response = await page.goto(path);
    expect(response.status(), `HTTP status of ${path}`).toBe(404);

    await expect(levelOneHeading(page, 'Page not found'), 'the h1 "Page not found"').toBeVisible();

    // a.href is the resolved address, so "/" and an absolute link to the same origin both count.
    const linkHrefs = await page
      .locator('a[href]')
      .filter({ visible: true })
      .evaluateAll((anchors) => anchors.map((a) => a.href));
    expect(linkHrefs, 'a visible link to the home page "/"').toContain(homeUrl(page));

    const stylesheets = await page.locator('link[rel~="stylesheet" i]').evaluateAll((links) =>
      links.map((link) => ({ href: link.href, loaded: link.sheet !== null })),
    );
    expect(stylesheets.length, 'the page links at least one stylesheet').toBeGreaterThan(0);
    for (const sheet of stylesheets) {
      const answer = await request.get(sheet.href, { maxRedirects: 0 });
      expect(answer.status(), `HTTP status of the stylesheet ${sheet.href}`).toBe(200);
      expect(sheet.loaded, `the stylesheet ${sheet.href} is applied to the page`).toBe(true);
    }
  });
}

test('AC8 one Tab from a fresh load focuses the home link, with a visible outline of 2px or more', async ({ page }) => {
  const response = await page.goto(NOT_FOUND_TOP);
  expect(response.status(), `HTTP status of ${NOT_FOUND_TOP}`).toBe(404);
  await expect(levelOneHeading(page, 'Page not found')).toBeVisible();

  await page.keyboard.press('Tab');

  const focused = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const style = getComputedStyle(el);
    return {
      tag: el.tagName.toLowerCase(),
      href: el.tagName.toLowerCase() === 'a' ? el.href : null,
      outlineStyle: style.outlineStyle,
      outlineWidth: parseFloat(style.outlineWidth),
    };
  });
  expect(focused, 'something has keyboard focus after one Tab').not.toBeNull();
  expect(focused.tag, 'the focused element is a link').toBe('a');
  expect(focused.href, 'the focused link goes to the home page').toBe(homeUrl(page));
  expect(focused.outlineStyle, 'computed outline style of the focused link').not.toBe('none');
  expect(focused.outlineWidth, 'computed outline width of the focused link, in pixels').toBeGreaterThanOrEqual(2);
});
