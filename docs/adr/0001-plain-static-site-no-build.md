# 0001: A plain static site, with no build and no runtime dependencies

Status: proposed
Date: 2026-10-20

## Context

The first request is a holding page with a hero "Hello World", responsive, accessible and installable, in a new repository.
The owner's UI standard makes the lightest sufficient option the rule (UI.md 1, Firm) and lists a build tool, a type system and a unit-test runner as costs to be argued for.
This first choice sets the project's shape: every later change starts from it.

## Decision

- The site is the `site/` folder, served exactly as it is: HTML, two stylesheets (tokens and styles), two small JavaScript files for the service worker, a manifest, icons and a `_headers` file.
- No build step, no framework, no CSS framework, no TypeScript, no unit-test runner, and no runtime dependencies.
- Development tooling (Playwright with axe, html-validate, stylelint, Lighthouse, wrangler) comes from npm as dev dependencies, and is run only through `make`.

## Alternatives

- **Vite and TypeScript.** A typed, bundled source tree. Adds a build, a type system and a dependency tree to ship two HTML files with no logic.
- **A static site generator** (Eleventy, Astro). Templates and partials for two pages that share nothing worth templating.
- **No npm at all** (validators and browsers installed another way). Lighter on paper, but Playwright is Firm in the standard and comes through npm.

## Consequences

- Nothing to compile: `make package` archives `site/`, and what is tested locally is byte for byte what is deployed.
- Shared markup between the two pages is copied, not templated. When a page count or real logic makes that painful, a later design adds a build and says why.
- The service worker is hand-written, so its precache list is maintained by hand.

## What enforces it

`make check-deps` fails if `package.json` gains a runtime dependency or a framework appears among its dependencies.
`make check-css` fails on a literal colour outside `tokens.css`.
A build step can only be caught in review: the review agent checks that `make package` still archives `site/` unchanged.
