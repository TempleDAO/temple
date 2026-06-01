#!/bin/bash

set -x
set -e

SCRIPT_DIR=`dirname $0`
DIRECTORY=`basename $SCRIPT_DIR`

npx hardhat run --network localhost scripts/deploys/mainnet/templegold/$DIRECTORY/03-temple-gold-staking.ts
npx hardhat run --network localhost scripts/deploys/mainnet/templegold/$DIRECTORY/04-stable-gold-auction.ts
npx hardhat run --network localhost scripts/deploys/mainnet/templegold/$DIRECTORY/05b-spice-factory.ts
