#!/usr/bin/env bash
#
# Runs a Hardhat script for the given network, optionally prompting for a
# private key without echoing it to the terminal. If provided, the key is exposed
# only to the child Hardhat process via <NETWORK>_ADDRESS_PRIVATE_KEY. If left
# blank, no key is set and Hardhat config can fall back to its default signer.
#
# Usage:
#   scripts/run-hardhat.sh <network> <script> [extra hardhat args...]
#
# Example:
#   scripts/run-hardhat.sh mainnet scripts/deploy.ts

set -euo pipefail

network="${1:-}"
script="${2:-}"

if [[ -z "$network" || -z "$script" ]]; then
  echo "usage: $0 <network> <script> [extra hardhat args...]" >&2
  echo "example: $0 mainnet scripts/deploy.ts" >&2
  exit 1
fi

shift 2

network_upper="$(
  printf '%s' "$network" \
    | tr '[:lower:]' '[:upper:]' \
    | tr '-' '_'
)"

env_name="${network_upper}_ADDRESS_PRIVATE_KEY"

restore_tty() {
  stty echo 2>/dev/null || true
}

cleanup() {
  restore_tty
  unset pk
}

trap cleanup EXIT INT TERM

printf "Private key for %s, or Enter to use anvil signer [0]: " "$network" >&2

stty -echo
IFS= read -r pk
restore_tty
printf '\n' >&2

if [[ -n "${pk:-}" ]]; then
  pk="${pk#0x}"

  if [[ ! "$pk" =~ ^[0-9a-fA-F]{64}$ ]]; then
    echo "Invalid private key" >&2
    exit 1
  fi

  env "$env_name=0x$pk" yarn hardhat run --network "$network" "$script" "$@"
else
  yarn hardhat run --network "$network" "$script" "$@"
fi