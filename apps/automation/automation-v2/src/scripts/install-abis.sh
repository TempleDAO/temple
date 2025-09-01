#!/bin/bash

set -e

REPO_ROOT=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )/../../../../.." &> /dev/null && pwd )

PROTOCOL_DIR=$REPO_ROOT/protocol
VIEM_ABI_DIR=$REPO_ROOT/apps/automation/automation-v2/src/abi

mk_viem_abi() {
   name=$1
   src=$PROTOCOL_DIR/artifacts-foundry/$name.sol/$name.json
   target=$VIEM_ABI_DIR/$name.ts
   echo "export const ABI = $(jq .abi $src) as const;" >$target
}

# Remove deprecated ABIs
rm -f $VIEM_ABI_DIR/*.ts

# Build artifacts
(cd $PROTOCOL_DIR; forge build contracts/templegold contracts/interfaces/templegold)

mk_viem_abi IAuctionBase
mk_viem_abi IERC20
mk_viem_abi IERC20Metadata
mk_viem_abi ISpiceAuction
mk_viem_abi ISpiceAuctionFactory
mk_viem_abi IStableGoldAuction
mk_viem_abi ITempleGold
mk_viem_abi ITempleGoldAdmin
mk_viem_abi ITempleGoldStaking
