# templegold-ops


## Getting Started

## Local Testing

### Use anvil to deploy contracts

- Clone git@github.com:TempleDAO/temple.git
- Run `anvil --fork-url $ARBITRUM_ONE_RPC_URL`
- Run `npx hardhat --network localhost run scripts/deploys/localhost/templegold/01-localhost.ts`
- Run `npx hardhat --network localhost run scripts/deploys/localhost/templegold/999-localhost.ts`
- Run `npx hardhat --network localhost run scripts/deploys/localhost/templegold/02-ops.ts`

### Update contracts

- Copy and paste new contract addresses at `src/config/contract_addresses/anvil.ts`
- Export variables. Run `export OVL_TASK_RUNNER_CONFIG=$(node src/scripts/export-config.ts)` or `yarn export-variables`

### Build & Run API Server

- `yarn dev:local`