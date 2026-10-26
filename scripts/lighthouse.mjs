// Runs the current Lighthouse with Playwright's Chromium against the local copy:
// the home page and the 404 page. Fails if performance, accessibility or best practices
// scores below 95 on either. Reports go to .lighthouse/.
// Usage: node scripts/lighthouse.mjs [base URL, default http://localhost:8790]
// The make target check-lighthouse starts and stops the local server around it.
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';

const base = (process.argv[2] ?? 'http://localhost:8790').replace(/\/$/, '');
// The 404 page is requested as its file: Lighthouse refuses to audit a document
// that answers with an error status, and the local server serves /404.html with 200.
const pages = [
  { name: 'home', path: '/' },
  { name: '404', path: '/404.html' },
];
const categories = ['performance', 'accessibility', 'best-practices'];
const threshold = 0.95;

async function waitForServer(url, seconds = 15) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw new Error(`the local server did not answer at ${url} within ${seconds} seconds`);
}

await waitForServer(`${base}/`);
await mkdir('.lighthouse', { recursive: true });

const chrome = await chromeLauncher.launch({
  chromePath: chromium.executablePath(),
  chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
});

let failed = false;
try {
  for (const page of pages) {
    const url = `${base}${page.path}`;
    const result = await lighthouse(url, {
      port: chrome.port,
      output: 'html',
      logLevel: 'error',
      onlyCategories: categories,
    });
    await writeFile(`.lighthouse/${page.name}.html`, result.report);
    const lhr = result.lhr;
    if (lhr.runtimeError) {
      console.error(`lighthouse: ${url}: ${lhr.runtimeError.code}: ${lhr.runtimeError.message}`);
      failed = true;
      continue;
    }
    for (const id of categories) {
      const score = lhr.categories[id]?.score;
      const shown = score === null || score === undefined ? 'no score' : Math.round(score * 100);
      const ok = typeof score === 'number' && score >= threshold;
      console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${page.path}  ${id}: ${shown} (needs ${threshold * 100})`);
      if (!ok) failed = true;
    }
  }
} finally {
  chrome.kill();
}

if (failed) {
  console.error('lighthouse: below the threshold; reports are in .lighthouse/');
  process.exit(1);
}
console.log('lighthouse: every page scores 95 or more; reports are in .lighthouse/');
