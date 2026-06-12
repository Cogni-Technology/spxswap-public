#!/usr/bin/env bash
# Pin a directory to web3.storage (w3up) as a secondary redundancy layer.
# Pinata is primary; this fires in parallel and failures are non-fatal at the
# workflow level (continue-on-error). The site is addressed by CID via IPFS
# gateways; the w3s pin keeps the content retrievable if Pinata ever nukes it.
#
# Required env vars:
#   WEB3_STORAGE_PRINCIPAL   - Agent private key (from `w3 key create --json | jq -r .key`)
#   WEB3_STORAGE_PROOF       - Base64-encoded delegation CAR proof granting the
#                              principal upload rights on the target space
#   BUILD_DIR                - Path to the directory to upload
#   EXPECTED_CID             - Pinata's CID, used to sanity-check that w3s
#                              produced the same CID (chunker + wrapping parity)
#
# Outputs (written to $GITHUB_OUTPUT if set):
#   cid                      - The w3s-reported CID (expected to equal EXPECTED_CID)

set -euo pipefail

: "${WEB3_STORAGE_PRINCIPAL:?WEB3_STORAGE_PRINCIPAL is required}"
: "${WEB3_STORAGE_PROOF:?WEB3_STORAGE_PROOF is required}"
: "${BUILD_DIR:?BUILD_DIR is required}"
: "${EXPECTED_CID:?EXPECTED_CID is required}"

if [ ! -d "$BUILD_DIR" ]; then
  echo "::error::BUILD_DIR does not exist: $BUILD_DIR"
  exit 1
fi

PROOF_FILE=$(mktemp --suffix=.car)
trap 'rm -f "$PROOF_FILE"' EXIT

echo "$WEB3_STORAGE_PROOF" | base64 -d > "$PROOF_FILE"

# Use npx (Node runtime) rather than bunx: w3cli expects Node APIs and is
# what the upstream docs test against. Both runtimes are available in CI.
W3="npx --yes @web3-storage/w3cli@latest"
export W3_PRINCIPAL="$WEB3_STORAGE_PRINCIPAL"

echo "Registering w3up space from delegation proof..."
$W3 space add "$PROOF_FILE"

echo "Uploading $BUILD_DIR to w3.storage..."
UP_JSON=$($W3 up --json "$BUILD_DIR")

CID=$(echo "$UP_JSON" | jq -r '.root["/"] // .cid // empty')

if [ -z "$CID" ]; then
  echo "::error::Failed to extract CID from w3up response"
  echo "$UP_JSON"
  exit 1
fi

echo "w3.storage CID: $CID"

if [ "$CID" != "$EXPECTED_CID" ]; then
  echo "::warning::CID mismatch — Pinata=$EXPECTED_CID, w3s=$CID. Published links use the Pinata CID, so this only matters if we ever need to fall back to w3s."
fi

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "cid=$CID" >> "$GITHUB_OUTPUT"
fi
