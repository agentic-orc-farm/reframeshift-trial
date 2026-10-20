---
title: A static holding page with a hero "Hello World", and the project's first conventions
size: large            # a new project: stack, conventions, CI and a dev/test environment, in one pull request
acceptance_tests: tests/acceptance/
criteria:
  - id: AC1
    kind: new
    text: The home page at "/" answers with HTTP 200 and has exactly one level-one heading, which reads "Hello World".
  - id: AC2
    kind: new
    text: The "Hello World" heading is inside the page's main landmark, and its whole bounding box lies inside the viewport without scrolling at viewport sizes 320x568, 768x1024 and 1440x900.
  - id: AC3
    kind: new
    text: At each of those three viewport sizes, the "Hello World" heading's computed font size is at least twice the computed font size of the body element.
  - id: AC4
    kind: new
    text: At a viewport 320 pixels wide, neither the home page nor the 404 page scrolls horizontally (the document's scroll width is no greater than the viewport width).
  - id: AC5
    kind: new
    text: An axe accessibility audit with the tags wcag2a, wcag2aa, wcag21a, wcag21aa and wcag22aa reports no violations on the home page or the 404 page.
  - id: AC6
    kind: new
    text: With JavaScript disabled, the home page still shows the "Hello World" heading.
  - id: AC7
    kind: new
    text: A request for an unknown top-level path ("/this-page-does-not-exist") and for an unknown nested path ("/no/such/page") each answers with HTTP 404, and in both cases the page shown has a level-one heading reading "Page not found", a link to the home page ("/"), and its stylesheet applied (every stylesheet it links answers with HTTP 200).
  - id: AC8
    kind: new
    text: On the 404 page, pressing Tab once from a fresh load puts keyboard focus on the link to the home page, and the focused link has a computed outline style other than "none" and a computed outline width of at least 2 pixels.
  - id: AC9
    kind: new
    text: The home page links a web app manifest that has a name, a start URL, a display mode, and icons sized 192x192 and 512x512 that each load with HTTP 200.
  - id: AC10
    kind: new
    text: After one visit with the network on, reloading the home page with the network off, for both the page and its service worker, still shows the "Hello World" heading.
  - id: AC11
    kind: new
    text: The home page and the 404 page each have a lang attribute on the html element, a non-empty title, a viewport meta tag and a non-empty meta description.
  - id: AC12
    kind: new
    text: The home page response carries a Content-Security-Policy header whose script-src (or, if absent, default-src) allows neither 'unsafe-inline' nor 'unsafe-eval'.
  - id: AC13
    kind: new
    text: After loading the home page, a service worker registered for the scope "/" becomes active.
  - id: AC14
    kind: new
    text: Neither the home page nor the 404 page contains a script element without a src attribute, or any element with an inline event handler attribute (an attribute whose name starts with "on").
---

# A static holding page with a hero "Hello World"

## The request

Create a new static website: a holding page with a prominent, hero-level "Hello World".
There is no existing project, so this also sets the project's first conventions.
The result is responsive and accessible, and goes through the normal workflow: a pull request, CI, a per-PR dev/test deployment with an address, and validation there.

The repository is empty apart from a one-line README, so there is no existing behaviour for a criterion of kind `existing` to protect.

## What every option shares

The page itself is the same in every option, because the weight rule (UI.md section 1, Firm) decides it and nothing in the request argues otherwise:

- **Plain HTML and CSS, no build, no framework, no runtime dependencies.** One `index.html`, one `404.html`, one stylesheet of design tokens, a manifest, icons and a small hand-written service worker for the offline requirement (UI.md section 4). Follows the standard.
- **No TypeScript and no Vite.** The only script is the service worker and its few lines of registration; there is no logic to type or to bundle. Follows the standard ("no build for a static page that does not need one"). Vite plus TypeScript was considered and set aside: it adds a build, a type system and a dependency tree to ship two HTML files.
- **Development-only tooling through npm**, behind `make`: Playwright (Firm) with axe for the acceptance and accessibility checks, an HTML validator, a CSS linter or validator, the current Lighthouse, a page-weight budget and a dependency check. Exact tools are chosen in the design pass.
- **The `make` interface from ADR 0007** (`setup`, `check`, `test`, `acceptance`, `package`, `deploy ENV=`, `smoke ENV=`); CI calls only these.
- **`package` produces one immutable bundle** (the static folder, archived) that every environment receives (GITHUB.md section 7, build once).

So the options differ in one hard-to-reverse thing: **where the site is hosted, and so how each PR gets its own dev/test address.**

## Options

### A. Cloudflare, deployed from CI (recommended)

CI runs `make package`, then `make deploy ENV=dev` uploads the bundle to Cloudflare with `wrangler`, creating a preview for the PR and publishing its address.
Staging and production later receive the same bundle.
Whether the host is Cloudflare Pages (direct upload, a preview per branch) or a Worker with static assets (per-PR Previews) is settled in the design pass; both serve a custom `404.html` with a real 404 status and both read a `_headers` file for a content security policy.

- **Costs:** a Cloudflare account, and an API token and account ID stored once as organization secrets in `agentic-orc-farm`. That is a manual owner step, already expected in the plan's M4 decision as a friction-log item. Wrangler is one more development dependency. Free tier covers the traffic.
- **Risks:** Workers Previews are recent (Wrangler 4.135 or later) and I could not confirm from Cloudflare's documentation how static assets behave in a Preview; Pages direct upload is the older, known-good path. Preview addresses are public by default, which is fine for a "Hello World" holding page.
- **Against the standards:** follows the weight rule and the static site baseline; follows GITHUB.md section 7 (build once, promote the artifact, secrets only in CI). Cloudflare is the static-site target the framework's notes already name.

### B. GitHub Pages

CI publishes the bundle with GitHub's own Pages actions. No outside account and no secret.

- **Costs:** nothing to set up beyond enabling Pages; on GitHub Free the repository must be public.
- **Risks:** GitHub Pages hosts one site per repository, so a per-PR dev/test address means publishing each PR into a sub-folder of a `gh-pages` branch. That is deployment by branch, which GITHUB.md section 7 says new work should not copy. Pages serves only the root `404.html`, so an unknown path under a PR's sub-folder shows the main site's 404, not the PR's: AC7 could not be validated in dev/test. Pages cannot set response headers, so the content security policy can only be a meta tag. Staging and production as separate environments would need a second repository.
- **Against the standards:** follows the weight rule; departs from "environments by promotion, not by branch", and weakens the 404 and security baseline checks.

### C. The local server, over Tailscale

The bundle is served by an nginx container on the owner's 2017 MacBook, reached over Tailscale; CI joins the tailnet with an ephemeral key and starts a container per PR.

- **Costs:** a Dockerfile, an nginx configuration, routing for a container per PR, a Tailscale key in CI, and the MacBook staying up. No public address.
- **Risks:** the most moving parts of the three, all of it infrastructure this framework has not built yet (M4's open question); the site is unreachable when the machine is off.
- **Against the standards:** departs from the weight rule with no reason in the request: nothing here needs a server the owner runs.

## Recommendation

**Option A, Cloudflare.**
It is the only option that gives each PR its own address with a real 404 status and real response headers, while keeping one immutable bundle promoted between environments, as GITHUB.md asks.
Its one cost, a Cloudflare token stored once as an organization secret, is the manual step the plan already expects, and it serves every later static project in the organization.
Option B is the right fallback if the owner wants no outside account at all, accepting that the 404 cannot be validated per PR and that environments go by branch.
Option C is heavier than the request needs.

## The choice

The orchestrator picked **A, Cloudflare**: it is the only option that gives each PR its own address with a real 404 status and real response headers, so AC7 and the security baseline are validated in dev/test, and one immutable bundle is promoted between environments.
It asked the design to prefer Pages direct upload over Workers Previews unless the latter's static-asset behaviour can be confirmed.
It could not be: Cloudflare's Workers documentation describes Version URLs and preview aliases but does not say how static assets or the 404 page behave in them.
So the host is **Cloudflare Pages, by direct upload from CI** (ADR 0002).

# Design

## The smallest version

A folder of static files, served as they are, with no build:

| File | What it is |
|---|---|
| `site/index.html` | The holding page: a `main` landmark holding one `h1` "Hello World" and one short paragraph, centred in the viewport. |
| `site/404.html` | The 404 page: `h1` "Page not found" and a link to `/`. No script. |
| `site/tokens.css` | The design tokens, as CSS custom properties on `:root`: colours, spacing, type scale, focus ring. Nothing else. |
| `site/styles.css` | The styles, using only the tokens. |
| `site/register-sw.js` | Registers the service worker, after checking `'serviceWorker' in navigator`. |
| `site/sw.js` | A hand-written service worker, **network-first with a cache fallback** (below). |
| `site/manifest.webmanifest` | Name, short name, start URL `/`, `display: standalone`, colours, icons. |
| `site/icons/` | `icon-192.png`, `icon-512.png`, and `icon.svg` linked as the page's icon so the browser does not request a missing `/favicon.ico`. |
| `site/_headers` | Response headers for every path: the content security policy and two hardening headers. |

Every URL in the pages and the manifest is **root-absolute** (`/styles.css`, `/icons/icon-192.png`, `/register-sw.js`), never relative.
Pages serves the top-level `404.html` for an unknown path at any depth, so a relative `styles.css` on the 404 page would resolve to `/no/such/styles.css` and the page would load unstyled; AC7 checks a nested path for that reason.

The service worker, in about 30 lines:

- **On install**, it adds a fixed list of URLs to one cache, `site`: `/`, `/tokens.css`, `/styles.css`, `/register-sw.js`, `/manifest.webmanifest` and the icons. Precaching is needed because the first visit's requests happen before the worker controls the page, so nothing else would be cached for AC10.
- **On fetch**, for same-origin `GET` requests only: try the network; on a response with `ok` true, put a copy in the cache and return it; if the network fails, return the cached copy. Nothing else: no fallback page for uncached paths, which no criterion asks for.
- **On activate**, it deletes every cache not named `site` and claims its clients.

Network-first means the cached copy is refreshed on every online visit and never served while the network answers, so a changed page or stylesheet needs no cache version and no change to `sw.js`.
The cost is that an online visit waits for the network as it would without a worker, which for two static pages of a few kilobytes is negligible.
The precache list is still kept by hand; a file missing from it only shows when offline, so `tests/e2e/offline.spec.js` reloads `/` with the network off and fails if any of the page's requests fails (ADR 0001).

Layout: the body is a single-column grid with `min-height: 100svh` that centres `main`; the heading's size is a `clamp()` of the type tokens, so it scales from 320 pixels wide upwards and stays at least twice the body size (AC3).
System font stack, no web fonts.
No animation, so `prefers-reduced-motion` has nothing to turn off.
Links get a token-coloured `:focus-visible` outline of 3 pixels with an offset (AC8); Chromium's default ring is 1 pixel, which AC8 would reject.

The site's name in the manifest and the page titles is "ReframeShift", from the repository name (an assumption; nothing in the request names it).

Security headers in `site/_headers`, for `/*`:

```
Content-Security-Policy: default-src 'self'; base-uri 'none'; object-src 'none'; form-action 'none'; frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

`default-src 'self'` covers scripts, styles, images, the manifest and the worker; nothing is inline, so nothing needs `'unsafe-inline'`.

Two traps for the build, known in advance:

- **Pages strips `.html`**: it redirects `/contact.html` to `/contact`. The service worker must precache only URLs that answer 200 with no redirect (`/`, the stylesheets, the scripts, the manifest, the icons), or `cache.addAll` rejects and the worker never installs. Do not precache `/index.html` or the 404 page.
- **Without a top-level `404.html`, Pages treats the site as a single-page app** and answers every unknown path with the home page and a 200. The `404.html` file is what makes AC7 pass, and AC7 is what proves it.

## Turning the network off in the tests

Because the worker is network-first, every request it handles goes to the network before the cache.
If a test cuts the page's network but not the worker's, the worker still fetches every file from the server, the page loads in full, and the offline test passes even when the precache list is missing a file.
`context.setOffline(true)` alone is not enough: Playwright's issue 2311, closed without a fix, records it not applying to service-worker fetches in Chromium.

So the offline tests (`tests/e2e/offline.spec.js`, and the acceptance test for AC10) cut the network for both, in this order:

1. Visit `/` with the network on and wait until `navigator.serviceWorker.ready` resolves and `navigator.serviceWorker.controller` is set (the worker is active and controls the page).
2. Call `context.setOffline(true)` **and** `context.route('**/*', route => route.abort('internetdisconnected'))`. Since Playwright 1.57, Chromium reports a service worker's own network requests on the browser context and lets `context.route` intercept them, so the worker's network attempts are aborted too. Requests the page makes go to the worker first and are not routed (Playwright's service-worker guide: only the worker-owned request is routable), so the route does not stop the worker answering from its cache.
3. Collect failures with `page.on('requestfailed')`, skipping any request where `request.serviceWorker()` is set. The worker's aborted network attempts are expected; a page request that fails means the worker had nothing cached for it.
4. Reload `/`. The test fails if any page request failed, if the `h1` "Hello World" is missing, or if no worker-owned request was aborted (`context.on('requestfailed')` with `request.serviceWorker()` set). That last condition proves the cut reached the worker; without it, a Playwright that stopped routing worker requests would let the test pass with the network still on.

This method works the same against the local copy and against a deployed `BASE_URL`, which matters because AC10 runs against the dev/test address, where the test cannot stop the server.
Playwright is pinned at 1.57 or later in `package.json` for this reason, and `PLAYWRIGHT_DISABLE_SERVICE_WORKER_NETWORK` must not be set anywhere.

If the break check below shows the method does not reach the worker on the Playwright in use, the fallback for `tests/e2e/offline.spec.js` is to serve `site/` from a small Node static server started by the test on a free port, and stop that server before the reload; AC10 against a deployed address would then keep the route method, and the design would need revisiting.

## Break checks

Before the pull request is marked ready, the engineering step introduces each fault below, runs the named check, confirms it fails, and reverts the fault.
A check that still passes with its fault in place is not testing what it claims.

| Fault | Check that must fail |
|---|---|
| Remove one entry (`/styles.css`) from the worker's precache list | `make test` (`tests/e2e/offline.spec.js`) |

## The stack

| Concern | Choice | Standard |
|---|---|---|
| Pages | Plain HTML and CSS, no framework, no components | Follows UI.md 1 and 3 (plain HTML and CSS when there are no components). |
| Language | None beyond two short plain JavaScript files (`register-sw.js`, `sw.js`), with no type-checking comments | **Departs** from UI.md 3's default for very small pages (plain JavaScript *with* type-checking comments), because there is no logic worth typing: checking the comments would add TypeScript as a dev dependency and a `tsc` step for about 35 lines of event handlers. Recorded in `AGENTS.md` as the project's one difference. Revisit when a script gains real logic. |
| Build | None: `site/` is the deployable output, archived by `make package` | Follows UI.md 3 ("no build for a static page that does not need one"). There is no `make build`; UI.md lists it "if there is a build". |
| Styling | CSS custom properties in `tokens.css`; no CSS framework | Follows UI.md 3 and 8 (Firm). Two stylesheets rather than one so the linter can forbid literal colours everywhere except the tokens file; the cost is one extra request of about 1 KB. |
| Runtime dependencies | None | Follows UI.md 1 and 4. |
| Development tooling | Node, current LTS line pinned in `.nvmrc` (24 today; move to 26 when it enters LTS), npm with a committed `package-lock.json`, dev dependencies only | Follows UI.md 3 (npm). |
| End-to-end and acceptance tests | Playwright 1.57 or later (it routes service-worker requests; see "Turning the network off"), Chromium only, with `@axe-core/playwright` | Follows UI.md 3 (Playwright, Firm). Chromium only is the lightest that meets the criteria; no criterion names a browser. |
| Unit tests | None | Follows UI.md 3 and 11: there is no logic to unit-test. |
| HTML validation | `html-validate` with its recommended and document presets | No standard names a tool. Chosen over the W3C Nu checker (`vnu-jar`) because it needs no Java; it lints against the HTML specification but is not the reference conformance checker. |
| CSS validation and token rule | `stylelint` with `stylelint-config-standard`, plus `property-no-unknown`, `declaration-property-value-no-unknown` and `at-rule-no-unknown` for validity; `color-no-hex`, `color-named: never` and `function-disallowed-list` for the colour functions, everywhere except `tokens.css` | Follows UI.md 8 (stylelint for the tokens). There is no maintained npm wrapper for the W3C CSS validator, so stylelint's unknown-property and unknown-value rules stand in for it. |
| Performance and quality | The current `lighthouse` npm package (a caret range on its latest major, not an old pin), run with Playwright's Chromium against the local copy; performance, accessibility and best practices at 95 or more | Follows UI.md 4. Lighthouse no longer has a PWA category, so installability is checked separately (below). |
| Installability | A Playwright test that asks Chromium for `Page.getInstallabilityErrors` over the DevTools protocol and expects none | Follows UI.md 4. |
| Page weight | A Playwright test that loads `/` with an empty cache and fails if the response bodies total more than 50 KB | Follows UI.md 4 (a stated budget). |
| Dependency check | `scripts/check-deps.mjs`: fails if `package.json` has any `dependencies`, or if a framework or CSS framework (react, vue, svelte, angular, preact, lit, solid-js, tailwindcss, bootstrap and the like) appears anywhere in the lockfile's direct dependencies | Follows UI.md 1 and 4. |
| Local server | `wrangler pages dev site`, the same server semantics as the host (404 page, `_headers`, `.html` redirects) | No standard covers it. Wrangler is already needed to deploy, so this adds nothing. |
| Hosting | Cloudflare Pages, direct upload from CI with `wrangler pages deploy` | ADR 0002. GITHUB.md 7 leaves the deploy target to the project. |
| CI | GitHub Actions, calling only `make` targets | Follows GITHUB.md 7 and ADR 0007 of the framework. |

What this rejects as heavier: Vite, TypeScript, Vitest, Web Components, a service-worker library (Workbox), a CSS framework. None is needed for two static pages and fourteen criteria.

## Standards in the project

Set up copies the standards that apply into the project, as the flow asks: `docs/standards/UI.md` and `docs/standards/GITHUB.md`, version 2 draft, unchanged.
`AGENTS.md` at the root states the project's conventions in a few lines: `make` is the only way to run anything; `site/` is served as it is and has no runtime dependencies; colours and spacing come from `tokens.css`; `tests/acceptance/` belongs to the test agent and is never edited by the engineering agent; commits are `area: what changed` with no AI trailers (GITHUB.md 3); it follows the vendored standards with one recorded difference: the two JavaScript files carry no type-checking comments, departing from UI.md 3's default, because they hold no logic worth typing.
`.gitignore` covers GITHUB.md 8's list, plus `test-results/`, `playwright-report/`, `.wrangler/` and `.lighthouse/`.

## Project layout

```
site/                 the bundle (above)
tests/acceptance/     the test agent's frozen acceptance tests, one file per page or concern
tests/e2e/            the engineering agent's own checks: installability, page weight, offline with no failed request, headers file present
scripts/              check-deps.mjs, lighthouse.mjs, deploy.sh, smoke.sh
playwright.config.js  baseURL from BASE_URL; when it is unset, a webServer that runs wrangler pages dev on port 8788
package.json, package-lock.json, .nvmrc, .htmlvalidate.json, .stylelintrc.json
Makefile
.github/workflows/ci.yml
AGENTS.md, README.md, docs/standards/, docs/design/, docs/adr/
```

## The make targets

| Target | What sits behind it |
|---|---|
| `make setup` | `npm ci`, then `npx playwright install chromium` (with `--with-deps` when `CI` is set). |
| `make check` | `check-html`, `check-css`, `check-deps`, `check-lighthouse`, then `make test` and `make acceptance` (local). Fails if any fails. |
| `make check-html` | `html-validate site/*.html`. |
| `make check-css` | `stylelint "site/**/*.css"`. |
| `make check-deps` | `node scripts/check-deps.mjs`. |
| `make check-lighthouse` | Starts the local copy, runs `node scripts/lighthouse.mjs` against `/` and the 404 page, fails below 95 in performance, accessibility or best practices, stops the server. |
| `make test` | `playwright test tests/e2e` against a local copy. |
| `make acceptance` | `playwright test tests/acceptance`; against `BASE_URL` when it is set, otherwise Playwright's `webServer` starts the local copy. |
| `make dev` | `wrangler pages dev site` on port 8788. |
| `make package` | `tar` of `site/` into `dist/site.tar.gz`, with `dist/site.tar.gz.sha256` beside it. No rebuild happens anywhere after this. |
| `make deploy ENV=<env>` | `scripts/deploy.sh`: unpacks `dist/site.tar.gz` (or `ARTIFACT`) to a temporary folder, creates the Pages project `reframeshift-trial` with production branch `main` if it does not exist, runs `wrangler pages deploy <folder> --project-name reframeshift-trial --branch <branch> --commit-hash "$COMMIT_SHA"` with `WRANGLER_OUTPUT_FILE_PATH` set, reads the deployment's URL from that output, and writes it to `dist/deploy-<env>.url`, to `$GITHUB_OUTPUT` as `url` and to `$GITHUB_STEP_SUMMARY` when those are set. Branch: `pr-<PR_NUMBER>` for `dev`, `staging` for `staging`, `main` for `prod`. Needs `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and `COMMIT_SHA` (the commit the bundle was built from, below); fails with a plain message if any is missing. |
| `make smoke ENV=<env>` | `scripts/smoke.sh` with `curl` against `BASE_URL`, or the address in `dist/deploy-<env>.url`: `/` answers 200 and contains "Hello World"; `/this-page-does-not-exist` and `/no/such/page` answer 404; `/` carries a `Content-Security-Policy` header. |
| `make help` | Lists the targets. |

The published address is the deployment's **unique URL** (`<hash>.<project>.pages.dev`), not the branch alias, so the address belongs to one commit, as the flow's "evidence belongs to a version" asks.
For a pull request that commit is the **PR's head commit**, not the merge commit GitHub creates (see CI below); for a push to `main` it is the pushed commit.
The project's `pages.dev` subdomain is not assumed: Cloudflare adds a suffix when the name is taken, so the scripts always read the address from wrangler's output.

## Environments

- **Dev/test, per PR:** a Pages preview deployment on branch `pr-<n>`. CI deploys it on every push to the PR, and publishes its address as a GitHub deployment on the environment `pr-<n>` (the job's `environment.url`), which shows on the PR and is what the driver reads in M5, and in the job summary.
- **Staging and prod:** `make deploy ENV=staging` and `ENV=prod` already work, with the same bundle. Wiring them into CI, and making staging private (Cloudflare Access), is the release work of the flow's v2 and is not in this pull request.

### CI

`.github/workflows/ci.yml`, with `permissions: contents: read` at the top, actions pinned to their current major versions, and one concurrency group per PR that cancels superseded runs.

**Which commit.** On `pull_request` events, `github.sha` and the default `actions/checkout` ref are the synthetic merge commit (`refs/pull/<n>/merge`), which exists only on GitHub and changes whenever `main` moves.
The workflow does not use it.
It sets one workflow-level variable, `COMMIT_SHA: ${{ github.event.pull_request.head.sha || github.sha }}`, and every job checks out `ref: ${{ env.COMMIT_SHA }}`.
So on a PR, CI checks, packages, deploys and accepts the PR's head commit, the commit the driver pushed and records evidence against; on a push to `main`, it is the pushed commit.
The artifact is `site-${COMMIT_SHA}`, `make deploy` passes the same value to `--commit-hash`, and the job summary prints it beside the address.
What this gives up is testing the PR merged with the current `main`. Branch protection closes that gap by requiring the branch to be up to date with `main` before merging (below), so the tree that was tested is the tree that merges.

1. **`check`** (pull requests, and pushes to `main`): checkout of `COMMIT_SHA`, `actions/setup-node` from `.nvmrc` with the npm cache, `make setup`, `make check`, `make package`, then upload `dist/` as the artifact `site-<COMMIT_SHA>`.
2. **`deploy-dev`** (pull requests only, after `check`): environment `pr-<n>` with `url` from the deploy step's output. Checkout of `COMMIT_SHA`, setup-node, `make setup`, download `site-<COMMIT_SHA>` into `dist/`, `make deploy ENV=dev` (the only step given the two Cloudflare secrets), `make smoke ENV=dev`. Exposes the address and `COMMIT_SHA` as job outputs.
3. **`acceptance-dev`** (after `deploy-dev`): checkout of `COMMIT_SHA` (for the frozen tests), setup-node, `make setup`, `make acceptance` with `BASE_URL` set to that address.

The three job names are the PR's checks: CI green, the address, and validation against the deployed version.

### What the owner sets up once

- A Cloudflare account; an API token with the account permission **Cloudflare Pages: Edit**; the organization secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in `agentic-orc-farm`, available to this repository. This is the manual step the plan's M4 decision expects, and it serves every later static project.
- Branch protection on `main` (GITHUB.md 8, "from the day the repository is created"), requiring the three checks and requiring branches to be up to date before merging (CI tests the head commit, not the merge commit). Agents cannot touch the forge, so this is the owner's or the driver's.

## Increments

None: the request fits one pull request, and that pull request is already the barest real thing, deployed and validated end to end.

## Existing behaviour

The repository holds only a one-line README and this design, so no criterion of kind `existing` has anything to protect.
The criteria that guard what later changes could break (the 404 status, offline, no inline script) are written as `new` here and stay in the frozen suite for every later change.

## Decision records

- `docs/adr/0001-plain-static-site-no-build.md`: plain HTML and CSS, no build, no runtime dependencies, development tooling through npm behind `make`.
- `docs/adr/0002-cloudflare-pages-direct-upload.md`: Cloudflare Pages by direct upload from CI, a preview per PR, one bundle for every environment.

## What I could not verify

- That Pages answers a custom `404.html` with status 404: Cloudflare's page on serving Pages describes the custom page but not its status. Widely relied on, and AC7 and `make smoke` check it on the first deploy.
- That `_headers` rules apply to preview deployments and to 404 responses. AC12 asks for the header on the home page only, for that reason; the smoke test checks it on the deployed preview.
- The exact field names in wrangler's ND-JSON output for `pages deploy`. Cloudflare's changelog (2025-11-03) says `pages deploy` writes it, but does not show the format; `deploy.sh` must read it from a real run and fail loudly if no URL is found.
- That `wrangler pages dev` applies `_headers` and the 404 page locally exactly as the host does. If it does not, the deployed run still catches it; the local copy then needs a small Node static server instead.
- That Chromium reports installability errors over the DevTools protocol in headless mode. If it does not, the installability test runs headed under `xvfb-run` in CI.
- That Pages serves the top-level `404.html`, with status 404, for an unknown nested path such as `/no/such/page`. Cloudflare's documentation says it looks for the nearest `404.html` up the directory tree; AC7 and `make smoke` check it.
- What `Cache-Control` Pages sends for static assets. The worker's network-first fetch goes through the browser's HTTP cache, so a long `max-age` would let a stale file be served online; if the first deploy shows one, `_headers` sets `Cache-Control: no-cache` for `/*`.
- That the offline tests really cut the worker's network. `context.setOffline(true)` has a record of not applying to service-worker fetches in Chromium (Playwright issue 2311, closed without a fix), and Playwright's documentation of `setOffline` does not mention service workers either way. The design does not rely on it: it adds `context.route` aborts, which Playwright's 1.57 release notes and its service-worker guide say reach worker-owned requests in Chromium. I have not run this. The offline test's own check that at least one worker request was aborted, and the break check that removes a precache entry, show on the first run whether it works.
- How Workers static assets behave in Version URLs and Previews. Cloudflare's direction is Workers with static assets, and Pages appears to be in maintenance rather than scheduled for shutdown; I found no dated end for Pages. ADR 0002 says when to revisit.

## Changes after review (round 2)

- **F1:** the service worker is network-first with a cache fallback, so content changes need no cache version; the hand-kept precache list is guarded by an offline e2e check that fails on any failed request (ADR 0001).
- **F2:** CI builds, deploys and accepts the PR's head commit (`github.event.pull_request.head.sha`), not GitHub's merge commit; one `COMMIT_SHA` names the checkout, the artifact and `--commit-hash`, and branch protection requires up-to-date branches.
- **F3:** every asset URL is root-absolute; AC7 also checks a nested unknown path and that the 404 page's stylesheets load.
- **F4:** no type-checking comments is recorded as a departure from UI.md 3's default, in the stack table and in `AGENTS.md`.
- **F5:** AC9 is split into AC9 (manifest and icons) and AC13 (service worker active); AC12 into AC12 (CSP header) and AC14 (no inline script or handlers). Existing IDs keep their meaning, so the new ones are appended.

## Changes after review (round 3)

- **F6:** a new section, "Turning the network off in the tests", says how the offline e2e test and the AC10 acceptance test cut the network for both the page and the worker (`context.setOffline(true)` plus a `context.route` that aborts every request, which since Playwright 1.57 reaches the worker's own fetches in Chromium), counts failures only among the page's requests (skipping those where `request.serviceWorker()` is set), and fails if no worker request was aborted. Playwright is pinned at 1.57 or later. A new "Break checks" section requires removing a precache entry and seeing the offline test fail. AC10's text now says the network is off for the page and its worker; its meaning is unchanged. ADR 0001's "What enforces it" and "What I could not verify" say the same.
