#!/bin/bash

# Deploy templegold contracts on localhost (anvil fork)
# Usage: ./deploy-anvil.sh

# Start anvil fork (update RPC URL as needed)
# anvil --fork-url $MAINNET_RPC_URL

# Deploy in order:
# 1. External dependencies
npx hardhat --network localhost run scripts/deploys/localhost/templegold/01-external/01-temple-token.ts

# 2. Core contracts
npx hardhat --network localhost run scripts/deploys/localhost/templegold/02-core/01a-temple-gold.ts
npx hardhat --network localhost run scripts/deploys/localhost/templegold/02-core/01b-temple-gold-admin.ts
npx hardhat --network localhost run scripts/deploys/localhost/templegold/02-core/02-temple-teleporter.ts

# 3. Staking & Auction contracts
npx hardhat --network localhost run scripts/deploys/localhost/templegold/03-staking-auctions/03-temple-gold-staking.ts
npx hardhat --network localhost run scripts/deploys/localhost/templegold/03-staking-auctions/04-stable-gold-auction.ts
npx hardhat --network localhost run scripts/deploys/localhost/templegold/03-staking-auctions/05a-spice-implementation.ts
npx hardhat --network localhost run scripts/deploys/localhost/templegold/03-staking-auctions/05b-spice-factory.ts
npx hardhat --network localhost run scripts/deploys/localhost/templegold/03-staking-auctions/06-dai-tgld-spice.ts

# 4. Post-deploy setup
npx hardhat --network localhost run scripts/deploys/localhost/templegold/99-post-deploy/99-post-deploy.ts
npx hardhat --network localhost run scripts/deploys/localhost/templegold/99-post-deploy/02-ops.ts
