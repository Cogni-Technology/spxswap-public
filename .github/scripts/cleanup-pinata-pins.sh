#!/usr/bin/env bash
# Unpin previous Pinata pins after a successful deploy, keeping only KEEP_CID.
#
# Only pins whose metadata name matches PIN_NAME_REGEX are touched, so the
# production cleanup never deletes testnet pins and vice versa. Run this LAST
# in the deploy job — after pinning AND verification — so a failed deploy
# always leaves the previous (working) pin in place.
#
# Required env vars:
#   PINATA_JWT       - Bearer token from Pinata dashboard
#   KEEP_CID         - CID of the pin that must survive (the fresh deploy)
#   PIN_NAME_REGEX   - Regex matched against each pin's metadata name
#                      (e.g. '^spxswap-[0-9a-f]{40}$')

set -euo pipefail

: "${PINATA_JWT:?PINATA_JWT is required}"
: "${KEEP_CID:?KEEP_CID is required}"
: "${PIN_NAME_REGEX:?PIN_NAME_REGEX is required}"

echo "Listing pinned items (keeping ${KEEP_CID})..."
LIST_RESPONSE=$(curl -sf \
  -H "Authorization: Bearer ${PINATA_JWT}" \
  "https://api.pinata.cloud/data/pinList?status=pinned&pageLimit=1000")

STALE_HASHES=$(echo "$LIST_RESPONSE" | jq -r \
  --arg re "$PIN_NAME_REGEX" \
  --arg keep "$KEEP_CID" \
  '.rows[]
   | select((.metadata.name // "") | test($re))
   | select(.ipfs_pin_hash != $keep)
   | .ipfs_pin_hash')

if [ -z "$STALE_HASHES" ]; then
  echo "No stale pins matching ${PIN_NAME_REGEX} — nothing to unpin."
  exit 0
fi

FAILED=0
while IFS= read -r hash; do
  echo "Unpinning ${hash}..."
  if curl -sf -X DELETE \
    -H "Authorization: Bearer ${PINATA_JWT}" \
    "https://api.pinata.cloud/pinning/unpin/${hash}" > /dev/null; then
    echo "  ✓ unpinned"
  else
    echo "::warning::Failed to unpin ${hash} — remove it manually in the Pinata dashboard."
    FAILED=1
  fi
done <<< "$STALE_HASHES"

# Partial failures are warnings, not deploy failures: the new pin is already
# live; a leftover old pin only costs storage.
exit 0
