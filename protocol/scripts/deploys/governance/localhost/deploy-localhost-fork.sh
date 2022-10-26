#!/bin/bash

# When deploying locally as a fork off mainnet
# First start local node with:
#    npx hardhat node --fork-block-number 14702622 --fork "https://eth-mainnet.alchemyapi.io/v2/XXX"

set -x
set -e
npx hardhat run --network localhost scripts/deploys/governance/gnosis/01-templar-nft.ts
npx hardhat run --network localhost scripts/deploys/governance/gnosis/02-elder-election.ts
npx hardhat run --network localhost scripts/deploys/governance/gnosis/100-transfer-ownership.ts
