# 0002: Host on Cloudflare Pages, by direct upload from CI

Status: superseded by 0005
Date: 2026-10-20

## Context

Every PR needs its own dev/test address where the frozen acceptance tests run against the deployed version, including a real 404 status (AC7) and response headers for the content security policy (AC12).
GITHUB.md 7 asks for one immutable artifact promoted between environments, not deployment by branch, with secrets only in CI.
The framework's notes name Cloudflare as the target for static sites.

## Decision

- The site is hosted on Cloudflare Pages, project `reframeshift-trial`, production branch `main`.
- CI uploads the packaged bundle with `wrangler pages deploy` (direct upload). Cloudflare never builds from the repository.
- Each PR deploys to a preview on branch `pr-<n>`; the deployment's unique URL is the PR's dev/test address, published as a GitHub deployment on environment `pr-<n>`.
- Staging and prod receive the same bundle through `make deploy ENV=staging|prod`.
- The Cloudflare API token and account ID are organization secrets, given only to the deploy step.

## Alternatives

- **Cloudflare Workers with static assets, and Previews or Version URLs per PR.** Cloudflare's direction for new work, but its documentation does not say how static assets and the 404 page behave in a preview, so the per-PR check of AC7 could not be relied on.
- **Pages with Cloudflare's Git integration.** Cloudflare builds each commit itself: no token in CI, but it is a second build outside CI, so the artifact CI tested is not the one served.
- **GitHub Pages.** No outside account, but one site per repository, so PRs deploy into folders of a branch, the 404 page cannot be checked per PR, and response headers cannot be set.
- **The owner's local server over Tailscale.** Server infrastructure the request does not need.

## Consequences

- One manual owner step: a Cloudflare account and two organization secrets, reusable by later static projects.
- Preview addresses are public. Acceptable for a holding page; staging, which the flow wants private, needs Cloudflare Access when the release work wires it up.
- Pages appears to be in maintenance, with new features going to Workers. Revisit when Cloudflare announces an end date for Pages, or when its Workers documentation confirms static-asset and 404 behaviour in previews; the move is contained in `scripts/deploy.sh` and the `make deploy` and `make smoke` targets.
- Pages redirects `.html` URLs and treats a site without `404.html` as a single-page app; the design notes both.
- Per-PR GitHub environments accumulate; cleaning them up is not built until it causes friction.

## What enforces it

CI: the only deploy path is `make deploy`, and the workflow gives the secrets to that step alone.
`make smoke` fails if the deployed preview does not answer an unknown path with 404 or lacks the CSP header, and the acceptance tests run against the deployed address.
Promotion of the same bundle (no rebuild) can only be reviewed: the review agent checks that the deploy job downloads the `check` job's artifact and builds nothing.
