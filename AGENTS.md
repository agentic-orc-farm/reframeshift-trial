# AGENTS.md

ReframeShift: a static holding page with a hero "Hello World", served as plain files with no build.
The design is in `docs/design/`, the decisions in `docs/adr/`, the owner's standards in `docs/standards/`.

## Set up

```sh
make setup        # npm ci, then Playwright's Chromium
```

Node is the version in `.nvmrc` (24); npm with the committed `package-lock.json`, development dependencies only.

## Make targets

`make` is the only way to run anything: in a shell, in documentation and in CI. Never call `npm`, `npx` or a tool directly.

| Target | What it does |
|---|---|
| `make setup` | Installs the tooling and Playwright's Chromium (with system packages when `CI` is set). |
| `make check` | Every check CI runs: `check-html`, `check-css`, `check-deps`, `check-lighthouse`, `test` and `acceptance` against the local copy. Fails if any fails. |
| `make check-html` | `html-validate` on `site/*.html`. |
| `make check-css` | `stylelint` on `site/**/*.css`; literal colours are allowed only in `tokens.css`. |
| `make check-deps` | No runtime dependencies, framework, platform tool, wrangler configuration, or workflow secret other than the two Access ones. |
| `make check-lighthouse` | Lighthouse on the local copy (`/` and the 404 page): performance, accessibility and best practices at 95 or more. |
| `make test` | The engineering checks in `tests/e2e`, against the local copy. |
| `make acceptance` | The acceptance tests in `tests/acceptance`, against `BASE_URL` when set, otherwise the local copy. |
| `make dev` | Serves `SITE_DIR` (default `site`) on port 8788 with `scripts/serve.mjs`. |
| `make package` | Copies `site/` to `dist/site/` and writes `version.txt` holding `COMMIT_SHA` (required in CI; otherwise `HEAD`). |
| `make smoke ENV=<dev\|staging\|prod>` | `curl` checks against `BASE_URL`, including the version and privacy checks. |
| `make validate-request` | Checks the `validate/<env>/<sha>/<host>` tag in `VALIDATE_REQUEST` against `COMMIT_SHA`. |
| `make help` | Lists the targets. |

## Conventions

- `site/` is served exactly as it is: no build, no framework and no runtime dependencies. Every URL in it is root-absolute (`/styles.css`, never `styles.css`).
- Every colour, spacing and type value comes from `site/tokens.css`; `site/styles.css` uses only the tokens.
- `tests/acceptance/` belongs to the test agent and is never edited by the engineering agent. Acceptance tests use Playwright's own fixtures (`page`, `context`, `request`) and change settings with `test.use({...})`, never a hand-made `browser.newContext()`.
- `deploy.yaml` belongs to the design agent; nobody else changes it.
- Commits are `area: what changed`, the body says why, and there are no trailers naming an AI assistant (GITHUB.md 3).
- **The project never deploys.** The `cloudflare` plane deploys what `deploy.yaml` names. The project holds no platform configuration (no `wrangler.toml`), no platform tool (no wrangler, miniflare or `@cloudflare/` package) and no deploy credential (ADR 0006); `make check-deps` enforces it.
- CI calls only `make` targets. `ci.yml` checks and packages every push and uploads `dist/site/` as the artefact `site`. `validate.yml` runs only on a `validate/<env>/<sha>/<host>` request tag.
- Dev/test and staging are private behind Cloudflare Access; only prod is public. The only credential is the organisation's read-only Access service token, `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET`, passed to the smoke and acceptance steps of `validate.yml` alone.
- Never set `PLAYWRIGHT_DISABLE_SERVICE_WORKER_NETWORK`: the offline tests route the service worker's own requests (Playwright 1.57 or later).

## Standards

This project follows the owner's standards, version 2 draft, vendored in `docs/standards/` (`UI.md`, `GITHUB.md`), with one recorded difference:

- **No type-checking comments in the site's JavaScript.** UI.md 3's default for very small pages is plain JavaScript with type-checking comments. `site/register-sw.js` and `site/sw.js` hold about 35 lines of event handlers and no logic worth typing, so checking them would add TypeScript and a `tsc` step for nothing. Revisit when a script gains real logic.
