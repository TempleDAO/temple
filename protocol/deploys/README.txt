This directory contains a complete list of all on chain contract deployments

Directory Structure
  - `mainnet/` all contracts deployed on mainnet
  - `goreli/` all contracts deployed on goreli testnet
  - `contract-address.ts` all active deployed contracts (NOTE: to be deleted/unified with dapp)
  - `helpers.ts` common code to help deployments
  - `[0-9]+-some-script-name.ts` last migration script run. We try and make the script generic s.t it will run on both
  - `LEGACY-DEPLOYED.md` Contracts deployed and no longer used by temple. Listed here with some context for posterity
