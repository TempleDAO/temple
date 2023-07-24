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

- 1.1 Deploy circuit breaker proxy
  ```
  npx hardhat run --network mainnet scripts/deploys/mainnet/v2/core/02-circuit-breaker-proxy.ts
  ```

- 1.2 Deploy trv tpi oracle
  ```
  npx hardhat run --network mainnet scripts/deploys/mainnet/v2/core/03-trv-tpi-oracle.ts
  ```
 
- 1.3 Deploy treasury reserve vault (trv)
  ```
  npx hardhat run --network mainnet scripts/deploys/mainnet/v2/core/04-trv.ts
  ```
 
- 1.4 Deploy trv debt usd token
  ```
  npx hardhat run --network mainnet scripts/deploys/mainnet/v2/core/05-trv-dusd.ts
  ```

- 1.5 Deploy trv debt temple token
  ```
  npx hardhat run --network mainnet scripts/deploys/mainnet/v2/core/06-trv-dtemple-token.ts
  ```

- 1.6 Deploy dsr base strategy
  ```
  npx hardhat run --network mainnet scripts/deploys/mainnet/v2/core/07-dsr-base-strategy.ts
  ```

- 1.7 Deploy temple base strategy
  ```
  npx hardhat run --network mainnet scripts/deploys/mainnet/v2/core/08-temple-base-strategy.ts
  ```

- 1.8 Apply post deploy core functions
  ```
  npx hardhat run --network mainnet scripts/deploys/mainnet/v2/core/99-core-post-deployment.ts
  ```

### 2. Deploy tlc contracts via hardhat scripts

- 2.1 Deploy tlc interest rate model (IRM) linear kink
  ```
  npx hardhat run --network mainnet scripts/deploys/mainnet/v2/tlc/01-tlc-IRM-linear-kink.ts
  ```

- 2.2 Deploy temple line credit (tlc)
  ```
  npx hardhat run --network mainnet scripts/deploys/mainnet/v2/tlc/02-tlc.ts
  ```

- 2.3 Deploy tlc circuit breaker dai
  ```
  npx hardhat run --network mainnet scripts/deploys/mainnet/v2/tlc/03-tlc-circuit-breaker-dai.ts
  ```

- 2.4 Deploy tlc circuit breaker temple
  ```
  npx hardhat run --network mainnet scripts/deploys/mainnet/v2/tlc/04-tlc-circuit-breaker-temple.ts
  ```

- 2.5 Deploy tlc strategy
  ```
  npx hardhat run --network mainnet scripts/deploys/mainnet/v2/tlc/05-tlc-strategy.ts
  ```

- 2.6 Apply post deploy tlc functions 
  ```
  npx hardhat run --network mainnet scripts/deploys/mainnet/v2/tlc/99-tlc-post-deployment.ts
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

The new rescuer & executor msig contract addresses would need to perfomr a set of initial transactions to be able to operate as expected, please find below the steps required for this to happen:

- 5.1 Update the transaction builder batch file `scripts/deploys/mainnet/v2/post-deploy/temple-v2-transactions-batch.json`, change all the placeholders `0xXXXX` for the relevant address in `scripts/deploys/mainnet/v2/contract-addresses.ts` under the mainnet network.

- 5.2 Share the updated transaction builder batch file `temple-v2-transactions-batch.json` with any of the MC team members, that way they can import it in their safe app `https://app.safe.global/` > `transaction builder` and approve it accordingly.

