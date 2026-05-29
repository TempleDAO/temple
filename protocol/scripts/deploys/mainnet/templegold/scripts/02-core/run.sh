#!/bin/bash

EXPECTED_BLOCK_NUMBER=25200020

echo "Start anvil with:"
echo "    $ anvil --hardfork cancun --fork-url \$MAINNET_RPC_URL --fork-block-number $EXPECTED_BLOCK_NUMBER"

FOUND_BLOCK_NUMBER=`cast block-number`
if [ "$FOUND_BLOCK_NUMBER" -ne "$EXPECTED_BLOCK_NUMBER" ]; then
    echo "Unexpected block number found in anvil"
    exit -1
fi

set -e
set -x

cast rpc anvil_setBlockTimestampInterval 1

SCRIPT_DIR=`dirname $0`
$SCRIPT_DIR/01-deploy-localhost.sh
npx hardhat run --network localhost $SCRIPT_DIR/02-verify-localhost.ts