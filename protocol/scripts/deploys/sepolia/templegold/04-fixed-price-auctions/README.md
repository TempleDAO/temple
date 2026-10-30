# Sepolia FPA deployment scripts

Prepared against `fpa-frozen-inputs` at `9239f7dae0b6247d6611d8f54f78b576ef32b2f6`.
These files are a copy-in overlay for the Temple repository. Nothing has been deployed.

## Copy into the branch

Copy this folder's `protocol/` contents into the repository's `protocol/` directory.
The seven scripts under `04-fixed-price-auctions/` are new. Three existing files have
small additions: `default-settings.ts`, `contract-addresses/sepolia.ts` and
`contract-addresses/types.ts`. Merge those additions if your branch has newer edits.

The scripts use the existing TypeChain factories, `getDeployContext`, `deployAndMine`,
`mine` and `runAsyncMain`. Shared helpers and the existing deployment scripts are unchanged.
The new contracts are connected directly in the scripts that need them; no changes to
the shared contract-instance connector are required.

## Before running

- Run from `protocol/`, with the branch's dependencies installed (including Solady).
- Run `yarn hardhat compile` to generate the current TypeChain factories.
- Configure `SEPOLIA_RPC_URL` and `SEPOLIA_ADDRESS_PRIVATE_KEY` using your existing environment setup.
- Set `DEFAULT_SETTINGS.GRANARY.RESCUER` to a controlled test address different from
  the deployer. The existing `CORE.RESCUER_MSIG` public Anvil address is deliberately not used.
- The deployer becomes the initial executor of the factory and compliance list.
  Auctions inherit the factory's current executor and rescuer when created.
- Set `GRANARY.FLAGGER` to the test Overlord address before post-deploy setup.
- Fund the signers with Sepolia ETH.

## Deploy, recording addresses between steps

Run each command individually. `deployAndMine` prints the address and verification
command and saves constructor arguments under `scripts/deploys/sepolia/deploymentArgs/`.
It does not automatically update `contract-addresses/sepolia.ts`.

```sh
yarn hardhat run --network sepolia scripts/deploys/sepolia/templegold/04-fixed-price-auctions/01-fixed-price-auction-implementation.ts
```

Save the address in `GRANARY.FIXED_PRICE_AUCTION_IMPLEMENTATION`.

```sh
yarn hardhat run --network sepolia scripts/deploys/sepolia/templegold/04-fixed-price-auctions/02-compliance-check.ts
```

Save the address in `GRANARY.COMPLIANCE_CHECK`.

```sh
yarn hardhat run --network sepolia scripts/deploys/sepolia/templegold/04-fixed-price-auctions/03-fixed-price-auction-factory.ts
```

Save the address in `GRANARY.FIXED_PRICE_AUCTION_FACTORY`.

```sh
yarn hardhat run --network sepolia scripts/deploys/sepolia/templegold/04-fixed-price-auctions/04-wishing-well.ts
```

Save the address in `GRANARY.WISHING_WELL`.

## Optional test USDS and example auction

For continuity with the frontend's earlier tests, the config now uses:

- TEMPLE: `0x64a925B0fA211c44337148C0807f959Bd44b0B67`.
- USDS stand-in: `0xBe9162230D9e637218D74C7f41f62ef2385fEe64` (previously configured as test DAI; its on-chain symbol may still be DAI).

Skip step 05 when using these existing tokens. Changing this config does not change
the token pair of an already-created auction. Read its `getConfig()` and create a
new auction if the existing instance uses different tokens.

```sh
yarn hardhat run --network sepolia scripts/deploys/sepolia/templegold/04-fixed-price-auctions/05-usds-token.ts
```

Save the address in `EXTERNAL.SKY.USDS`. This is the existing `FakeERC20` with public
mint/burn, 18 decimals and 100,000 initial tokens for the deployer, not production USDS.
Skip this deployment if reusing an existing suitable test token.

Review the pair and settings in `06-create-auction.ts` and `GRANARY.AUCTION` first.
The example sells existing test TEMPLE for test USDS at 4 USDS per TEMPLE, with a
1 TEMPLE minimum, a 25-hour lead, a one-day deposit window and a one-day fulfillment
window. The extra lead hour allows transaction inclusion above the on-chain one-day
minimum. The deployer is both funder and proceeds recipient.

```sh
yarn hardhat run --network sepolia scripts/deploys/sepolia/templegold/04-fixed-price-auctions/06-create-auction.ts
```

Save the emitted address in `GRANARY.FIXED_PRICE_AUCTION`. Each execution creates
a new auction; it does not update an existing auction. Creation does not deposit or
fund tokens. Funding is permitted only after the deposit window ends. Confirm test
bidder balances and allowances separately.

## TGLD authorization and flagger setup

`99-post-deploy.ts` runs two separate functions: `authorizeTgldAuction` and
`setFlagger`. Save the auction address and configure `GRANARY.FLAGGER` first.

```sh
yarn hardhat run --network sepolia scripts/deploys/sepolia/templegold/04-fixed-price-auctions/99-post-deploy.ts
```

TGLD authorization skips non-TGLD pairs and already-authorized auctions. If testing
TGLD, change the example's pair and review its price and minimum before creation.
Authorize each clone before it opens, not only the implementation or factory, and
retain authorization while claims or refunds need TGLD transfers.

The signer needs compliance executor authority for `setFlagger`, and TGLD owner
authority if authorization is required. If these are different accounts, submit
`authorizeContract(auctionAddress, true)` through the TGLD owner first, then run this
script with the compliance executor. The authorization step will skip it on rerun.
Existing TGLD ownership and balances still need checking; these scripts do not mint
or bridge TGLD.

Flagger setup grants `setFlagged` authority to the test Overlord. It does not flag
any bidder. Exclusion still needs a separate call on each relevant auction. The two
setup transactions are separate, not atomic.

## Indexer and verification handoff

Record deployment transaction hashes and block numbers for the factory, implementation,
compliance list and WishingWell. Provide those addresses, start blocks, generated ABIs,
token addresses and the implementation-to-decoder mapping to the indexer/UI team.
`06-create-auction.ts` prints the clone address and creation block from its receipt.
Verify standalone deployments using the commands printed by `deployAndMine`; an auction
clone is created by the factory, not by a standalone Solidity constructor deployment.

## Validation

TypeScript syntax was checked and constructor/function arguments compared with the
pinned branch source. No deployment, transaction, Forge test, or full Hardhat/TypeChain
type-check was run. Run `yarn hardhat compile` and the repository's TypeScript check
after copying into the branch; this overlay alone does not contain the repo dependencies.
