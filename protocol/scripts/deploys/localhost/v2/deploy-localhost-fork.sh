#!/bin/bash

set -x
set -e

# v2-core
npx hardhat run --network localhost scripts/deploys/mainnet/v2/01-core/02-circuit-breaker-proxy.ts
npx hardhat run --network localhost scripts/deploys/mainnet/v2/01-core/03-trv-tpi-oracle.ts
npx hardhat run --network localhost scripts/deploys/mainnet/v2/01-core/04-trv.ts
npx hardhat run --network localhost scripts/deploys/mainnet/v2/01-core/05-trv-dusd.ts
npx hardhat run --network localhost scripts/deploys/mainnet/v2/01-core/06-trv-dtemple-token.ts
npx hardhat run --network localhost scripts/deploys/mainnet/v2/01-core/07-dsr-base-strategy.ts
npx hardhat run --network localhost scripts/deploys/mainnet/v2/01-core/08-temple-base-strategy.ts
npx hardhat run --network localhost scripts/deploys/mainnet/v2/01-core/09-threshold-safe-guard.ts
npx hardhat run --network localhost scripts/deploys/mainnet/v2/01-core/99-core-post-deployment.ts

# tlc
npx hardhat run --network localhost scripts/deploys/mainnet/v2/02-tlc/01-tlc-IRM-linear-kink.ts
npx hardhat run --network localhost scripts/deploys/mainnet/v2/02-tlc/02-tlc.ts
npx hardhat run --network localhost scripts/deploys/mainnet/v2/02-tlc/03-tlc-circuit-breaker-dai.ts
npx hardhat run --network localhost scripts/deploys/mainnet/v2/02-tlc/04-tlc-circuit-breaker-temple.ts
npx hardhat run --network localhost scripts/deploys/mainnet/v2/02-tlc/05-tlc-strategy.ts
npx hardhat run --network localhost scripts/deploys/mainnet/v2/02-tlc/99-tlc-post-deployment.ts

# ramos
npx hardhat run --network localhost scripts/deploys/mainnet/v2/03-ramos/02-ramos-aura-staking.ts
npx hardhat run --network localhost scripts/deploys/mainnet/v2/03-ramos/03-ramos-amo.ts
npx hardhat run --network localhost scripts/deploys/mainnet/v2/03-ramos/04-ramos-pool-helper.ts
npx hardhat run --network localhost scripts/deploys/mainnet/v2/03-ramos/05-ramos-circuit-breakers-dai.ts
npx hardhat run --network localhost scripts/deploys/mainnet/v2/03-ramos/06-ramos-circuit-breakers-temple.ts
npx hardhat run --network localhost scripts/deploys/mainnet/v2/03-ramos/07-ramos-strategy.ts
npx hardhat run --network localhost scripts/deploys/mainnet/v2/03-ramos/99-ramos-post-deploy.ts

# gnosis - when we have a real use case, create an actual strategy (not a template) and test.
npx hardhat run --network localhost scripts/deploys/mainnet/v2/04-templo-mayor-gnosis-strategy/01-gnosis-safe-circuit-breakers-dai.ts
# Temple CB not needed for Templo Mayor
# npx hardhat run --network localhost scripts/deploys/mainnet/v2/04-templo-mayor-gnosis-strategy/02-gnosis-safe-circuit-breakers-temple.ts
npx hardhat run --network localhost scripts/deploys/mainnet/v2/04-templo-mayor-gnosis-strategy/03-gnosis-strategy.ts
npx hardhat run --network localhost scripts/deploys/mainnet/v2/04-templo-mayor-gnosis-strategy/99-post-deploy.ts

# post-deploy scripts
npx hardhat run --network localhost scripts/deploys/mainnet/v2/99-post-deploy/999-transfer-ownership.ts