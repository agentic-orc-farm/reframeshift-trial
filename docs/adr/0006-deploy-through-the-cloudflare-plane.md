# 0006: The cloudflare plane deploys the site; the project packages and validates

Status: proposed
Date: 2026-10-26
Supersedes: 0003, 0004 and 0005 (and, through 0005, 0002)
Amends: 0001

## Context

ADRs 0002 to 0005 had the project deploy itself: its own Cloudflare Pages project, wrangler, a deploy script, a request tag that started a deploy workflow, a project-configured Access application with a deploy-time guard, four credentials in a GitHub environment, and a list of one-time steps for the owner.
The framework then decided that projects no longer deploy themselves (its ADR 0012).
A plane, one repository per platform, provisions and deploys what a project's `deploy.yaml` names; the project builds and packages, and its CI validates; the driver decides when, and asks.
The `cloudflare` plane (`agentic-orc-farm/cloudflare`) offers one kind, `static-site`: a Worker with static assets and no code, named `<repo>-<component>-<env>` on the account's workers.dev subdomain, serving the artefact as it is, with `404.html` served with status 404 for any missing path, previews off, Cloudflare Access in front of dev and staging, and prod public.
It finds a component's artefact by name among the project's Actions artefacts, for the commit's `head_sha`, takes the newest unexpired one, and unpacks its zip as the Worker's assets folder.
Private environments are reached with one read-only Access service token, held as the organisation secrets `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET`.
The owner asked (round 6) to replace the project's deploy wiring with `deploy.yaml`, and to record it in a new ADR rather than rewrite the old ones.

The project's CI still has to package the reviewed commit and validate the deployed address (the flow's steps 8 and 10), and this pull request, which creates the workflows, must be validated before it merges, while `main` holds only a README.

## Decision

- **`deploy.yaml`** at the repository root names one component: `name: site`, `kind: static-site`, `plane: cloudflare`, `artefact: site`. It is the only description of where the site runs. Only the design agent changes it.
- **The project never deploys.** It holds no Cloudflare configuration (no `wrangler.toml` or `wrangler.json`), no platform tool (no wrangler, miniflare or `@cloudflare/` package), no deploy credential, no GitHub environment for deploying and no `make deploy`.
- **Packaging.** `make package` copies `site/` to `dist/site/` and adds `version.txt` holding the commit's full SHA. `ci.yml`, on every pull request push and every push to `main`, checks out the head commit (`github.event.pull_request.head.sha || github.sha`), runs `make check`, then `make package`, and uploads `dist/site/` as the artefact `site`, with the site's files at the zip's root. A run whose checks fail uploads nothing.
- **Validation on a request tag.** The driver asks for validation by pushing a lightweight tag `validate/<env>/<sha>/<host>` at the deployed commit, with the GitHub App's token. `validate.yml` runs only on tags matching `validate/**`; `make validate-request` refuses a tag whose SHA is not the checked-out commit, whose environment is not `dev`, `staging` or `prod`, or whose host is not a plain DNS name; then `make smoke ENV=<env>` and `make acceptance` run against `https://<host>`.
- **The only credential** is the Access service token. `make smoke` and `make acceptance` send `CF-Access-Client-Id` and `CF-Access-Client-Secret` on every request, from `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET`, which `validate.yml` passes to those two steps alone. Playwright also saves the Access cookie the headers earn, so a service worker's own requests get in.
- **Version check.** An environment has one fixed address, so `make smoke` fails unless `/version.txt` holds the commit being validated.
- **Privacy check.** `make smoke` fails if a `dev` or `staging` address answers a request without the headers with anything but a redirect to `cloudflareaccess.com`, a 401 or a 403, and if a `prod` address does not answer it with the page. The plane makes the environments private; the project checks that it did.
- **The site's own `_headers`** stays in the artefact. It is part of the site (its content security policy), not platform configuration.
- **Amends 0001:** wrangler leaves the development tooling, the local server is `scripts/serve.mjs` (no dependency), and the package is `site/` plus `version.txt`.

## Alternatives

- **Keep the project's own Pages wiring (0002 to 0005).** Every project would repeat its secrets, scripts and owner steps, and hold tokens that can change the platform. The framework rejects it (its ADR 0012).
- **`workflow_dispatch` for validation, with the commit and address as inputs.** The most direct "ask", and what the plane does for its own live tests, but GitHub dispatches only a workflow whose file is on the default branch, so this first pull request could not be validated before merge unless the owner copied the file to `main` by hand.
- **The address from a repository variable** (the account's workers.dev subdomain) and the plane's naming rule. No address in the tag, but it puts the plane's naming and the platform's subdomain into the project, which the owner asked to keep out.
- **A GitHub deployment created by the driver, and validation `on: deployment`.** Native, and the record would carry the address, but it auto-creates a GitHub environment, which the owner has just asked to remove, and makes the driver write deployment records it does not write today.
- **Packaging only when the driver asks** (a second request tag). Matches the flow's wording for step 8 most closely, but adds a trigger and a round trip for a copy of a few kilobytes that holds no secret and deploys nothing.
- **A tarball inside the artefact**, as `make package` made before. The plane serves the artefact's contents as they are, so it would serve the tarball.

## Consequences

- The project needs no platform set-up of its own; the plane's README holds the owner's one-time Cloudflare steps, which serve every project.
- The organisation secrets reach only public repositories on GitHub Free, so the repository stays public until the organisation moves to a paid plan, or the two secrets are set on the repository itself.
- Every push uploads a small `site` artefact, kept for the repository's retention period (90 days by default); promoting an older commit fails at the plane with a message saying so.
- The driver needs a forge function that pushes `validate/<env>/<sha>/<host>` and reads the run for that tag. The driver's step 10 is not built yet (M5); if it settles on another mechanism, only `validate.yml`'s trigger and `make validate-request` change.
- `validate/` tags accumulate, one or two per feature; release tags will be `v*`, so the two do not mix.
- Two features deployed to dev one after the other share one Worker; the version check stops either from being validated against the other's deployment.
- The local server is the project's own and only implements what the criteria touch; the deployed acceptance run catches any difference from the host.
- Switching platform is a change to `deploy.yaml` through the flow, provided the new plane offers `static-site`.

## What enforces it

- `make check-deps` fails if `package.json` names wrangler, miniflare or an `@cloudflare/` package, if a wrangler configuration file is tracked, or if any workflow references a secret other than `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET`. The engineering step's break checks add wrangler and a `CLOUDFLARE_API_TOKEN` reference and see it fail.
- `make package` fails if `dist/site/index.html` or `dist/site/404.html` is missing, and `actions/upload-artifact` with `if-no-files-found: error` fails if there is nothing to upload.
- `make validate-request` fails on a tag that names another commit; a break check runs it so.
- `make smoke` fails on a public dev or staging address and on a stale `version.txt`; break checks run both against the local copy.
- The plane fails a deploy with "no artefact named site for commit ..." when CI did not upload one for that commit, and the driver's design-time `plan` fails if the plane or the kind does not exist.
- Only the design agent may change `deploy.yaml` (the framework's `agents/agents.toml`).
- These can only be reviewed: that `deploy.yaml`'s artefact name matches the name `ci.yml` uploads, that `ci.yml` checks out and packages the head commit rather than the merge commit, that the two Access secrets reach only the smoke and acceptance steps, and that no other workflow is started by `validate/` tags.
