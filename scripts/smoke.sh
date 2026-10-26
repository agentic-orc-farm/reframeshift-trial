#!/usr/bin/env bash
# Smoke checks against a deployed address (or the local copy), with curl.
# Usage: BASE_URL=https://host scripts/smoke.sh <dev|staging|prod>
# Reads: BASE_URL (required); COMMIT_SHA (optional: /version.txt must hold exactly it);
#        CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET (optional: sent as Access headers).
# Then the privacy check, with no headers and no redirect following:
#   dev and staging must answer a redirect to cloudflareaccess.com, a 401 or a 403, never 200;
#   prod must answer 200 with the page.
set -euo pipefail

env_name="${1:-}"
case "$env_name" in
  dev | staging | prod) ;;
  *)
    echo "smoke: ENV must be dev, staging or prod (got \"$env_name\"): make smoke ENV=<env>" >&2
    exit 2
    ;;
esac
if [[ -z "${BASE_URL:-}" ]]; then
  echo "smoke: BASE_URL is required, for example BASE_URL=https://example.workers.dev" >&2
  exit 2
fi
base="${BASE_URL%/}"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# The Access headers go in a curl config file, so the secret is not on any command line.
access_config="$work/access.curlrc"
: >"$access_config"
if [[ -n "${CF_ACCESS_CLIENT_ID:-}" && -n "${CF_ACCESS_CLIENT_SECRET:-}" ]]; then
  chmod 600 "$access_config"
  printf 'header = "CF-Access-Client-Id: %s"\nheader = "CF-Access-Client-Secret: %s"\n' \
    "$CF_ACCESS_CLIENT_ID" "$CF_ACCESS_CLIENT_SECRET" >"$access_config"
  echo "smoke: sending the Cloudflare Access service token headers"
fi

failures=0
pass() { echo "  ok    $1"; }
fail() {
  echo "  FAIL  $1" >&2
  failures=$((failures + 1))
}

# fetch <config> <path> <name>: writes $work/<name>.body and .headers, prints the status code.
fetch() {
  curl --silent --show-error --max-time 30 --config "$1" \
    --dump-header "$work/$3.headers" --output "$work/$3.body" \
    --write-out '%{http_code}' "$base$2" || echo "000"
}

echo "smoke: $env_name at $base"

status="$(fetch "$access_config" / home)"
if [[ "$status" == "200" ]] && grep -q "Hello World" "$work/home.body"; then
  pass "/ answers 200 and contains \"Hello World\""
else
  fail "/ answered $status; expected 200 containing \"Hello World\""
fi

if grep -qi '^content-security-policy:' "$work/home.headers"; then
  pass "/ carries a Content-Security-Policy header"
else
  fail "/ has no Content-Security-Policy header"
fi

for path in /this-page-does-not-exist /no/such/page; do
  status="$(fetch "$access_config" "$path" missing)"
  if [[ "$status" == "404" ]]; then
    pass "$path answers 404"
  else
    fail "$path answered $status; expected 404"
  fi
done

if [[ -n "${COMMIT_SHA:-}" ]]; then
  status="$(fetch "$access_config" /version.txt version)"
  deployed="$(tr -d '[:space:]' <"$work/version.body")"
  if [[ "$status" == "200" && "$deployed" == "$COMMIT_SHA" ]]; then
    pass "/version.txt holds $COMMIT_SHA"
  else
    fail "version check: /version.txt answered $status holding \"$deployed\"; expected $COMMIT_SHA (is an earlier deployment still there?)"
  fi
fi

# The privacy check: no headers, no redirect following.
: >"$work/none.curlrc"
status="$(fetch "$work/none.curlrc" / public)"
if [[ "$env_name" == "prod" ]]; then
  if [[ "$status" == "200" ]] && grep -q "Hello World" "$work/public.body"; then
    pass "privacy check: prod answers the public with the page"
  else
    fail "privacy check: prod answered $status without the Access headers; expected 200 with the page"
  fi
else
  location="$(grep -i '^location:' "$work/public.headers" | head -n 1 | cut -d' ' -f2- | tr -d '\r' || true)"
  host="$(printf '%s' "$location" | sed -E 's#^[a-zA-Z]+://([^/:?#]+).*#\1#')"
  if [[ "$status" == "401" || "$status" == "403" ]]; then
    pass "privacy check: $env_name answers $status without the Access headers"
  elif [[ "$status" =~ ^30[12378]$ && ("$host" == "cloudflareaccess.com" || "$host" == *.cloudflareaccess.com) ]]; then
    pass "privacy check: $env_name redirects to $host without the Access headers"
  else
    fail "privacy check: $env_name answered $status${location:+ (to $location)} without the Access headers; expected a redirect to cloudflareaccess.com, a 401 or a 403"
  fi
fi

if ((failures > 0)); then
  echo "smoke: $failures check(s) failed" >&2
  exit 1
fi
echo "smoke: all checks passed"
