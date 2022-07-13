# Deploying Core Contracts

Checklist of scripts / txs to run when deploying core contracts. 

* Run 20-deploy-ops-manager.ts - this deploys: JoiningFee, OpsManagerLib, OpsManager (and links to OpsManagerLib), VaultProxy and InstantExitQueue. Keep note of the output as these will contain the appropriate commands to verify the contracts on Etherscan. 

```
npx hardhat run scripts/deploys/rinkeby/20-deploy-ops-manager.ts --network rinkeby
```

* Need to set the InstantExitQueue as the ExitQueue for TempleStaking - `TempleStaking#setExitQueue`
* Need to set VaultProxy as a Faith Manager in the Faith Contract - `Faith#addManager`
* Transfer ownership of JoiningFee to MSig
* Transfer ownership of OpsManager to MSig
* Transfer ownership of VaultProxy to MSig
* Transfer ownership of InstantExitQueue to MSig
* Ensure VaultProxy is funded (not strictly necessary at this step but must be done before launch)
* Update `protocol/scripts/deploys/helpers.ts` with the new addresses for JoiningFee, OpsManagerLib, OpsManager, VaultProxy and InstantExitQueue
* Run 21-deploy-30min-vaults.ts - this will call `OpsManager#createVault`
* Update js files in `protocol/scripts/deploys/rinkeby/30-min-vault-verify/` with the JoiningFee address, and the timestamps (should really automate this) 

* Verify ALL the things on Etherscan
