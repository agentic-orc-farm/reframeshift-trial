# 0001: A plain static site, with no build and no runtime dependencies

Status: proposed
Date: 2026-10-20

## Context

The first request is a holding page with a hero "Hello World", responsive, accessible and installable, in a new repository.
The owner's UI standard makes the lightest sufficient option the rule (UI.md 1, Firm) and lists a build tool, a type system and a unit-test runner as costs to be argued for.
This first choice sets the project's shape: every later change starts from it.

## Decision

- The site is the `site/` folder, served exactly as it is: HTML, two stylesheets (tokens and styles), two small JavaScript files for the service worker, a manifest, icons and a `_headers` file.
- No build step, no framework, no CSS framework, no TypeScript, no unit-test runner, and no runtime dependencies.
- The JavaScript carries no type-checking comments. This departs from UI.md 3's default for very small pages, because the two files hold about 35 lines of event handlers and checking them would add TypeScript and a `tsc` step; `AGENTS.md` records the difference.
- The service worker is hand-written and **network-first with a cache fallback**: it precaches a fixed list on install, refreshes the cache from every successful online response, and serves the cache only when the network fails. It has one fixed cache name.
- Development tooling (Playwright with axe, html-validate, stylelint, Lighthouse, wrangler) comes from npm as dev dependencies, and is run only through `make`.

## Alternatives

- **Vite and TypeScript.** A typed, bundled source tree. Adds a build, a type system and a dependency tree to ship two HTML files with no logic.
- **A static site generator** (Eleventy, Astro). Templates and partials for two pages that share nothing worth templating.
- **No npm at all** (validators and browsers installed another way). Lighter on paper, but Playwright is Firm in the standard and comes through npm.

## Consequences

- Nothing to compile: `make package` archives `site/`, and what is tested locally is byte for byte what is deployed.
- Shared markup between the two pages is copied, not templated. When a page count or real logic makes that painful, a later design adds a build and says why.
- The service worker's precache list is maintained by hand. Because it is network-first, a changed file is picked up on the next online visit with no cache version and no change to `sw.js`; a cache-first worker would need a version tied to the content, which needs a build or a hash check.
- A file the home page needs but the precache list lacks only breaks offline use, so it is caught by a test, not by users (below).

## What enforces it

`make check-deps` fails if `package.json` gains a runtime dependency or a framework appears among its dependencies.
`make check-css` fails on a literal colour outside `tokens.css`.
`make test` runs `tests/e2e/offline.spec.js`, so the precache list cannot drift from what the home page loads.
The test visits `/` and waits until the worker is active and controls the page.
It then cuts the network for both the page and the worker: `context.setOffline(true)` and `context.route('**/*', route => route.abort('internetdisconnected'))`.
`setOffline` alone is not trusted, because it has not reliably applied to service-worker fetches in Chromium (Playwright issue 2311); since Playwright 1.57, `context.route` intercepts a worker's own requests in Chromium, so the worker's network-first fetches are aborted and it must answer from its cache.
It reloads `/` and fails if any of the page's own requests failed (`page.on('requestfailed')`, skipping requests where `request.serviceWorker()` is set, which are the expected aborted worker fetches), or if no worker request was aborted at all, which would mean the cut never reached the worker.
Playwright is pinned at 1.57 or later.
The test is itself checked once: the engineering step removes one entry from the precache list, confirms the test fails, and reverts (the design's break checks). Network-first itself (rather than cache-first) can only be reviewed: the review agent checks that `sw.js` tries the network before the cache.
A build step can only be caught in review: the review agent checks that `make package` still archives `site/` unchanged.
