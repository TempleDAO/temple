# TempleDAO Protocol

## Dev Setup
```
nvm use
yarn
yarn test
```

## Environment Variables
Create a `.env` file in the root of the project with the following variables.

`ALCHEMY_API_KEY`: Used to fork mainnet when yarn test test/temple-zaps-tests.ts is run.

`ETHERSCAN_API_KEY`: Optional. hardhat.config.ts logs a message if it's not set.

`COINMARKETCAP_API_KEY`: Optional. Used to show USD values in the gas report that appears after testing.

`REPORT_GAS`: Optional. Set value to `true` to enable the gas report.

## Rinkeby Deployment
```
export RINKEBY_ADDRESS_PRIVATE_KEY=...  # export from metamask
export RINKEBY_RPC_URL=... 		# grab RPC url from metamask or create a relayer on alchemy

hardhat:testnet run scripts/deploys/rinkeby/{your-script-name}
```

Once successfully deployed on testnet, verify contract source on etherscan. If you use the `deployAndMine` helper when creating your
script, it will spit out the relevant command. It will look something like this

```
yarn hardhat verify --network rinkeby 0x359655dcB8A32479680Af81Eb38eA3Bb2B42Af54 
```

It's fine to have multiple versions of a contract on rinkeby, so it's okay to run before your PR is merged (and re-run if there are any
comments on the PR on how to best setup the deploy scripts.

You can also run and test locally by replacing `yarn hardhat:testnet` with `yarn hardhat:local`. You'll probably have to run some of the previous deploys
in order to setup the right local state

## Gas Reporter Settings

The gas reporter settings are in `hardhat.config.ts`. For more information, check out the [plugin docs](https://github.com/cgewecke/hardhat-gas-reporter).

```
gasReporter: {
  currency: // optional: defaults to EUR
  coinmarketcap: // optional: API key used to additionally display fiat values for gas costs
  gasPrice: // optional: defaults to ETH Gas Station price
  enabled: // reads from the REPORT_GAS env var
}
```
