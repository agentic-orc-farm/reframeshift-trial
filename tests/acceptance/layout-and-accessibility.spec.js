// Both pages: no horizontal scroll at 320 pixels, an axe audit, and the document metadata.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { PAGES, openPage } from './support.js';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.describe('at 320 pixels wide', () => {
  test.use({ viewport: { width: 320, height: 568 } });

  for (const target of PAGES) {
    test(`AC4 the ${target.name} does not scroll horizontally at 320px`, async ({ page }) => {
      await openPage(page, target);
      const { scrollWidth, viewportWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }));
      expect(viewportWidth, 'viewport width').toBe(320);
      expect(scrollWidth, 'document scroll width').toBeLessThanOrEqual(viewportWidth);
    });
  }
});

for (const target of PAGES) {
  test(`AC5 axe (${AXE_TAGS.join(', ')}) reports no violations on the ${target.name}`, async ({ page }) => {
    await openPage(page, target);
    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    const summary = results.violations.map(
      (v) => `${v.id} (${v.impact}): ${v.help} -- ${v.nodes.map((n) => n.target.join(' ')).join('; ')}`,
    );
    expect(summary, `axe violations on the ${target.name}`).toEqual([]);
  });

  test(`AC11 the ${target.name} has lang, a title, a viewport meta tag and a meta description`, async ({ page }) => {
    await openPage(page, target);
    const meta = await page.evaluate(() => ({
      lang: document.documentElement.getAttribute('lang'),
      title: document.title,
      viewport: Array.from(document.querySelectorAll('meta[name="viewport" i]')).map((m) => m.getAttribute('content')),
      description: Array.from(document.querySelectorAll('meta[name="description" i]')).map((m) =>
        m.getAttribute('content'),
      ),
    }));
    expect(meta.lang?.trim() ?? '', 'the lang attribute on <html>').not.toBe('');
    expect(meta.title.trim(), 'the page title').not.toBe('');
    expect(meta.viewport.length, 'a <meta name="viewport"> tag').toBeGreaterThan(0);
    expect(meta.viewport[0]?.trim() ?? '', 'the viewport meta tag content').not.toBe('');
    expect(meta.description.length, 'a <meta name="description"> tag').toBeGreaterThan(0);
    expect(meta.description[0]?.trim() ?? '', 'the meta description content').not.toBe('');
  });
}
