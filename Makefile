# The only way to run anything in this project (UI.md 2). CI calls these targets and nothing else.
# There is no `make deploy`: the cloudflare plane deploys what deploy.yaml names (ADR 0006).

SHELL := /bin/bash
.DEFAULT_GOAL := help

BIN := node_modules/.bin
PORT ?= 8788
SITE_DIR ?= site
LIGHTHOUSE_PORT ?= 8790

.PHONY: help setup check check-html check-css check-deps check-lighthouse test acceptance \
	dev package smoke validate-request

help: ## List the targets
	@awk 'BEGIN {FS = ":.*## "} /^[a-z-]+:.*## / {printf "  make %-18s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

setup: ## Install the tooling and Playwright's Chromium (with system deps when CI is set)
	npm ci
	$(BIN)/playwright install $(if $(CI),--with-deps )chromium

check: ## Every check CI runs: html, css, deps, lighthouse, test, acceptance (local); fails if any fails
	@failed=""; \
	for target in check-html check-css check-deps check-lighthouse test; do \
		$(MAKE) --no-print-directory $$target || failed="$$failed $$target"; \
	done; \
	BASE_URL= $(MAKE) --no-print-directory acceptance || failed="$$failed acceptance"; \
	if [ -n "$$failed" ]; then echo "make check: failed:$$failed" >&2; exit 1; fi; \
	echo "make check: all checks passed"

check-html: ## Validate the pages with html-validate
	$(BIN)/html-validate site/*.html

check-css: ## Lint and validate the stylesheets with stylelint (literal colours only in tokens.css)
	$(BIN)/stylelint "site/**/*.css"

check-deps: ## No runtime deps, framework, platform tool, wrangler config or extra workflow secret
	node scripts/check-deps.mjs

check-lighthouse: ## Lighthouse on the local copy: performance, accessibility, best practices >= 95
	@node scripts/serve.mjs --port $(LIGHTHOUSE_PORT) --dir $(SITE_DIR) & server=$$!; \
	trap 'kill $$server 2>/dev/null' EXIT; \
	node scripts/lighthouse.mjs http://localhost:$(LIGHTHOUSE_PORT)

test: ## The engineering checks in tests/e2e, against the local copy
	BASE_URL= $(BIN)/playwright test tests/e2e

acceptance: ## The acceptance tests, against BASE_URL when set, otherwise the local copy
	$(BIN)/playwright test tests/acceptance

dev: ## Serve SITE_DIR (default site) on port 8788
	node scripts/serve.mjs --port $(PORT) --dir $(SITE_DIR)

package: ## Copy site/ to dist/site/ with version.txt holding COMMIT_SHA (required in CI)
	@if [ -n "$$CI" ] && [ -z "$$COMMIT_SHA" ]; then \
		echo "make package: COMMIT_SHA is required when CI is set" >&2; exit 1; fi
	rm -rf dist/site
	mkdir -p dist
	cp -R site dist/site
	@sha="$${COMMIT_SHA:-$$(git rev-parse HEAD)}"; \
	printf '%s' "$$sha" > dist/site/version.txt; \
	echo "make package: dist/site/version.txt holds $$sha"
	@for page in index.html 404.html; do \
		if [ ! -f "dist/site/$$page" ]; then echo "make package: dist/site/$$page is missing" >&2; exit 1; fi; \
	done

smoke: ## Smoke checks against BASE_URL (required): make smoke ENV=<dev|staging|prod>
	scripts/smoke.sh "$(ENV)"

validate-request: ## Check the VALIDATE_REQUEST tag against COMMIT_SHA; write env and base_url
	scripts/validate-request.sh
