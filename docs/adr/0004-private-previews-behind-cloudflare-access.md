# 0004: Dev/test and staging behind Cloudflare Access; only prod is public

Status: proposed
Date: 2026-10-21

## Context

The framework's flow makes prod the only public environment: dev/test and staging sit behind a login, the owner signs in to look, and CI reaches them with its own credentials.
Dev/test and staging are Pages preview deployments, on the branch aliases `dev` and `staging`, and prod is the production branch (ADR 0005).
Preview addresses on Pages are public unless restricted.
The acceptance tests run in a browser against dev/test, including a service worker that fetches files on its own (AC10, AC13).

## Decision

- The Pages project's **Enable access policy** setting creates a self-hosted Access application on the wildcard `*.<subdomain>` (where `<subdomain>` is the project's `<project>.pages.dev` host). A wildcard subdomain does not match the bare `<subdomain>`, so every preview host, unique deployment URLs and branch aliases alike, is behind Access and the production address is not. Its default policy admits the members of the owner's Cloudflare account, who sign in by email.
- A second policy on the same Access application, action **Service Auth**, admits one service token, `github-ci`, stored as the `dev` environment secrets `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` (ADR 0005) and given only to the smoke and acceptance steps.
- Strict service token authentication stays off, so a request signed in with the token's headers gets a `CF_Authorization` cookie.
- CI signs in with the `CF-Access-Client-Id` and `CF-Access-Client-Secret` headers: `curl` in `make smoke`; in `make acceptance`, a Playwright global setup that signs in once and saves the cookie as storage state for every browser context, so the service worker's own requests are signed in too.
- The application is not edited by hand: removing its wildcard is how Cloudflare's own instructions put the production address behind Access, which would make prod private.

## Alternatives

- **HTTP basic auth in a Pages Function.** No Zero Trust account, but it puts code and a secret into the bundle's runtime, the same bundle prod receives, which then needs a switch to turn it off there; and every request, the 404 included, goes through a function.
- **A self-hosted Access application created by hand, one per branch alias** (`dev.<subdomain>`, `staging.<subdomain>`). Would also keep prod public, but leaves the unique deployment URLs, which are the published addresses, open; covering them needs the wildcard, which is exactly what the project setting creates and keeps in step with the project.
- **Public previews.** No credentials for CI, but unreleased work is open to anyone who finds an address; the flow rejects it.
- **An IP allow-list.** GitHub's hosted runners have no fixed addresses.

## Consequences

- The owner turns Zero Trust on (free for up to 50 users), turns the setting on per project, adds the Service Auth policy and keeps the token renewed; an expired token fails the `validate` job at sign-in with a plain message.
- The owner signs in to look at a dev/test address.
- Tests must use Playwright's configured fixtures; a hand-made browser context would miss the sign-in and fail against dev/test only.
- Staging, on the alias `staging.<subdomain>`, is covered by the same wildcard application; no second application is needed when the release work wires it up.

## What enforces it

`make deploy`, for dev/test and staging, refuses to deploy unless a host under the project's wildcard with no deployment behind it, `access-probe.<subdomain>`, answers anyone not signed in with the Access login (a redirect to a `cloudflareaccess.com` address), a 401 or a 403.
The probe needs no earlier deployment, so it works on the project's first deploy, on the expectation (not confirmed in Cloudflare's documentation) that Access matches the request's hostname against the application's wildcard before Pages looks for a deployment.
If the probe host turns out not to be intercepted, the guard fails closed: nothing is deployed, and the replacement is to read the project's Access application through Cloudflare's API instead, which adds the Access read permission to the API token. There is no fallback that probes an earlier deployment, because there is none on the first deploy.
`make smoke`, for dev/test and staging, fails if the deployed address answers anyone not signed in with a 200; for prod, it fails unless the address answers with the page.
The engineering step's break check runs `make smoke ENV=dev` against the local copy, which has no login, and sees it fail.
That the Service Auth policy admits only the CI token, and that the application's hostname is still the wildcard, can only be reviewed, in the Zero Trust dashboard, by the owner.
