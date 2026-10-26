# reframeshift-trial

ReframeShift: a static holding page with a hero "Hello World".
Plain HTML and CSS in `site/`, served as it is, with no build and no runtime dependencies; installable and usable offline through a small service worker.

## Run it

You need Node (the version in `.nvmrc`), `make`, `curl` and `git`.

```sh
make setup        # install the development tooling and Playwright's Chromium
make dev          # serve site/ at http://localhost:8788
```

## Check it

```sh
make check        # HTML, CSS, dependencies, Lighthouse, the e2e checks and the acceptance tests
make test         # only the e2e checks in tests/e2e
make acceptance   # only the acceptance tests in tests/acceptance
make help         # every target
```

All of them run against a local copy served by `scripts/serve.mjs`. `make acceptance` runs against a deployed address instead when `BASE_URL` is set; for a private environment, also set `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` (the Cloudflare Access service token).

## How it ships

The project packages and validates; it never deploys.

- `make package` copies `site/` to `dist/site/` with a `version.txt` holding the commit. CI (`.github/workflows/ci.yml`) runs it on every push after the checks pass and uploads the folder as the artefact `site`.
- The `cloudflare` plane deploys that artefact as `deploy.yaml` says: a Worker per environment, with dev/test and staging behind Cloudflare Access and prod public.
- To validate a deployment, the driver pushes the tag `validate/<env>/<sha>/<host>`; `.github/workflows/validate.yml` then runs `make smoke ENV=<env>` and `make acceptance` against `https://<host>`.

See `AGENTS.md` for the conventions, `docs/design/` for the design and `docs/adr/` for the decisions.
