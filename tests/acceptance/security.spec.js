// The content security policy header, and no inline script or inline event handlers.
import { test, expect } from '@playwright/test';
import { HOME, PAGES, openPage } from './support.js';

// Splits one or more Content-Security-Policy header values into policies, each a Map of
// directive name to its list of source expressions (lower-cased).
function parsePolicies(headerValues) {
  const policies = [];
  for (const value of headerValues) {
    for (const policyText of value.split(',')) {
      const directives = new Map();
      for (const part of policyText.split(';')) {
        const [name, ...sources] = part.trim().split(/\s+/).filter(Boolean);
        if (!name) continue;
        const key = name.toLowerCase();
        if (!directives.has(key)) directives.set(key, sources.map((s) => s.toLowerCase()));
      }
      if (directives.size > 0) policies.push(directives);
    }
  }
  return policies;
}

test('AC12 the home page sends a CSP whose script-src (or default-src) forbids unsafe-inline and unsafe-eval', async ({
  request,
}) => {
  const response = await request.get(HOME, { maxRedirects: 0 });
  expect(response.status(), 'HTTP status of "/"').toBe(200);
  expect(await response.text(), 'the response is the home page').toContain('Hello World');

  const values = response
    .headersArray()
    .filter((h) => h.name.toLowerCase() === 'content-security-policy')
    .map((h) => h.value);
  expect(values.length, 'a Content-Security-Policy response header on "/"').toBeGreaterThan(0);

  const policies = parsePolicies(values);
  expect(policies.length, 'a non-empty Content-Security-Policy').toBeGreaterThan(0);

  let governed = 0;
  for (const policy of policies) {
    const directive = policy.has('script-src') ? 'script-src' : policy.has('default-src') ? 'default-src' : null;
    if (directive === null) continue;
    governed += 1;
    const sources = policy.get(directive);
    expect(sources, `${directive} must not allow 'unsafe-inline'`).not.toContain("'unsafe-inline'");
    expect(sources, `${directive} must not allow 'unsafe-eval'`).not.toContain("'unsafe-eval'");
  }
  expect(governed, 'a policy with a script-src or default-src directive').toBeGreaterThan(0);
});

for (const target of PAGES) {
  test(`AC14 the ${target.name} has no inline script and no inline event handler attribute`, async ({
    page,
    request,
  }) => {
    await openPage(page, target);
    const served = await (await request.get(target.path, { maxRedirects: 0 })).text();

    // Checks the markup as served (parsed without running it) and the live page after any
    // script has run. The finder is defined inside the page function: the page's CSP may
    // forbid building functions from strings.
    const found = await page.evaluate((html) => {
      const inlineCode = (doc) => {
        const scripts = Array.from(doc.querySelectorAll('script:not([src])')).map((s) => s.outerHTML.slice(0, 80));
        const handlers = [];
        for (const el of doc.querySelectorAll('*')) {
          for (const attr of el.attributes) {
            if (attr.name.toLowerCase().startsWith('on')) handlers.push(`<${el.tagName.toLowerCase()} ${attr.name}>`);
          }
        }
        return { scripts, handlers };
      };
      return {
        served: inlineCode(new DOMParser().parseFromString(html, 'text/html')),
        live: inlineCode(document),
      };
    }, served);

    expect(found.served.scripts, `<script> elements without src in the served ${target.name}`).toEqual([]);
    expect(found.served.handlers, `inline event handler attributes in the served ${target.name}`).toEqual([]);
    expect(found.live.scripts, `<script> elements without src in the loaded ${target.name}`).toEqual([]);
    expect(found.live.handlers, `inline event handler attributes in the loaded ${target.name}`).toEqual([]);
  });
}
