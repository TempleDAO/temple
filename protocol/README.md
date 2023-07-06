# TempleDAO Protocol

## Dev Setup
```
nvm use
yarn
yarn test
```


## Goerli Deployment
```
export GOERLI_ADDRESS_PRIVATE_KEY=...  # export from metamask 
export GOERLI_RPC_URL=... 		# grab RPC url from metamask or create a relayer on alchemy

hardhat:testnet run scripts/deploys/goerli/{your-script-name}
```

Once successfully deployed on testnet, verify contract source on etherscan. If you use the `deployAndMine` helper when creating your
script, it will spit out the relevant command. It will look something like this

```
yarn hardhat verify --network goerli 0x359655dcB8A32479680Af81Eb38eA3Bb2B42Af54 
```

It's fine to have multiple versions of a contract on goerli, so it's okay to run before your PR is merged (and re-run if there are any
comments on the PR on how to best setup the deploy scripts.

You can also run and test locally by replacing `yarn hardhat:testnet` with `yarn hardhat:local`. You'll probably have to run some of the previous deploys
in order to setup the right local state



#### Local Deployment

The protocol app uses hardhat for development. The following steps will compile the contracts and deploy to a local hardhat node

```bash
# Compile the contracts
yarn compile

# Generate the typechain.
yarn typechain

The protocol test suite can be run without deploying to a local-node by running

```bash
# Run tests, no deployment neccessary
yarn test
```

#### Local Forks

##### 1. Temple V2 - TLC

```bash
# In one terminal window, run a local node forked off mainnet
yarn local-fork:mainnet

# In another window, run the deploy script
yarn local-fork:deploy:tlc

# Then finally some forked mainnet tests for TLC
yarn local-fork:test:tlc
```

## VSCode Testing

https://hardhat.org/guides/vscode-tests.html

tl;dr;
  1. Install https://marketplace.visualstudio.com/items?itemName=hbenl.vscode-mocha-test-adapter
  2. Set the VSCode config value `"mochaExplorer.files": "test/**/*.{j,t}s"`
  3. Reload VSCode, click the flask icon, see all tests :)

## Slither Static Code Analysis

1. Install `slither-analyzer`: <https://github.com/crytic/slither#using-pip>
2. `yarn slither`
3. For each category + finding, analyse and either:
   1. Fix the issue or
   2. If it's a false positive then ignore the finding by typing the list index number in the triage.
