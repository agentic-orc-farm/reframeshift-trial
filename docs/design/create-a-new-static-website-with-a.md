---
title: A static holding page with a hero "Hello World", and the project's first conventions
size: large            # a new project: stack, conventions, CI and dev/test environment
acceptance_tests: tests/acceptance/
# Draft criteria. They hold for every option below; the design pass confirms them.
criteria:
  - id: AC1
    kind: new
    text: The home page at "/" answers with HTTP 200 and has exactly one level-one heading, which reads "Hello World".
  - id: AC2
    kind: new
    text: The "Hello World" heading is inside the page's main landmark and is fully visible without scrolling at viewport sizes 320x568, 768x1024 and 1440x900.
  - id: AC3
    kind: new
    text: The "Hello World" heading's computed font size is at least twice the computed font size of the page's body text, at all three viewport sizes.
  - id: AC4
    kind: new
    text: At 320 pixels wide the home page and the 404 page do not scroll horizontally (the document's scroll width is no wider than the viewport).
  - id: AC5
    kind: new
    text: An automated accessibility audit (axe, WCAG 2.2 A and AA rules) reports no violations on the home page or the 404 page.
  - id: AC6
    kind: new
    text: With JavaScript disabled, the home page still shows the "Hello World" heading.
  - id: AC7
    kind: new
    text: A request for an unknown path answers with HTTP 404 and shows the site's own 404 page, which has a link back to the home page.
  - id: AC8
    kind: new
    text: On the 404 page, pressing Tab from the start of the page puts keyboard focus on a link to the home page, and the focused link shows a visible focus indicator.
  - id: AC9
    kind: new
    text: The home page links a web app manifest with a name, a start URL and icons of 192 and 512 pixels, and registers a service worker.
  - id: AC10
    kind: new
    text: After one visit with the network on, reloading the home page with the network off still shows the "Hello World" heading.
  - id: AC11
    kind: new
    text: The home page's document has a lang attribute, a non-empty title, a viewport meta tag and a meta description.
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
