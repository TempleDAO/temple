#!/bin/bash
set -euo pipefail

# Usage: vercel-deploy.sh <environment> <alias> [--prod]
ENVIRONMENT="$1"
ALIAS="$2"
PROD_FLAG="${3:-}"

vcl() { npx --yes vercel@52.0.0 -A apps/dapp/vercel.json "$@"; }
args=()
if [ -n "$PROD_FLAG" ]; then args+=("$PROD_FLAG"); fi

vcl pull --yes --environment="$ENVIRONMENT"
vcl build "${args[@]}"
DEPLOYMENT_URL=$(vcl deploy --prebuilt "${args[@]}")
echo "deployment_url=$DEPLOYMENT_URL" >> "$GITHUB_OUTPUT"
vcl alias set "$DEPLOYMENT_URL" "$ALIAS" --scope "$VERCEL_ORG_ID"
