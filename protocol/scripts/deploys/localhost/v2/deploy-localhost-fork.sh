#!/bin/bash

set -x
set -e

# v2-core
npx hardhat run --network localhost scripts/deploys/mainnet/v2/core/02-circuit-breaker-proxy.ts
npx hardhat run --network localhost scripts/deploys/mainnet/v2/core/03-trv-tpi-oracle.ts
npx hardhat run --network localhost scripts/deploys/mainnet/v2/core/04-trv.ts
npx hardhat run --network localhost scripts/deploys/mainnet/v2/core/05-trv-dusd.ts
npx hardhat run --network localhost scripts/deploys/mainnet/v2/core/06-trv-dtemple-token.ts
npx hardhat run --network localhost scripts/deploys/mainnet/v2/core/07-dsr-base-strategy.ts
npx hardhat run --network localhost scripts/deploys/mainnet/v2/core/08-temple-base-strategy.ts
npx hardhat run --network localhost scripts/deploys/mainnet/v2/core/99-core-post-deployment.ts

# tlc
npx hardhat run --network localhost scripts/deploys/mainnet/v2/tlc/01-tlc-IRM-linear-kink.ts
npx hardhat run --network localhost scripts/deploys/mainnet/v2/tlc/02-tlc.ts
npx hardhat run --network localhost scripts/deploys/mainnet/v2/tlc/03-tlc-circuit-breakers-dai.ts
npx hardhat run --network localhost scripts/deploys/mainnet/v2/tlc/04-tlc-circuit-breakers-temple.ts
npx hardhat run --network localhost scripts/deploys/mainnet/v2/tlc/05-tlc-strategy.ts
npx hardhat run --network localhost scripts/deploys/mainnet/v2/tlc/99-tlc-post-deployment.ts


