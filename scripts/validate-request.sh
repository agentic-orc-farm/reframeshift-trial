#!/usr/bin/env bash
# Checks a validation request tag, validate/<env>/<sha>/<host>, before anything else runs.
# Reads: VALIDATE_REQUEST (the tag name) and COMMIT_SHA (the checked-out commit).
# Writes env and base_url to $GITHUB_OUTPUT, or prints them when it is unset.
set -euo pipefail

request="${VALIDATE_REQUEST:-}"
commit="${COMMIT_SHA:-}"

refuse() {
  echo "validate-request: refusing \"$request\": $1" >&2
  echo "validate-request: the form is validate/<dev|staging|prod>/<the checked-out commit's full SHA>/<host>" >&2
  exit 1
}

[[ -n "$request" ]] || refuse "VALIDATE_REQUEST is not set"
[[ -n "$commit" ]] || refuse "COMMIT_SHA is not set"

IFS='/' read -r -a parts <<<"$request"
[[ "${#parts[@]}" -eq 4 && "$request" != */ ]] || refuse "it must have exactly four parts separated by \"/\""
[[ "${parts[0]}" == "validate" ]] || refuse "the first part must be \"validate\""

env_name="${parts[1]}"
sha="${parts[2]}"
host="${parts[3]}"

case "$env_name" in
  dev | staging | prod) ;;
  *) refuse "the environment must be dev, staging or prod, not \"$env_name\"" ;;
esac
[[ "$sha" == "$commit" ]] || refuse "the SHA \"$sha\" is not the checked-out commit $commit"
label='[a-z0-9]([a-z0-9-]*[a-z0-9])?'
[[ "$host" =~ ^$label(\.$label)*$ ]] ||
  refuse "the host \"$host\" is not a plain DNS name (lowercase letters, digits, dashes and dots)"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "env=$env_name"
    echo "base_url=https://$host"
  } >>"$GITHUB_OUTPUT"
fi
echo "env=$env_name"
echo "base_url=https://$host"
