// The home page: the hero heading, its place in the viewport and its size, and no-JS.
import { test, expect } from '@playwright/test';
import { HOME, VIEWPORTS, levelOneHeading } from './support.js';

test.describe('AC1 home page answers 200 with one h1 "Hello World"', () => {
  test('AC1 "/" answers HTTP 200', async ({ request }) => {
    const response = await request.get(HOME, { maxRedirects: 0 });
    expect(response.status(), 'HTTP status of "/"').toBe(200);
  });

  test('AC1 exactly one level-one heading, reading "Hello World"', async ({ page }) => {
    const response = await page.goto(HOME);
    expect(response.status(), 'HTTP status of "/"').toBe(200);

    const h1Elements = page.locator('h1');
    await expect(h1Elements, 'number of <h1> elements').toHaveCount(1);
    await expect(h1Elements.first()).toHaveText('Hello World');

    // Also as the accessibility tree sees it: no second heading made level 1 with ARIA.
    const levelOne = page.getByRole('heading', { level: 1 });
    await expect(levelOne, 'number of level-one headings').toHaveCount(1);
    await expect(levelOneHeading(page, 'Hello World')).toBeVisible();
  });
});

for (const viewport of VIEWPORTS) {
  const size = `${viewport.width}x${viewport.height}`;

  test.describe(`at ${size}`, () => {
    test.use({ viewport });

    test(`AC2 "Hello World" is in main and wholly inside the viewport at ${size}`, async ({ page }) => {
      await page.goto(HOME);

      const heading = page.getByRole('main').getByRole('heading', { level: 1, name: 'Hello World', exact: true });
      await expect(heading, 'the h1 "Hello World" inside the main landmark').toBeVisible();

      const scroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
      expect(scroll, 'the page must not have scrolled').toEqual({ x: 0, y: 0 });

      const box = await heading.boundingBox();
      expect(box, 'the heading has a bounding box').not.toBeNull();
      expect(box.width, 'heading width').toBeGreaterThan(0);
      expect(box.height, 'heading height').toBeGreaterThan(0);
      const epsilon = 0.01; // sub-pixel rounding only
      expect(box.x, 'heading left edge').toBeGreaterThanOrEqual(0 - epsilon);
      expect(box.y, 'heading top edge').toBeGreaterThanOrEqual(0 - epsilon);
      expect(box.x + box.width, 'heading right edge').toBeLessThanOrEqual(viewport.width + epsilon);
      expect(box.y + box.height, 'heading bottom edge').toBeLessThanOrEqual(viewport.height + epsilon);
    });

    test(`AC3 the heading's font size is at least twice the body's at ${size}`, async ({ page }) => {
      await page.goto(HOME);
      const heading = levelOneHeading(page, 'Hello World');
      await expect(heading).toBeVisible();

      const headingSize = await heading.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      const bodySize = await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
      expect(bodySize, 'body font size').toBeGreaterThan(0);
      expect(headingSize, `heading font size (body is ${bodySize}px)`).toBeGreaterThanOrEqual(2 * bodySize);
    });
  });
}

test.describe('AC6 with JavaScript disabled', () => {
  test.use({ javaScriptEnabled: false });

  test('AC6 the home page still shows the "Hello World" heading', async ({ page }) => {
    const response = await page.goto(HOME);
    expect(response.status(), 'HTTP status of "/"').toBe(200);
    await expect(levelOneHeading(page, 'Hello World')).toBeVisible();
  });
});
