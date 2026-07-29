#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./csv-to-json.sh json/epoch32a.csv
#
# Writes:
#   json/epoch32a.json

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 input.csv" >&2
  exit 1
fi

input="$1"

if [[ ! -f "$input" ]]; then
  echo "ERROR: file not found: $input" >&2
  exit 1
fi

output="${input%.*}.json"

awk -F',' '
BEGIN {
  print "{"
  first = 1
  expected_total = ""
  actual_total = 0
}

NR == 1 {
  next
}

{
  # Strip possible CR from mac/windows CSVs
  gsub(/\r$/, "", $1)
  gsub(/\r$/, "", $2)

  amount = $1
  address = $2

  # Final total row, e.g.:
  # 206850,
  if (address == "") {
    expected_total = amount
    next
  }

  actual_total += amount

  if (!first) {
    print ","
  }

  printf "  \"%s\": %s", address, amount
  first = 0
}

END {
  print ""
  print "}"

  if (expected_total == "") {
    print "ERROR: no trailing total row found" > "/dev/stderr"
    exit 1
  }

  if (actual_total != expected_total) {
    printf "ERROR: total mismatch: expected %s, got %s\n", expected_total, actual_total > "/dev/stderr"
    exit 1
  }

  printf "OK: total verified: %s\n", actual_total > "/dev/stderr"
}
' "$input" > "$output"

echo "Wrote $output"
