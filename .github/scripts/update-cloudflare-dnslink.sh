#!/usr/bin/env bash
# Update a Cloudflare Web3 IPFS Gateway hostname's DNSLink target.
#
# Required env vars:
#   CLOUDFLARE_TOKEN     - API token with Zone:Web3:Edit permission
#   CLOUDFLARE_ZONE_ID   - Zone ID for the target domain
#   DNSLINK_DOMAIN       - Hostname configured in Web3 Gateway (e.g. swap.dcaeon.com)
#   CID                  - The new IPFS CID to point at
#
# When the Cloudflare Web3 Gateway product is enabled for a hostname, Cloudflare
# manages the underlying _dnslink TXT record itself — it can't be edited via the
# regular DNS API (returns error 1049 if you try). Instead, this script:
#   1. Lists Web3 hostnames to find the one matching DNSLINK_DOMAIN
#   2. PATCHes its dnslink field with the new /ipfs/<CID> value

set -euo pipefail

: "${CLOUDFLARE_TOKEN:?CLOUDFLARE_TOKEN is required}"
: "${CLOUDFLARE_ZONE_ID:?CLOUDFLARE_ZONE_ID is required}"
: "${DNSLINK_DOMAIN:?DNSLINK_DOMAIN is required}"
: "${CID:?CID is required}"

API_BASE="https://api.cloudflare.com/client/v4"
DNSLINK_VALUE="/ipfs/${CID}"

echo "Updating Web3 Gateway for ${DNSLINK_DOMAIN} → ${DNSLINK_VALUE}"

# List Web3 hostnames to find the one matching our domain
LIST_RESPONSE=$(curl -s \
  -H "Authorization: Bearer ${CLOUDFLARE_TOKEN}" \
  "${API_BASE}/zones/${CLOUDFLARE_ZONE_ID}/web3/hostnames")

LIST_SUCCESS=$(echo "$LIST_RESPONSE" | jq -r '.success')
if [ "$LIST_SUCCESS" != "true" ]; then
  echo "::error::Failed to list Web3 hostnames"
  echo "$LIST_RESPONSE" | jq .
  exit 1
fi

HOSTNAME_ID=$(echo "$LIST_RESPONSE" | jq -r --arg name "$DNSLINK_DOMAIN" '.result[] | select(.name == $name) | .id')

if [ -z "$HOSTNAME_ID" ]; then
  echo "::error::No Web3 Gateway hostname found for ${DNSLINK_DOMAIN}"
  echo "Available hostnames:"
  echo "$LIST_RESPONSE" | jq -r '.result[].name'
  exit 1
fi

echo "Found Web3 Gateway hostname (id=${HOSTNAME_ID}), patching dnslink..."

PATCH_RESPONSE=$(curl -s \
  -X PATCH \
  -H "Authorization: Bearer ${CLOUDFLARE_TOKEN}" \
  -H "Content-Type: application/json" \
  "${API_BASE}/zones/${CLOUDFLARE_ZONE_ID}/web3/hostnames/${HOSTNAME_ID}" \
  -d "$(jq -n --arg dnslink "$DNSLINK_VALUE" '{dnslink: $dnslink}')")

PATCH_SUCCESS=$(echo "$PATCH_RESPONSE" | jq -r '.success')
if [ "$PATCH_SUCCESS" != "true" ]; then
  echo "::error::Failed to update Web3 Gateway dnslink"
  echo "$PATCH_RESPONSE" | jq .
  exit 1
fi

echo "DNSLink updated successfully:"
echo "$PATCH_RESPONSE" | jq '.result | {id, name, dnslink, status, modified_on}'
