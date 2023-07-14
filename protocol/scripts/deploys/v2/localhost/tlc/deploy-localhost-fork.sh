#!/bin/bash

set -x
set -e
npx hardhat run --network localhost scripts/deploys/v2/sepolia/02-circuit-breaker-proxy.ts
npx hardhat run --network localhost scripts/deploys/v2/sepolia/03-trv-tpi-oracle.ts
npx hardhat run --network localhost scripts/deploys/v2/sepolia/04-trv.ts
npx hardhat run --network localhost scripts/deploys/v2/sepolia/05-trv-dusd.ts
npx hardhat run --network localhost scripts/deploys/v2/sepolia/06-trv-dtemple-token.ts
npx hardhat run --network localhost scripts/deploys/v2/sepolia/07-tlc-IRM-linear-kink.ts
npx hardhat run --network localhost scripts/deploys/v2/sepolia/08-tlc.ts
npx hardhat run --network localhost scripts/deploys/v2/sepolia/09-tlc-circuit-breakers-dai.ts
npx hardhat run --network localhost scripts/deploys/v2/sepolia/10-tlc-circuit-breakers-temple.ts
npx hardhat run --network localhost scripts/deploys/v2/sepolia/11-dsr-base-strategy-mainnet.ts
npx hardhat run --network localhost scripts/deploys/v2/sepolia/12-temple-base-strategy.ts
npx hardhat run --network localhost scripts/deploys/v2/sepolia/13-tlc-strategy.ts
npx hardhat run --network localhost scripts/deploys/v2/sepolia/99a-v2-core-post-deployment-mainnet.ts
npx hardhat run --network localhost scripts/deploys/v2/sepolia/99b-tlc-post-deployment.ts

