#!/usr/bin/env bash
# Verify (and warm) a freshly pinned IPFS deploy through public gateways.
#
# Public gateways routinely 504 on the first fetch of new content while their
# caches are cold — large JS bundles especially. This script retries until the
# site's index.html AND every asset referenced by it are served, which both
# proves the deploy is retrievable and pre-warms the gateways users will hit
# from the release links.
#
# Required env vars:
#   CID            - Root CID of the deploy
# Optional:
#   GATEWAYS       - Space-separated gateway base URLs (default: ipfs.io + dweb.link)
#   MAX_ATTEMPTS   - Retry attempts per URL (default: 10)
#   SLEEP_SECONDS  - Pause between retries (default: 15)

set -euo pipefail

: "${CID:?CID is required}"
GATEWAYS=${GATEWAYS:-"https://ipfs.io https://dweb.link"}
MAX_ATTEMPTS=${MAX_ATTEMPTS:-10}
SLEEP_SECONDS=${SLEEP_SECONDS:-15}

# Fetch a URL with retries, treating an HTTP 200 as success.
#
# A cold gateway returns the 200 headers as soon as it has resolved the content,
# but streaming the full body of a large bundle can exceed --max-time, making
# curl exit non-zero *after* it has already printed "200". We therefore capture
# the HTTP status independently of curl's exit code and key success off that.
#
# The previous `... || echo "000"` ran inside the command substitution, so on a
# body timeout it appended "000" to the "200" curl had already emitted, yielding
# the bogus status "200000" — which never matched "200", so a successful (and
# now partially cache-warmed) fetch was retried and could fail the whole deploy.
fetch_with_retries() {
  local url=$1
  local out=$2
  local attempt status
  for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
    # `|| true` keeps a non-zero curl exit (e.g. 28 timeout mid-body) from
    # tripping `set -e`; $status still holds the real code curl printed.
    status=$(curl -s --max-time 120 -o "$out" -w "%{http_code}" "$url") || true
    if [ "$status" = "200" ]; then
      return 0
    fi
    echo "  attempt ${attempt}/${MAX_ATTEMPTS}: ${url} → ${status:-000}, retrying in ${SLEEP_SECONDS}s..."
    sleep "$SLEEP_SECONDS"
  done
  return 1
}

INDEX_FILE=$(mktemp)
trap 'rm -f "$INDEX_FILE"' EXIT

VERIFIED_GW=""
for gw in $GATEWAYS; do
  echo "Verifying index.html via ${gw}..."
  if fetch_with_retries "${gw}/ipfs/${CID}/index.html" "$INDEX_FILE" && grep -qi "<html" "$INDEX_FILE"; then
    echo "  ✓ index.html served by ${gw}"
    VERIFIED_GW=$gw
    break
  fi
  echo "::warning::${gw} could not serve index.html for ${CID}"
done

if [ -z "$VERIFIED_GW" ]; then
  echo "::error::No gateway could serve index.html for ${CID} — deploy is not publicly retrievable."
  exit 1
fi

# Verify every local asset index.html references (./assets/foo-<hash>.js etc.)
ASSETS=$(grep -oE '(src|href)="\./[^"]+"' "$INDEX_FILE" | sed 's/.*"\.\///; s/"//' | sort -u)
if [ -z "$ASSETS" ]; then
  echo "::warning::index.html references no local assets — unexpected for a vite build."
fi

ASSET_FILE=$(mktemp)
trap 'rm -f "$INDEX_FILE" "$ASSET_FILE"' EXIT
FAILED_ASSETS=0
while IFS= read -r asset; do
  [ -z "$asset" ] && continue
  echo "Verifying asset ${asset}..."
  if fetch_with_retries "${VERIFIED_GW}/ipfs/${CID}/${asset}" "$ASSET_FILE"; then
    echo "  ✓ ${asset}"
  else
    echo "::error::Asset ${asset} unreachable via ${VERIFIED_GW}"
    FAILED_ASSETS=1
  fi
done <<< "$ASSETS"

if [ "$FAILED_ASSETS" = "1" ]; then
  exit 1
fi

# Best-effort warm-up of the remaining gateways so all release links work.
for gw in $GATEWAYS; do
  [ "$gw" = "$VERIFIED_GW" ] && continue
  echo "Warming ${gw} (best-effort)..."
  curl -s --max-time 120 -o /dev/null "${gw}/ipfs/${CID}/" || true
done

echo "✓ Deploy ${CID} verified via ${VERIFIED_GW}"
