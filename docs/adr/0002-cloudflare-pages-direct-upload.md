# 0002: Host on Cloudflare Pages, by direct upload from CI

Status: proposed
Date: 2026-10-20, revised 2026-10-21

## Context

A feature's dev/test deployment needs its own address where the frozen acceptance tests run against the deployed version, including a real 404 status (AC7) and response headers for the content security policy (AC12).
GITHUB.md 7 asks for one immutable artifact promoted between environments, not deployment by branch, with secrets only in CI.
The framework's flow (its ADR 0011) deploys dev/test once per feature, when the driver asks, and keeps every environment but prod private.
The framework's notes name Cloudflare as the target for static sites.

## Decision

- The site is hosted on Cloudflare Pages, project `reframeshift-trial`, production branch `main`.
- CI uploads the packaged bundle with `wrangler pages deploy` (direct upload). Cloudflare never builds from the repository.
- Dev/test is a preview deployment on the Pages branch `dev`, staging one on the branch `staging`, and prod the production branch `main`. Each gets the same bundle through `make deploy ENV=dev|staging|prod`.
- The address of a deployment is its unique URL, so it belongs to one commit.
- When CI deploys is ADR 0003; how the previews stay private is ADR 0004.
- The Cloudflare API token and account ID are organization secrets, given only to the deploy step.
- `make deploy` never creates the Pages project; the owner creates it once, before turning Access on, so no preview is ever deployed to a project without Access.

## Alternatives

- **Cloudflare Workers with static assets, and Previews or Version URLs.** Cloudflare's direction for new work, but its documentation does not say how static assets and the 404 page behave in a preview, so the check of AC7 in dev/test could not be relied on.
- **Pages with Cloudflare's Git integration.** Cloudflare builds each commit itself: no token in CI, but it is a second build outside CI, so the artifact CI tested is not the one served, and it deploys on every push, which the flow does not want.
- **GitHub Pages.** No outside account, but one site per repository, so features deploy into folders of a branch, the 404 page cannot be checked per feature, response headers cannot be set, and a site cannot be made private on the free plan.
- **The owner's local server over Tailscale.** Server infrastructure the request does not need.

## Consequences

- One manual owner step: a Cloudflare account, the Pages project, Access (ADR 0004) and four organization secrets. The account, the API token and the service token are reusable by later static projects.
- Pages appears to be in maintenance, with new features going to Workers. Revisit when Cloudflare announces an end date for Pages, or when its Workers documentation confirms static-asset and 404 behaviour in previews; the move is contained in `scripts/deploy.sh`, `scripts/smoke.sh` and the Access setup.
- Pages redirects `.html` URLs and treats a site without `404.html` as a single-page app; the design notes both.
- Every dev/test deployment stays reachable, behind Access, until it is deleted; nothing deletes old ones until they cause friction.

## What enforces it

CI: the only deploy path is `make deploy`, and the workflow gives the Cloudflare secrets to that step alone.
`make deploy` fails if the project does not exist.
`make smoke` fails if the deployed address does not answer an unknown path with 404 or lacks the CSP header, and the acceptance tests run against the deployed address.
Promotion of the same bundle (no rebuild) can only be reviewed: the review agent checks that the `deploy` job downloads the `package` job's artifact and builds nothing.
