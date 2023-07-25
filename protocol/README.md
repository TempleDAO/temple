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


## Temple V2 & TLC deployment

The following are the steps to deploy temple v2 & tlc latest contracts to mainnet. Copy & paste each `npx hardhat run ...` command from `v2 core` & `tlc` in order to deploy to mainnet, after each successful deployment, please do the following:

- (**mandatory**) Copy newest generated contract address in its respective place under `scripts/deploys/mainnet/v2/core/contract-addressses.ts`
- (**recommended**) Verify & publish contract src to etherscan:
  ```
  npx hardhat verify --network mainnet XXXX --constructor-args scripts/deploys/mainnet/deploymentArgs/XXXX.js
  ```


### 1. Deploy v2 core contracts via hardhat scripts

Deploy all the temple v2 core contracts under `$workspace/protocol/scripts/deploys/mainnet/v2/core/**.ts` following the script template bellow (replace as required):

```
npx hardhat run --network mainnet scripts/deploys/mainnet/v2/core/XXXX.ts
```

### 2. Deploy tlc contracts via hardhat scripts

Deploy all the new tlc contracts under `$workspace/protocol/scripts/deploys/mainnet/v2/tlc/**.ts` following the script template bellow (replace as required):

```
npx hardhat run --network mainnet scripts/deploys/mainnet/v2/tlc/XXXX.ts
```

### 3. Commit & merge to main

- 3.1 Create a new PR and commit the latest changes from above steps for another member(s) of the team to confirm

### 4. Renounce ownership from deployer to multisigs

- 4.1 Once msig addresses have been approved by temple core team, please update both EXECUTOR & RESCUER multisig addresses (`mainnet.**.**.**_MSIG`) in `scripts/deploys/mainnet/v2/contract-addresses.ts` file. Be aware that strategies may have different executor/rescuer msig.

- 4.2 Renounce deployer ownership to predefined msig addresses on the step above with
  ```
  npx hardhat run --network mainnet scripts/deploys/mainnet/v2/post-deploy/999-transfer-ownership.ts
  ```

### 5. Initial rescuer & executor msig transactions

The new rescuer & executor msig contract addresses would need to perform a set of initial transactions to be able to operate as expected, please find below the steps required:

- 5.1 Update the transaction builder batch files `scripts/deploys/mainnet/v2/post-deploy/temple-v2-XXX-transactions-batch.json`, change all the placeholders `0xXXXX` for the relevant address in `scripts/deploys/mainnet/v2/contract-addresses.ts` under the mainnet network.

- 5.2 Share the updated transaction builder batch file `temple-v2-XXX-transactions-batch.json` with any of the MC team members, that way they can import it in their safe app `https://app.safe.global/` > `transaction builder` and approve it accordingly. Please be sure to share each file accordingly to the msig address.

