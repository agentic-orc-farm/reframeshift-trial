// The web app manifest the home page links.
import { test, expect } from '@playwright/test';
import { PAGES, openPage } from './support.js';

const HOME_PAGE = PAGES[0];
const DISPLAY_MODES = ['fullscreen', 'standalone', 'minimal-ui', 'browser'];

// Width and height from a PNG's IHDR chunk, or null if the body is not a PNG.
function pngSize(body) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (body.length < 24 || !signature.every((byte, i) => body[i] === byte)) return null;
  return { width: body.readUInt32BE(16), height: body.readUInt32BE(20) };
}

test('AC9 the home page links a manifest with a name, start URL, display mode and 192 and 512 icons that load', async ({
  page,
  request,
}) => {
  await openPage(page, HOME_PAGE);

  const manifestHrefs = await page
    .locator('link[rel~="manifest" i]')
    .evaluateAll((links) => links.map((link) => link.href));
  expect(manifestHrefs.length, 'a <link rel="manifest"> on the home page').toBeGreaterThan(0);
  const manifestUrl = manifestHrefs[0];

  const answer = await request.get(manifestUrl, { maxRedirects: 0 });
  expect(answer.status(), `HTTP status of the manifest ${manifestUrl}`).toBe(200);
  let manifest;
  try {
    manifest = JSON.parse(await answer.text());
  } catch (error) {
    throw new Error(`the manifest ${manifestUrl} is not valid JSON: ${error.message}`);
  }

  expect(typeof manifest.name === 'string' ? manifest.name.trim() : '', 'manifest "name"').not.toBe('');
  expect(typeof manifest.start_url === 'string' ? manifest.start_url.trim() : '', 'manifest "start_url"').not.toBe(
    '',
  );
  expect(DISPLAY_MODES, `manifest "display" (${JSON.stringify(manifest.display)})`).toContain(manifest.display);

  const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
  for (const size of ['192x192', '512x512']) {
    const matching = icons.filter(
      (icon) => typeof icon.src === 'string' && String(icon.sizes ?? '').toLowerCase().split(/\s+/).includes(size),
    );
    expect(matching.length, `a manifest icon with sizes ${size}`).toBeGreaterThan(0);
    for (const icon of matching) {
      const iconUrl = new URL(icon.src, manifestUrl).href;
      const iconAnswer = await request.get(iconUrl, { maxRedirects: 0 });
      expect(iconAnswer.status(), `HTTP status of the ${size} icon ${iconUrl}`).toBe(200);
      const body = await iconAnswer.body();
      expect(body.length, `the ${size} icon ${iconUrl} has a body`).toBeGreaterThan(0);
      const actual = pngSize(body);
      if (actual !== null) {
        expect(`${actual.width}x${actual.height}`, `pixel size of the PNG icon ${iconUrl}`).toBe(size);
      }
    }
  }
});
