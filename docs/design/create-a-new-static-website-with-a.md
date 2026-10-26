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
The result is responsive and accessible, and goes through the normal workflow: a pull request, CI on every push, review, then one private dev/test deployment of the reviewed commit, with an address, and validation there.

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

The orchestrator picked **A, Cloudflare**: it is the only option that gives a dev/test address with a real 404 status and real response headers, so AC7 and the security baseline are validated in dev/test, and one immutable bundle is promoted between environments.
It asked the design to prefer Pages direct upload over Workers Previews unless the latter's static-asset behaviour could be confirmed, and rounds 2 to 5 designed the project's own Pages wiring.

The owner then changed how deploying works (round 6, the framework's ADR 0012): **projects no longer deploy themselves.**
The `cloudflare` plane (`agentic-orc-farm/cloudflare`) provisions and deploys every Cloudflare component, from the project's `deploy.yaml`.
Option A still holds, because the plane is on Cloudflare; what changes is everything about how the site gets there:

- The host is the plane's `static-site` kind: **a Worker with static assets**, not a Pages project. The orchestrator's preference for Pages is overtaken: Pages direct upload is not in Cloudflare's public API, and the plane offers only Workers. Its doubt about Workers Previews is moot, because the plane turns previews off and gives each environment its own Worker at a fixed address.
- The project holds **no Cloudflare configuration, no wrangler, no deploy credentials and no `make deploy`**. Where the options above mention `make deploy ENV=`, wrangler, a Cloudflare token as an organization secret or a preview per PR, ADR 0006 and the sections below supersede them.
- Dev/test and staging are private behind Cloudflare Access, which the plane sets up; the project only reaches them, with the organisation's read-only Access service token.

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

And one file at the repository root that says what is deployed, and where:

```yaml
# deploy.yaml
components:
  - name: site
    kind: static-site
    plane: cloudflare
    artefact: site
```

Every URL in the pages and the manifest is **root-absolute** (`/styles.css`, `/icons/icon-192.png`, `/register-sw.js`), never relative.
The host serves the top-level `404.html` for an unknown path at any depth, so a relative `styles.css` on the 404 page would resolve to `/no/such/styles.css` and the page would load unstyled; AC7 checks a nested path for that reason.

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
/*
  Content-Security-Policy: default-src 'self'; base-uri 'none'; object-src 'none'; form-action 'none'; frame-ancestors 'none'
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
```

`default-src 'self'` covers scripts, styles, images, the manifest and the worker; nothing is inline, so nothing needs `'unsafe-inline'`.
`_headers` is part of the site, not platform configuration: it is a plain-text file in the artefact, in a format several static hosts read, and the plane serves the artefact as it is.
Workers static assets parse it and do not serve it as a file.

Two traps for the build, known in advance, both from how Workers static assets serve files (the plane sets `not_found_handling` to `404-page` and leaves `html_handling` at its default, `auto-trailing-slash`):

- **`.html` URLs redirect**: `/contact.html` answers 307 to `/contact`, and `/index.html` is expected to redirect to `/`. The service worker must precache only URLs that answer 200 with no redirect (`/`, the stylesheets, the scripts, the manifest, the icons), or `cache.addAll` rejects and the worker never installs. Do not precache `/index.html` or the 404 page.
- **The 404 page is a file the site must ship**: with `404-page` handling, the nearest `404.html` is served with status 404 for any path that does not exist. Without it, an unknown path gets a bare 404. The `404.html` file is what makes AC7 pass, and AC7 is what proves it.

## Deploying (ADR 0006)

**What the project does:** it packages and validates; it never deploys.

- `make package` copies `site/` to `dist/site/` and writes `dist/site/version.txt` holding the commit's full SHA. Nothing else changes; there is no build.
- CI uploads `dist/site/` as the Actions artefact named **`site`**, the name in `deploy.yaml`, for the commit it packaged. The folder is the artefact's root: `index.html` sits at the top of the zip, not inside a folder or a tarball, because the plane unpacks the zip and serves what it finds there as it is.
- When the driver asks, CI validates the deployed address with `make smoke` and `make acceptance`, sending the Access headers.

**What the plane does** (from its README, `agentic-orc-farm/cloudflare`): when the driver dispatches its `deploy` workflow with this project, a commit, an environment and the `deploy.yaml` entries, it finds the newest unexpired artefact named `site` for that commit, deploys it as the Worker `reframeshift-trial-site-<env>` at `https://reframeshift-trial-site-<env>.<account subdomain>.workers.dev`, puts Access in front of dev and staging, and reports the address.
At the design gate the driver asks it for a `plan` against dev, which shows what it would create.

**Why `static-site` on `cloudflare`:** it is the only kind the only plane offers today, and it is what the site needs.
It serves a folder as it is (no code, which the site has none of), serves `404.html` with status 404 for any missing path (AC7), reads `_headers` (AC12), puts dev and staging behind Access and leaves prod public, which is the flow's "only prod is public".
The Worker names fit the plane's 63-character limit: the longest, `reframeshift-trial-site-staging`, is 31.

### When CI packages

`ci.yml` packages on every push, after the checks pass, and uploads the `site` artefact.
The flow's step 8 says CI packages "when the driver asks for the reviewed commit"; here the driver's step 8 is to confirm that the `site` artefact exists for the reviewed commit, which it will, because that commit passed CI.
This is lighter than a second trigger for packaging: packaging copies a folder of a few kilobytes, holds no secret, and deploys nothing; the artefact expires with the repository's retention setting (90 days by default).
A failed check run uploads nothing, because packaging comes after `make check` in the same job, and the plane would otherwise take an artefact from a run whatever its outcome.

The plane matches the artefact to the commit by the run's `head_sha`, which for a pull request run is the pull request's head commit, not GitHub's synthetic merge commit.
So `ci.yml` checks out `COMMIT_SHA` = `${{ github.event.pull_request.head.sha || github.sha }}` and packages that, so the artefact's contents are the commit the plane will name; the driver brings the branch up to date with `main` before review, so that commit is the one that would merge.

### How the driver asks for validation

After the plane reports the address, the driver pushes one lightweight tag at the deployed commit, with the GitHub App's token:

```
validate/<env>/<sha>/<host>
e.g. validate/dev/1cfd3a4.../reframeshift-trial-site-dev.example.workers.dev
```

That push starts `.github/workflows/validate.yml`, and only that workflow.
A tag carries both what the driver knows (the commit and the address) and nothing else.
`workflow_dispatch` is not used, although it reads more naturally, because GitHub dispatches only a workflow whose file is on the default branch; on this first pull request `main` holds only the README, so validation before merge would need the owner to copy the file to `main` by hand.
A tag push runs the workflow file in the tagged commit.

- `make validate-request` checks the tag before anything else runs: four parts; the environment is `dev`, `staging` or `prod`; the SHA equals the checked-out commit; the host is a plain DNS name (lowercase letters, digits, dashes and dots). It writes `env` and `base_url` (`https://<host>`) to `$GITHUB_OUTPUT`. Any other tag under `validate/` fails the run with a message naming the rule.
- A commit validated again after a host outage is a re-run of the workflow run, not a new tag. A fixed commit after a failed validation has a new SHA, so it gets a new tag.
- Tags under `validate/` are requests, not releases; release tags (GITHUB.md 6) will be `v*`. Nothing cleans them up until they cause friction.
- The project knows nothing of how the address is formed: it validates whatever host the driver names.

### CI

Both workflows set `permissions: contents: read` at the top, pin actions to their current major versions, and call only `make` targets.

**`ci.yml`, on `pull_request` and on `push` to `main`:** one job, **`check`**.
It checks out `COMMIT_SHA`, then `actions/setup-node` from `.nvmrc` with the npm cache, `make setup`, `make check`, `make package` (with `COMMIT_SHA`), then `actions/upload-artifact` with `name: site`, `path: dist/site/` and `if-no-files-found: error`.
One concurrency group per ref cancels superseded runs.
It references no secret.
Its `push` filter names only branches, so request tags do not start it.

**`validate.yml`, on `push` of tags matching `validate/**` only:** one job, **`validate`** (the flow's step 10), checking out `${{ github.sha }}`, the tagged commit.
Setup-node, `make setup`, `make validate-request` (with `VALIDATE_REQUEST: ${{ github.ref_name }}` and `COMMIT_SHA`), then `make smoke ENV=<env>` and `make acceptance`, each with `BASE_URL`, `COMMIT_SHA` and the organisation secrets `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET`, which only these two steps receive.
The frozen acceptance tests come from the tagged commit's own checkout.
One concurrency group per tag.

No workflow references any other secret, and none packages anything but the commit it checked out.

### Environments

| Environment | Where | Who can see it | When it is deployed |
|---|---|---|---|
| Dev/test | The Worker `reframeshift-trial-site-dev` on workers.dev | The owner, signed in through Cloudflare Access with a one-time PIN to the plane's owner email; CI, with the organisation's Access service token | Once per feature, when the driver asks the plane, for the commit that passed review |
| Staging | The Worker `reframeshift-trial-site-staging` | As dev/test | On every merge, in the flow's v2 |
| Prod | The Worker `reframeshift-trial-site-prod` | Everyone: the only public environment | After the owner's release decision, in the flow's v2 |

Each environment has one fixed address, so the address does not identify a commit.
`version.txt` does: `make smoke` fails unless `/version.txt` on the deployed address holds the commit being validated, so a validation never passes against an earlier deployment, for example after a cancelled or failed plane run, or a second feature's deploy to the same dev Worker.

### Reaching the private environments in tests

The plane puts Access in front of the dev and staging Workers; a request without the service token's headers is sent to the login page.
Both targets read `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` from the environment, which CI fills from the organisation secrets of the same names. The project holds no other Cloudflare credential.

**`make smoke`** sends `CF-Access-Client-Id` and `CF-Access-Client-Secret` with every `curl` request when the two variables are set.

**`make acceptance`**, when `BASE_URL`, `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` are all set, `playwright.config.js`:

- sets `use.extraHTTPHeaders` to the two headers, so every request the page and the `request` fixture make carries them;
- runs `tests/support/access-setup.js` as `globalSetup`: it requests `BASE_URL` with the headers, fails with a plain message ("could not reach <address> through Cloudflare Access with the service token") unless the answer is 200 and a `CF_Authorization` cookie came back, and saves the storage state to `.auth/access.json`;
- sets `use.storageState` to that file, so every browser context also starts with the Access cookie.

The cookie is for the service worker: its install-time precache and its network-first fetches are its own requests, which carry the browser's cookies, and Playwright's documentation does not say that `extraHTTPHeaders` reach a worker's own requests.
Without either, the worker's precache would be sent to the login page, the worker would never install, and AC10 and AC13 would fail against dev/test only.
With none of the three variables set (the local copy), the config does none of this.

One rule for the test agent, because it writes the acceptance tests and not the config: use Playwright's own fixtures (`page`, `context`, `request`), and change settings for a test with `test.use({...})`, never with a hand-made `browser.newContext()`. A hand-made context would carry neither the headers nor the cookie, and the test would pass locally and fail against dev/test for a reason unrelated to the site.

### What the owner sets up

Nothing for this project.
The Cloudflare account, the Access service token and the organisation secrets are the plane's one-time set-up, in its README, and serve every project.
The organisation secrets reach only public repositories on GitHub Free; project repositories are public until the organisation moves to a paid plan (the framework's flow), so this one is.

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
Against dev/test, step 1 also depends on the Access cookie (see "Reaching the private environments in tests"): without it the worker's precache requests would be sent to the Access login and the worker would never install.
Playwright is pinned at 1.57 or later in `package.json` for this reason, and `PLAYWRIGHT_DISABLE_SERVICE_WORKER_NETWORK` must not be set anywhere.

If the break check below shows the method does not reach the worker on the Playwright in use, the fallback for `tests/e2e/offline.spec.js` is to stop the local server (`scripts/serve.mjs`, started by the test on a free port) before the reload; AC10 against a deployed address would then keep the route method, and the design would need revisiting.

## Break checks

Before the pull request is marked ready, the engineering step introduces each fault below, runs the named check, confirms it fails, and reverts the fault.
A check that still passes with its fault in place is not testing what it claims.

| Fault | Check that must fail |
|---|---|
| Remove one entry (`/styles.css`) from the worker's precache list | `make test` (`tests/e2e/offline.spec.js`) |
| A platform tool in the project: add `wrangler` to `devDependencies` | `make check-deps` |
| A deploy credential in the project: add a workflow step that references `secrets.CLOUDFLARE_API_TOKEN` | `make check-deps` |
| A dev/test address left public: run `make smoke ENV=dev` against the local copy (`make dev`, which has no login), with `BASE_URL=http://localhost:8788` | `make smoke` fails on the privacy check |
| Validating the wrong deployment: `make package` with `COMMIT_SHA` set to one SHA, serve `dist/site` (`SITE_DIR=dist/site make dev`), run `make smoke ENV=prod` with `BASE_URL=http://localhost:8788` and `COMMIT_SHA` set to another | `make smoke` fails on the version check |
| A malformed request: `make validate-request` with `VALIDATE_REQUEST=validate/dev/<another sha>/example.workers.dev` | `make validate-request` |

## The stack

| Concern | Choice | Standard |
|---|---|---|
| Pages | Plain HTML and CSS, no framework, no components | Follows UI.md 1 and 3 (plain HTML and CSS when there are no components). |
| Language | None beyond two short plain JavaScript files (`register-sw.js`, `sw.js`) in the site, with no type-checking comments; Node scripts for the tooling | **Departs** from UI.md 3's default for very small pages (plain JavaScript *with* type-checking comments), because there is no logic worth typing: checking the comments would add TypeScript as a dev dependency and a `tsc` step for about 35 lines of event handlers. Recorded in `AGENTS.md` as the project's one difference. Revisit when a script gains real logic. |
| Build | None: `make package` copies `site/` to `dist/site/` and adds `version.txt` | Follows UI.md 3 ("no build for a static page that does not need one"). There is no `make build`; UI.md lists it "if there is a build". |
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
| Dependency and platform check | `scripts/check-deps.mjs`: fails if `package.json` has any `dependencies`; if a framework or CSS framework (react, vue, svelte, angular, preact, lit, solid-js, tailwindcss, bootstrap and the like) is among the direct dependencies; if a platform tool (`wrangler`, `miniflare`, anything under `@cloudflare/`) is; if a `wrangler.toml`, `wrangler.json` or `wrangler.jsonc` exists anywhere tracked; or if any workflow references a secret other than `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` | Follows UI.md 1 and 4, and enforces ADR 0006 (no platform tool, configuration or deploy credential in the project). |
| Local server | `scripts/serve.mjs`, about 60 lines on `node:http` with no dependency: serves `site/` (or `SITE_DIR`); `/` is `index.html`; an unknown path answers `404.html` with status 404; `_headers` is applied for its `/*` rule and never served; the server refuses to start if `_headers` has a rule for any other path, so the local copy cannot silently differ from the host | No standard covers it. Wrangler's local server would match the host more closely, but the project may hold no platform tool (ADR 0006). The deployed acceptance run is what proves the two agree. |
| Hosting | The `cloudflare` plane's `static-site`, declared in `deploy.yaml` | ADR 0006. GITHUB.md 7: "who deploys is a per-project decision that the project records"; here a separate deployment tool takes the artifact and a target, which is the direction GITHUB.md names. |
| Private dev/test and staging | Cloudflare Access, set up by the plane; tests send the organisation's read-only service token as headers | ADR 0006. Follows the flow's "only prod is public"; the plane owns the tool. |
| Credentials | Only `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET`, organisation secrets, passed to the smoke and acceptance steps of `validate.yml` alone | Follows GITHUB.md 7 ("only the job that needs one gets it") and the flow's "no deploy credentials in projects". |
| CI | GitHub Actions, calling only `make` targets: `ci.yml` checks and packages every push; `validate.yml` validates on request | Follows GITHUB.md 7 and UI.md 2. |

What this rejects as heavier: Vite, TypeScript, Vitest, Web Components, a service-worker library (Workbox), a CSS framework, a static-server dependency. None is needed for two static pages and fourteen criteria.

## Standards in the project

Set up copies the standards that apply into the project, as the flow asks: `docs/standards/UI.md` and `docs/standards/GITHUB.md`, version 2 draft, unchanged.
`AGENTS.md` at the root states the project's conventions in a few lines: `make` is the only way to run anything; `site/` is served as it is and has no runtime dependencies; colours and spacing come from `tokens.css`; `tests/acceptance/` belongs to the test agent and is never edited by the engineering agent; `deploy.yaml` belongs to the design agent; commits are `area: what changed` with no AI trailers (GITHUB.md 3); the project never deploys: the `cloudflare` plane deploys what `deploy.yaml` names, and the project holds no platform configuration, platform tool or deploy credential (ADR 0006); CI validates only on a `validate/<env>/<sha>/<host>` request tag; dev/test and staging are private behind Cloudflare Access and only prod is public; it follows the vendored standards with one recorded difference: the two JavaScript files carry no type-checking comments, departing from UI.md 3's default, because they hold no logic worth typing.
`.gitignore` covers GITHUB.md 8's list, plus `test-results/`, `playwright-report/`, `.lighthouse/` and `.auth/` (the Access state the tests save).

## Project layout

```
deploy.yaml           what is deployed and where (design agent only)
site/                 the bundle (above)
tests/acceptance/     the test agent's frozen acceptance tests, one file per page or concern
tests/e2e/            the engineering agent's own checks: installability, page weight, offline with no failed request, headers file present
tests/support/        access-setup.js: the Playwright global setup that saves the Access cookie (engineering's, not the test agent's)
scripts/              check-deps.mjs, lighthouse.mjs, serve.mjs, smoke.sh, validate-request.sh
playwright.config.js  baseURL from BASE_URL; when it is unset, a webServer that runs scripts/serve.mjs on port 8788; the Access headers and cookie when their variables are set
package.json, package-lock.json, .nvmrc, .htmlvalidate.json, .stylelintrc.json
Makefile
.github/workflows/ci.yml        checks and packages every push
.github/workflows/validate.yml  smoke and acceptance against a deployed address, only on a request tag
AGENTS.md, README.md, docs/standards/, docs/design/, docs/adr/
```

## The make targets

| Target | What sits behind it |
|---|---|
| `make setup` | `npm ci`, then `npx playwright install chromium` (with `--with-deps` when `CI` is set). |
| `make check` | `check-html`, `check-css`, `check-deps`, `check-lighthouse`, then `make test` and `make acceptance` (local). Fails if any fails. |
| `make check-html` | `html-validate site/*.html`. |
| `make check-css` | `stylelint "site/**/*.css"`. |
| `make check-deps` | `node scripts/check-deps.mjs` (dependencies, frameworks, platform tools, wrangler configuration and workflow secrets; above). |
| `make check-lighthouse` | Starts the local copy, runs `node scripts/lighthouse.mjs` against `/` and the 404 page, fails below 95 in performance, accessibility or best practices, stops the server. |
| `make test` | `playwright test tests/e2e` against a local copy. |
| `make acceptance` | `playwright test tests/acceptance`; against `BASE_URL` when it is set, otherwise Playwright's `webServer` starts the local copy. When `BASE_URL`, `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` are all set, every request carries the two Access headers and every browser context the Access cookie ("Reaching the private environments in tests"). |
| `make dev` | `node scripts/serve.mjs` on port 8788, serving `SITE_DIR` (default `site`). |
| `make package` | Removes `dist/site/`, copies `site/` to it, and writes `dist/site/version.txt` holding `COMMIT_SHA` (required when `CI` is set; otherwise `git rev-parse HEAD`). Fails if `dist/site/index.html` or `dist/site/404.html` is missing. CI uploads `dist/site/` as the artefact `site`; nothing is rebuilt after this. |
| `make smoke ENV=<env>` | `scripts/smoke.sh` with `curl`, against `BASE_URL` (required). With the two Access headers when `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` are set: `/` answers 200 and contains "Hello World"; `/this-page-does-not-exist` and `/no/such/page` answer 404; `/` carries a `Content-Security-Policy` header; when `COMMIT_SHA` is set, `/version.txt` holds exactly it. Then the privacy check, with no headers and no redirect following: for `dev` and `staging`, `/` must answer a redirect to a `cloudflareaccess.com` address, a 401 or a 403, never 200; for `prod`, `/` must answer 200 and contain "Hello World". |
| `make validate-request` | `scripts/validate-request.sh`: checks `VALIDATE_REQUEST` against `COMMIT_SHA` (above) and writes `env` and `base_url` to `$GITHUB_OUTPUT`, or prints them when it is unset. |
| `make help` | Lists the targets. |

There is no `make deploy`: what the project deploys, and where, is `deploy.yaml` (the framework's ADR 0012).

## Increments

None: the request fits one pull request, and that pull request is already the barest real thing, deployed by the plane and validated end to end.

## Existing behaviour

The repository holds only a one-line README and this design, so no criterion of kind `existing` has anything to protect.
The criteria that guard what later changes could break (the 404 status, offline, no inline script) are written as `new` here and stay in the frozen suite for every later change.
The acceptance criteria do not change in this round: none of them depended on how the site is deployed, only on what the deployed site does.

## Decision records

- `docs/adr/0001-plain-static-site-no-build.md`: plain HTML and CSS, no build, no runtime dependencies, development tooling through npm behind `make`. Amended by 0006 (no wrangler; the local server is `scripts/serve.mjs`; `make package` adds `version.txt`).
- `docs/adr/0002-cloudflare-pages-direct-upload.md`: Cloudflare Pages by direct upload, as first decided. Superseded by 0005; kept as it was.
- `docs/adr/0003-deploy-on-a-request-tag.md`: CI deploys on a `deploy/dev/<sha>` request tag. Superseded by 0006; kept as it was.
- `docs/adr/0004-private-previews-behind-cloudflare-access.md`: Pages previews behind a project-configured Access application. Superseded by 0006; kept as it was.
- `docs/adr/0005-pages-environments-and-deploy-credentials.md`: Pages branch aliases and deploy credentials in a GitHub environment. Superseded by 0006; kept as it was.
- `docs/adr/0006-deploy-through-the-cloudflare-plane.md`: supersedes 0003, 0004 and 0005. The project packages and validates and never deploys; `deploy.yaml` names one `static-site` on the `cloudflare` plane; the artefact `site` is uploaded by `ci.yml` from the head commit; validation runs on a `validate/<env>/<sha>/<host>` request tag with the organisation's read-only Access service token as its only credential.

## What I could not verify

- **That the plane is ready.** Its repository's `main` holds one commit; the plane is built in its pull request #1, which the owner approved on 2026-10-23 and which was still a draft when I read it. This design follows that branch's README and code (`static_site.py`, `artefacts.py`, ADR 0004 of the plane). If the plane changes before it merges, the design-time `plan` shows it.
- **That `_headers` reaches the deployed site.** Cloudflare's Workers static assets documentation says a `_headers` file in the assets directory is parsed and applied to static asset responses and not served. The plane's README does not mention `_headers`, and its configuration sets only `directory` and `not_found_handling`, so I expect wrangler to pick the file up from the folder, but I have not seen it run. AC12 and `make smoke` check it on the first deploy. If it does not apply, AC12 cannot be met by a meta tag (it asks for a header), and the design would be blocked on a change to the plane.
- **Whether `_headers` rules apply to the `404-page` response.** The documentation says "static asset responses" and does not mention `not_found_handling`. AC12 asks for the header on the home page only, for that reason.
- **That `/index.html` redirects to `/`.** Cloudflare's `html_handling` page shows `/folder/index.html` answering 307 to `/folder` but has no root example. The design never requests `/index.html`, so it only matters for the precache rule, which already excludes it.
- **That the plane's Access application returns a `CF_Authorization` cookie to a request with the service token's headers.** Cloudflare's service token pages say a valid token gets a cookie unless strict service token authentication is on; the plane's application settings (`access_application` in its `static_site.py`) do not set it. The global setup fails with a plain message if no cookie comes back. The fallback then is header injection by route: a fixture in `tests/support/` that calls `context.route('**/*', route => route.continue({ headers: { ...route.request().headers(), <the two headers> } }))`, which since Playwright 1.57 reaches the worker's own requests in Chromium; the acceptance tests would import `test` from it, which changes the rule for the test agent, so it goes back to the owner.
- **Whether `extraHTTPHeaders` reach a service worker's own requests** in Chromium. The design does not rely on it; the cookie covers the worker.
- **That an artefact uploaded by a `pull_request` run carries the pull request's head SHA as its run's `head_sha`**, which is what the plane matches on. GitHub shows pull request runs against the head commit and its documentation of `workflow_run.head_sha` agrees in effect; the driver's first deploy request shows it, and the plane fails with "no artefact named site for commit ..." if not.
- **That `actions/upload-artifact` puts the folder's contents at the zip's root** when `path` is one directory. Its documentation says the least common ancestor of the paths becomes the root. `make package`'s output has no hidden files, so the action's default of leaving them out changes nothing.
- **What `Cache-Control` Workers static assets send.** The worker's network-first fetch goes through the browser's HTTP cache, so a long `max-age` would let a stale file be served online; I believe the default revalidates every time but did not confirm it. If the first deploy shows a long one, `_headers` sets `Cache-Control: no-cache` for `/*`.
- **That the local server matches the host.** `scripts/serve.mjs` implements only what the criteria touch (the 404 page and status, the `/*` headers); the same acceptance tests run against the deployed address, which catches a difference.
- **That the offline tests really cut the worker's network.** `context.setOffline(true)` has a record of not applying to service-worker fetches in Chromium (Playwright issue 2311, closed without a fix). The design adds `context.route` aborts, which Playwright's 1.57 release notes and its service-worker guide say reach worker-owned requests in Chromium. I have not run this. The offline test's own check that at least one worker request was aborted, and the break check that removes a precache entry, show on the first run whether it works.
- **That a tag pushed with a GitHub App installation token starts a `push` workflow**, and that the filter `validate/**` matches a tag with four parts. GitHub's events page says only that `GITHUB_TOKEN` pushes start nothing; App tokens are widely used for this, and `**` matches across `/`. The driver's first request shows both.
- **How the driver will ask for validation.** The driver's step 10 is M5 work and not yet built; this design proposes the request tag because it works on this first pull request. If the driver settles on another mechanism, `validate.yml`'s trigger and `make validate-request` are the only things that change.
- **That a dot-separated host is accepted in a tag name.** Git's ref-name rules forbid `..`, a component starting with `.`, `:` and a few other characters, none of which a workers.dev host contains.

## Changes after review (round 2)

- **F1:** the service worker is network-first with a cache fallback, so content changes need no cache version; the hand-kept precache list is guarded by an offline e2e check that fails on any failed request (ADR 0001).
- **F2:** CI builds, deploys and accepts the PR's head commit (`github.event.pull_request.head.sha`), not GitHub's merge commit; one `COMMIT_SHA` names the checkout, the artifact and `--commit-hash`, and branch protection requires up-to-date branches.
- **F3:** every asset URL is root-absolute; AC7 also checks a nested unknown path and that the 404 page's stylesheets load.
- **F4:** no type-checking comments is recorded as a departure from UI.md 3's default, in the stack table and in `AGENTS.md`.
- **F5:** AC9 is split into AC9 (manifest and icons) and AC13 (service worker active); AC12 into AC12 (CSP header) and AC14 (no inline script or handlers). Existing IDs keep their meaning, so the new ones are appended.

## Changes after review (round 3)

- **F6:** a new section, "Turning the network off in the tests", says how the offline e2e test and the AC10 acceptance test cut the network for both the page and the worker (`context.setOffline(true)` plus a `context.route` that aborts every request, which since Playwright 1.57 reaches the worker's own fetches in Chromium), counts failures only among the page's requests (skipping those where `request.serviceWorker()` is set), and fails if no worker request was aborted. Playwright is pinned at 1.57 or later. A new "Break checks" section requires removing a precache entry and seeing the offline test fail. AC10's text now says the network is off for the page and its worker; its meaning is unchanged. ADR 0001's "What enforces it" and "What I could not verify" say the same.

## Changes after the owner's review (round 4)

The owner asked for deploy and environments to follow the updated flow (the framework's ADR 0011): review before deploy, one deploy per feature, only prod public.

- **CI never deploys on a branch push.** `ci.yml` checks every push and does nothing else; packaging, deploying and validating moved to `deploy.yml`, which runs only when the driver pushes a `deploy/dev/<sha>` tag for the reviewed commit (ADR 0003). Its three jobs, `package`, `deploy` and `validate`, are the flow's steps 8 to 10. `make deploy` fails in CI without a request naming the commit.
- **Dev/test and staging are private.** Pages previews sit behind Cloudflare Access; the owner signs in by email, and CI signs in with a service token, in `curl` for smoke and in a Playwright global setup that saves the Access cookie so the service worker is signed in too (ADR 0004). `make deploy` refuses to deploy a preview unless Access is already in front of the project, and `make smoke` fails if the deployed address answers anyone not signed in. Prod, the production branch, is the only public address.
- **One `dev` environment, branch `dev`**, replaces the per-PR `pr-<n>` environments and branches; the address is still the deployment's unique URL, read by the driver by commit.
- `make deploy` no longer creates the Pages project; the owner does once with `make pages-project`, before turning Access on.
- The owner's one-time setup, the stack table, the layout, `AGENTS.md`, `.gitignore`, the break checks and ADR 0002 are updated to match. The acceptance criteria are unchanged.

## Changes after the owner's review (round 5)

- **Credentials in the `dev` environment (F9).** The Cloudflare API token and account ID and the Access service token's ID and secret move from organization secrets to secrets of the repository's GitHub environment `dev`, whose only deployment rule is tags matching `deploy/dev/*`. The `deploy` job names `dev`; the `validate` job names it with `deployment: false`, so the commit still has one deployment record; `package` names none. GitHub, not only review, now keeps the credentials from pull requests and branch pushes. ADR 0003's "What enforces it" says so; the owner's setup gains the environment step and the plan check.
- **The Access wildcard (F8).** ADR 0004's rejected alternative was wrong: **Enable access policy** creates exactly the self-hosted application on `*.<subdomain>`, and a wildcard does not match the bare `<subdomain>`, so prod stays public. ADR 0004 now says the setting creates that application, that it covers the branch aliases (so staging needs no second application), and that nobody edits its hostname; the rejected alternative is now hand-made per-alias applications. The deploy guard's fallback, probing the last preview deployment, is dropped because it cannot work on the first deploy; the guard probes a host under the wildcard and fails closed, and the replacement if that host is not intercepted is an API check of the Access application.
- **ADR 0002 restored and superseded.** ADR 0002 is back to its text as first committed, with only its status changed to "superseded by 0005". The revised hosting decision (branch aliases, the owner-created project, and now the environment secrets) is the new ADR 0005.
- The acceptance criteria are unchanged.

## Changes after the owner's review (round 6)

The owner changed how deploying works: projects no longer deploy themselves (the framework's ADR 0012).

- **`deploy.yaml`** at the repository root names one component: `site`, kind `static-site`, plane `cloudflare`, artefact `site`. The `cloudflare` plane provisions and deploys it as the Worker `reframeshift-trial-site-<env>` on workers.dev, with Access in front of dev and staging; prod is public.
- **Removed:** the Pages project and its wiring, wrangler, `make deploy`, `make pages-project`, `scripts/deploy.sh`, `deploy.yml`, the deploy request tag, the GitHub environment `dev` and its four secrets, the deploy-time Access guard and the owner's one-time set-up. The project holds no Cloudflare configuration, platform tool or deploy credential, and `make check-deps` now fails if one appears.
- **Packaging:** `make package` copies `site/` to `dist/site/` with a `version.txt`, and `ci.yml` uploads that folder as the artefact `site` for the head commit it checked out, after the checks pass.
- **Validation:** `validate.yml` runs `make smoke` and `make acceptance` when the driver pushes `validate/<env>/<sha>/<host>`; both send `CF-Access-Client-Id` and `CF-Access-Client-Secret` on every request, from the organisation secrets `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET`, and Playwright also keeps the Access cookie so the service worker gets in. `make smoke` checks `/version.txt`, because an environment's address no longer identifies a commit.
- **The local server** is `scripts/serve.mjs` instead of `wrangler pages dev`.
- **ADRs:** the new ADR 0006 supersedes 0003, 0004 and 0005 (0002 was already superseded by 0005); those keep their text with only their status changed. ADR 0001's status notes that 0006 amends its tooling list.
- The acceptance criteria are unchanged.
