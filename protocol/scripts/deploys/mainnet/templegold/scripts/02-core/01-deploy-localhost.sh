#!/bin/bash

set -x
set -e

SCRIPT_DIR=`dirname $0`
DIRECTORY=`basename $SCRIPT_DIR`

npx hardhat run --network localhost scripts/deploys/mainnet/templegold/$DIRECTORY/01c-temple-gold.ts
npx hardhat run --network localhost scripts/deploys/mainnet/templegold/$DIRECTORY/01d-temple-admin.ts
npx hardhat run --network localhost scripts/deploys/mainnet/templegold/$DIRECTORY/02-temple-teleporter.ts
