# 0003: CI deploys only on a request tag for one reviewed commit

Status: proposed
Date: 2026-10-21

## Context

The framework's flow (its ADR 0011) has CI check every push but deploy to dev/test only when the driver asks, for one commit that passed review, once per feature.
So CI needs a trigger that the driver can fire for a named commit, and nothing else may start a deploy.
This pull request is the one that creates the repository's workflows, and its dev/test deploy must happen before it merges, while `main` holds only a README.
GitHub starts a `workflow_dispatch` or `repository_dispatch` run only when the workflow file is on the default branch.
A `push` run uses the workflow file in the pushed commit.

## Decision

- The driver asks for a dev/test deploy by pushing one lightweight tag, `deploy/dev/<sha>`, at the reviewed commit, with the GitHub App's token.
- `.github/workflows/deploy.yml` runs only on pushes of tags matching `deploy/dev/*`. Its jobs `package`, `deploy` and `validate` are the flow's steps 8, 9 and 10, for the tagged commit.
- `.github/workflows/ci.yml` runs on pull requests and pushes to `main`, checks, and never packages or deploys.
- The deploy credentials are secrets of the GitHub environment `dev`, which only `deploy/dev/*` tags may use (ADR 0005), so the request tag is also what unlocks them.
- A fixed commit gets a new tag; repeating the same commit's deploy is a re-run of its workflow run.
- Staging and prod triggers come with the flow's release work (v2) and will extend the same request check, each with its own environment and tag rule.

## Alternatives

- **`workflow_dispatch` with the commit as an input.** The most direct "ask", and it would work from the second pull request on, but not for this one, which creates the workflow: there would be no dev/test deploy before the first merge. Using it later would give the driver two mechanisms where one works throughout.
- **A label on the pull request** (`pull_request` `labeled`). Runs from the PR's workflow, but deploys whatever the head is when the label lands rather than a named commit, and a second deploy needs the label removed and added again. The flow's ADR 0011 set it aside as less direct.
- **Deploy on every push.** What the first design did; the flow rejects it because twenty commits would be twenty deploys against hosts that cap deploys.

## Consequences

- The framework's driver needs a forge function that pushes `deploy/<env>/<sha>` and then reads the run for that tag and the deployment for that commit. The convention is stack-neutral, so other projects can use it.
- `deploy/` tags accumulate, one or two per feature, as a record of what was asked for. Release tags will be `v*`, so the two do not mix.
- The tag must be pushed with a token that starts workflows (the App's), not a workflow's `GITHUB_TOKEN`.
- Anyone with write access can request a deploy, as they could with a dispatch.

## What enforces it

GitHub enforces where the credentials can be read: they are secrets of the `dev` environment, whose deployment rule allows only tags matching `deploy/dev/*`.
A job in `ci.yml`, or in any run started by a pull request or a branch push, that names `dev` is refused before it starts, and one that does not name it has no Cloudflare or Access credentials to deploy or sign in with.
`make deploy` fails when `CI` is set unless `DEPLOY_REQUEST` (the tag that started the run) is exactly `deploy/<ENV>/<COMMIT_SHA>`, so even a run started by a request tag deploys only the commit the tag names, and only to the environment it names.
The engineering step's break check runs it with a mismatched request and sees it fail.
These can only be reviewed: the review agent checks that `ci.yml` names no environment and has no deploy step, that `deploy.yml` has no trigger but the tags, and that no other workflow is triggered by `deploy/` tags (any such workflow could also name `dev`); the owner checks once that the `dev` environment's rule is the tag pattern alone.
