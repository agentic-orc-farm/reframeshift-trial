# UI Guidelines

**Version**: 2.0 (draft)
**Author**: Richard, personal defaults for AI-assisted frontend work
**Supersedes**: 1.0 (see `CHANGELOG.md`)

This file holds the owner's opinions for UI and static-site work.
It is an input to design, not a recipe.
A designer or engineer reads it, then states for each decision whether it follows the standard or departs from it, and why.
Project-specific overrides in the project's `CLAUDE.md`, `AGENTS.md` or design document always win.

## How to read the labels

Every rule carries one label for how strongly it binds and one tag for how it is enforced.

**Strength**

- **Firm**: a real opinion. Departing needs a written reason, and the review checks it.
- **Default**: a starting point. Use it unless the size or shape of the thing argues otherwise.

**Enforcement** (as in the Python standards)

- **[tool]** a tool fails the build when it is broken.
- **[review]** nothing checks it; review must.
- **[gap]** we want a tool for it and do not have one yet.

## 1. The weight rule

Firm.
Pick the lightest option that meets the acceptance criteria.
Going heavier needs a reason written into the design, and an unexplained heavier choice is a review finding.
Lighter never needs a reason.
Build the minimal version first and enhance after. [review]

In practice:

- No framework (React, Vue and the like) unless the thing genuinely needs one. This is the heaviest departure and needs the strongest case. [tool: dependency check; review]
- No CSS framework. [tool: dependency check]
- Fewest dependencies that do the job. For a small site, none at runtime. [tool: dependency budget]
- A build tool, a type system and a unit-test runner are each a cost. A one-page site may need none of them; an app with real logic usually earns all three. The design decides and says why. [review]

## 2. One way to run everything: make

Firm.
Every project exposes all of its work through `make`, so a person, an agent, CI and the factory all know what is expected without reading the project.
Never call `npm`, `uv` or another tool directly from CI, documentation or the check profile; the make targets call them.

| Target | Does |
|---|---|
| `make setup` | Installs everything the checks need in a fresh clone. |
| `make check` | Runs every check that CI runs, and fails if any fails. |
| `make check-<name>` | Runs one check, for example `make check-html` or `make check-a11y`. |
| `make test` | Runs the tests. |
| `make dev` | Runs the project locally. |
| `make build` | Builds the deployable output, if there is a build. |
| `make help` | Lists the targets. |

The CI workflow runs `make setup` and `make check`, and the factory's check profile lists `make check-<name>` commands. [review; tool: CI runs only make targets]

## 3. Technology (Default, lightest sufficient)

| Concern | Starting point |
|---|---|
| Language | TypeScript (strict) once there is real logic; plain JavaScript with type-checking comments for very small pages |
| Components | Native Web Components with Shadow DOM when the UI has components; plain HTML and CSS when it does not |
| Build | Vite when a build is needed; no build for a static page that does not need one |
| Unit tests | Vitest, where there is logic to test |
| End-to-end tests | Playwright (Firm) |
| Package manager | npm |
| Styling | CSS custom properties (Firm: no CSS frameworks) |

If the project requires a framework, follow that framework's conventions for components.
Everything else here still applies.

## 4. The static site baseline

Firm.
Every static site meets all of these, and the design turns each into an automated check so CI enforces it.

| Requirement | Check |
|---|---|
| Installable as a PWA: web app manifest, service worker, works offline for its core pages | manifest and service worker present; the browser reports no installability errors; the page works offline after a first visit [tool] |
| Standards-compliant: valid HTML, valid CSS, correct metadata | HTML and CSS validation in CI [tool] |
| Accessible to WCAG AA | automated accessibility audit; keyboard check in Playwright [tool; review] |
| Lightweight: a stated page weight budget and a performance threshold | weight budget in CI, and the current Lighthouse (not an older pinned one) scoring performance, accessibility and best practices at 95 or more [tool] |
| Few or no dependencies, and no framework | dependency check fails the build if a framework appears [tool] |
| A real 404 page, served for unknown paths | Playwright test that an unknown URL shows it [tool] |
| Secure defaults: no inline script where avoidable, a sensible content security policy | header or meta check [tool; gap] |

## 5. Progressive enhancement

Firm.
Core content, navigation and forms work with no JavaScript.
JavaScript adds interaction on top and degrades gracefully.
Optional browser APIs are feature-detected before use. [review]

## 6. Structure (Default)

A small site is a handful of files, not a source tree.
When there are components and logic, group by what the code is for:

```
ui/
  src/
    components/   # base, shared, layout, and one folder per feature
    services/     # the only place that calls the network
    types/        # domain types
    utils/        # pure functions
    main.ts       # registers components and boots the app
  tests/
    unit/         # mirrors src/
    e2e/          # Playwright
  index.html
```

Components do one thing, and a component file that passes about 200 lines is split. [review]
Network calls go through the service layer, never from a component. [review]
State is local to each component, passed down as attributes and up as events. [review]

## 7. Components that load data

Firm.
Every component that loads data handles all four states: loading, error, empty and data.
A missing state is a bug. [review; gap]

## 8. Styling

- Every colour, spacing and type value is a design token (a CSS custom property). Hardcoded values that bypass the tokens are a defect. [tool: stylelint if enabled; review]
- Responsive by default. Layout works from phone width up. [tool: Playwright viewport checks]
- Animate `transform` and `opacity` only, and respect `prefers-reduced-motion`. [review]

## 9. Accessibility

Firm.
WCAG AA is the minimum.

- Everything interactive is reachable and operable by keyboard alone. [tool: Playwright; review]
- Focus moves into a modal when it opens and returns to the trigger when it closes. [review]
- Prefer native HTML elements to ARIA; use ARIA only where native semantics fall short. [review]
- Colour contrast comes from the tokens. [tool: automated audit]

## 10. Types and code quality

When TypeScript is used:

- Strict mode, no `any`, domain types in one place, `import type` for type-only imports. [tool: tsc, eslint]
- No `eval`. Untrusted content is escaped or set through `textContent`. [tool: eslint; review]

## 11. Testing

- End-to-end tests with Playwright cover each acceptance criterion against the running site, including the empty, error and loading states and the 404. [tool]
- Unit tests where there is logic. Contract tests where there is a service boundary. [tool]
- Performance tests only where there is a real budget to enforce. [review]
- Tests run through `make test`, not by calling the tools directly. [review]

## 12. Decision rules

When two designs work, prefer:

1. Explicit over implicit.
2. Standard over novel: established browser APIs over custom abstractions.
3. Simple over complete.
4. Tested over theoretical.

## 13. Stop and reconsider

If you are about to do one of these, stop and put the reason in the design first.

- Add a framework dependency.
- Hardcode a colour or spacing value.
- Use `any`.
- Call the network from a component.
- Skip loading, error or empty states.
- Animate a layout property.
- Add a build step, type system or test runner the size of the thing does not need.

## Before you finish

- [ ] The design states, per decision, "follows the standard" or "departs because...".
- [ ] Every static-site baseline requirement has a check that can fail.
- [ ] The weight of the result is justified against the lightest option.
- [ ] Accessibility, the 404 and the offline behaviour were tested in a browser.
