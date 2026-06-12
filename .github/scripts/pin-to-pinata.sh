#!/usr/bin/env bash
# Pin a directory to Pinata using the legacy /pinning/pinFileToIPFS endpoint.
# This is the only Pinata endpoint that supports folder uploads (as of 2026-04).
#
# Required env vars:
#   PINATA_JWT    - Bearer token from Pinata dashboard
#   BUILD_DIR     - Path to the build directory to upload
#   PIN_NAME      - Human-readable label for this pin
#
# Outputs (written to $GITHUB_OUTPUT if set):
#   cid           - The IPFS CID (v1) of the pinned folder

set -euo pipefail

: "${PINATA_JWT:?PINATA_JWT is required}"
: "${BUILD_DIR:?BUILD_DIR is required}"
: "${PIN_NAME:=spxswap-deploy}"

if [ ! -d "$BUILD_DIR" ]; then
  echo "::error::BUILD_DIR does not exist: $BUILD_DIR"
  exit 1
fi

echo "Uploading $BUILD_DIR to Pinata as '$PIN_NAME'..."

# Build the curl command with all files in the directory.
# Each file is added as a form field named "file" with its relative path preserved.
CURL_ARGS=()
while IFS= read -r -d '' file; do
  # Get path relative to BUILD_DIR
  rel_path="${file#$BUILD_DIR/}"
  CURL_ARGS+=(-F "file=@${file};filename=${PIN_NAME}/${rel_path}")
done < <(find "$BUILD_DIR" -type f -print0 | sort -z)

FILE_COUNT=${#CURL_ARGS[@]}
echo "Found $FILE_COUNT files to upload."

# pinataOptions: cidVersion 1 for modern CIDv1 (bafy...) format
METADATA=$(cat <<JSON
{"name":"${PIN_NAME}"}
JSON
)
OPTIONS='{"cidVersion":1}'

MAX_ATTEMPTS=4
ATTEMPT=1
HTTP_CODE=0
BODY=""

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
  echo "Attempt ${ATTEMPT}/${MAX_ATTEMPTS}..."

  # --connect-timeout: time to establish initial TCP connection
  # --max-time: total time for the request (large enough for 18MB upload)
  # No --retry here since we manage retries in this loop and want to know exit codes
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    --connect-timeout 30 \
    --max-time 600 \
    -X POST \
    -H "Authorization: Bearer ${PINATA_JWT}" \
    "${CURL_ARGS[@]}" \
    -F "pinataMetadata=${METADATA}" \
    -F "pinataOptions=${OPTIONS}" \
    "https://api.pinata.cloud/pinning/pinFileToIPFS") || CURL_EXIT=$?

  CURL_EXIT=${CURL_EXIT:-0}

  if [ "$CURL_EXIT" -eq 0 ]; then
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" -eq 200 ]; then
      break
    fi

    echo "HTTP ${HTTP_CODE} from Pinata, body:"
    echo "$BODY"
  else
    echo "curl exit ${CURL_EXIT} (network error)"
  fi

  if [ $ATTEMPT -lt $MAX_ATTEMPTS ]; then
    SLEEP=$((ATTEMPT * 10))
    echo "Retrying in ${SLEEP}s..."
    sleep $SLEEP
  fi

  ATTEMPT=$((ATTEMPT + 1))
  CURL_EXIT=0
done

if [ "$HTTP_CODE" -ne 200 ]; then
  echo "::error::Pinata upload failed after ${MAX_ATTEMPTS} attempts (last HTTP=${HTTP_CODE})"
  echo "$BODY"
  exit 1
fi

CID=$(echo "$BODY" | jq -r '.IpfsHash')
PIN_SIZE=$(echo "$BODY" | jq -r '.PinSize')

if [ -z "$CID" ] || [ "$CID" = "null" ]; then
  echo "::error::Failed to extract CID from Pinata response"
  echo "$BODY"
  exit 1
fi

echo "Pinned successfully!"
echo "  CID:  $CID"
echo "  Size: $PIN_SIZE bytes"

# Write output for GitHub Actions
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "cid=$CID" >> "$GITHUB_OUTPUT"
fi
