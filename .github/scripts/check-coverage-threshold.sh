#!/usr/bin/env bash
# Enforce a minimum line-coverage threshold on a subset of an lcov.info file.
#
# Foundry's `forge coverage --report lcov` emits paths relative to the cwd
# where it ran (e.g. `SF:src/hooks/NoopHook.sol`). This script aggregates LF
# (lines found) and LH (lines hit) across files that match INCLUDE_PREFIX and
# do not match any EXCLUDE_GLOBS, then fails if the ratio is below
# MIN_COVERAGE.
#
# Required env vars:
#   LCOV_FILE         - Path to lcov.info
#
# Optional env vars:
#   MIN_COVERAGE      - Integer percentage threshold (default: 80)
#   INCLUDE_PREFIX    - Only include files whose SF starts with this (default: empty = all)
#   EXCLUDE_GLOBS     - Space-separated list of prefixes to exclude (default: empty)

set -euo pipefail

: "${LCOV_FILE:?LCOV_FILE is required}"
: "${MIN_COVERAGE:=80}"
: "${INCLUDE_PREFIX:=}"
: "${EXCLUDE_GLOBS:=}"

if [ ! -f "$LCOV_FILE" ]; then
  echo "::error::LCOV_FILE not found: $LCOV_FILE"
  exit 1
fi

total_lines=0
hit_lines=0
current_file=""
include=false

while IFS= read -r line; do
  case "$line" in
    SF:*)
      current_file="${line#SF:}"
      include=true
      if [ -n "$INCLUDE_PREFIX" ] && [[ "$current_file" != "$INCLUDE_PREFIX"* ]]; then
        include=false
      fi
      if $include; then
        for glob in $EXCLUDE_GLOBS; do
          if [[ "$current_file" == "$glob"* ]]; then
            include=false
            break
          fi
        done
      fi
      ;;
    LF:*)
      if $include; then
        total_lines=$((total_lines + ${line#LF:}))
      fi
      ;;
    LH:*)
      if $include; then
        hit_lines=$((hit_lines + ${line#LH:}))
      fi
      ;;
  esac
done < "$LCOV_FILE"

if [ "$total_lines" -eq 0 ]; then
  echo "::warning::No covered lines matched filter (include='$INCLUDE_PREFIX', exclude='$EXCLUDE_GLOBS')."
  echo "::warning::Passing without enforcement — verify your filter and that forge coverage produced output."
  exit 0
fi

# Percentage computed in basis points to avoid floating-point.
pct_bp=$(( hit_lines * 10000 / total_lines ))
min_bp=$(( MIN_COVERAGE * 100 ))

pct_whole=$((pct_bp / 100))
pct_frac=$((pct_bp % 100))
printf "Line coverage: %d/%d = %d.%02d%% (threshold %d%%)\n" \
  "$hit_lines" "$total_lines" "$pct_whole" "$pct_frac" "$MIN_COVERAGE"

if [ "$pct_bp" -lt "$min_bp" ]; then
  echo "::error::Coverage $pct_whole.$(printf '%02d' $pct_frac)% is below the ${MIN_COVERAGE}% threshold."
  exit 1
fi

echo "Coverage meets threshold."
