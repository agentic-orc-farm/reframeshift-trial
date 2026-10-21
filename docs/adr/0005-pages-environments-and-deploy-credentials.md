# 0005: Cloudflare Pages environments by branch alias, with the deploy credentials in a GitHub environment

Status: proposed
Date: 2026-10-21
Supersedes: 0002

## Context

ADR 0002 chose Cloudflare Pages, by direct upload from CI, with a preview per pull request (`pr-<n>`), public preview addresses, and the Cloudflare credentials as organization secrets.
The framework's flow (its ADR 0011) then changed what the host has to do: dev/test is deployed once per feature, when the driver asks, for one reviewed commit (ADR 0003), and every environment but prod is private (ADR 0004).
A feature's dev/test deployment still needs its own address where the frozen acceptance tests run against the deployed version, including a real 404 status (AC7) and response headers for the content security policy (AC12).
GITHUB.md 7 asks for one immutable artifact promoted between environments, secrets only in the CI store, and "only the job that needs one gets it".
Organization secrets are readable by any workflow in any repository they are shared with, on any trigger; only review keeps a pull request's workflow from reading them.

What stays from ADR 0002: Cloudflare Pages, direct upload with `wrangler pages deploy`, no build by Cloudflare, one bundle for every environment, and its alternatives (Workers Previews, Pages Git integration, GitHub Pages, the local server), which still lose for the reasons it gives.

## Decision

- The site is hosted on Cloudflare Pages, project `reframeshift-trial`, production branch `main`, by direct upload from CI. Cloudflare never builds from the repository.
- Dev/test is a preview deployment on the Pages branch `dev`, staging one on the branch `staging`, and prod the production branch `main`. Each gets the same bundle through `make deploy ENV=dev|staging|prod`.
- The address of a deployment is its unique URL, so it belongs to one commit.
- `make deploy` never creates the Pages project; the owner creates it once, before turning Access on, so no preview is ever deployed to a project without Access.
- The four credentials, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET`, are **secrets of the repository's GitHub environment `dev`**, not organization or repository secrets.
- The `dev` environment's deployment policy is **Selected branches and tags**, with one rule: tags matching `deploy/dev/*`. No branch may use it.
- In `deploy.yml`, the `deploy` job uses `environment: dev` (which records the GitHub deployment and its address) and the `validate` job uses `environment: { name: dev, deployment: false }` (secrets, no second deployment record). The `package` job uses no environment. Within each job, a secret is passed only to the step that needs it.
- Staging and prod, when the release work wires them up, get their own environments, `staging` and `prod`, with their own copies of the credentials and their own request-tag rules.

## Alternatives

- **Organization secrets, as in ADR 0002.** One place for every static project, but any workflow on any trigger in a repository they are shared with can read them, including a pull request's.
- **Repository secrets.** Scoped to one repository, but still readable by every workflow run in it, on any branch.
- **A separate environment for the Access token** (`dev-validate`). Would keep the Cloudflare API token out of the `validate` job entirely, but it is a second environment with the same rule; passing each secret to one step already keeps it from the other step's code.
- **The per-PR previews and public addresses of ADR 0002.** The flow rejects both.

## Consequences

- GitHub refuses to start a job that names the `dev` environment unless the run's ref is a `deploy/dev/*` tag, so a pull request or a push to `main` cannot read the credentials, even if a workflow names the environment.
- Environment secrets and deployment rules on a **private** repository need GitHub Pro, Team or Enterprise; on GitHub Free they exist only for public repositories. The owner confirms which applies before setting up (the design's owner setup, step 2).
- The credentials are per repository: a later static project stores its own copy in its own `dev` environment. The Cloudflare account, the API token and the Access service token can still be reused.
- One manual owner step: a Cloudflare account, the Pages project, Access (ADR 0004), the `dev` environment with its tag rule, and four environment secrets.
- Pages appears to be in maintenance, with new features going to Workers. Revisit when Cloudflare announces an end date for Pages, or when its Workers documentation confirms static-asset and 404 behaviour in previews; the move is contained in `scripts/deploy.sh`, `scripts/smoke.sh` and the Access setup.
- Pages redirects `.html` URLs and treats a site without `404.html` as a single-page app; the design notes both.
- Every dev/test deployment stays reachable, behind Access, until it is deleted; nothing deletes old ones until they cause friction.

## What enforces it

GitHub: the `dev` environment's tag rule. A job naming `dev` on any other ref fails before it starts, and a job not naming it has no credentials.
GitHub's documentation does not say whether the rule also stops a job that names `dev` with `deployment: false`; until a run shows it does, the review check below is what covers that case.
`make deploy` fails if the Cloudflare credentials are missing, or if the project does not exist.
`make smoke` fails if the deployed address does not answer an unknown path with 404 or lacks the CSP header, and the acceptance tests run against the deployed address.
These can only be reviewed:
the review agent checks that the `deploy` job downloads the `package` job's artifact and builds nothing (promotion of one bundle), that only `deploy` and `validate` name the `dev` environment, and that each secret reaches one step;
the owner checks once, in the repository's settings, that the four credentials are environment secrets of `dev` and nowhere else, and that `dev` allows only `deploy/dev/*` tags.
