import "@nomiclabs/hardhat-ethers";
import { ethers, network } from "hardhat";
import { BaseContract, BigNumber, ContractFactory, ContractTransaction } from "ethers";
import {
  OpsManager,
  OpsManager__factory,
  OpsManagerLib,
  OpsManagerLib__factory,
  JoiningFee__factory
} from "../../../typechain";
import {
  deployAndMine,
  DEPLOYED_CONTRACTS,
  DeployedContracts,
  ensureExpectedEnvvars,
  mine,
  toAtto,
  blockTimestamp
} from "../helpers";

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();

    let DEPLOYED: DeployedContracts;

    if (DEPLOYED_CONTRACTS[network.name] === undefined) {
        console.log(`No contracts configured for ${network.name}`);
        return;
    } else {
        DEPLOYED = DEPLOYED_CONTRACTS[network.name];
    }

    const opsManager = await new OpsManager__factory({ "contracts/core/OpsManagerLib.sol:OpsManagerLib" : DEPLOYED.OPS_MANAGER_LIB }, owner)
                .attach(DEPLOYED.OPS_MANAGER);

    const period = 60*60*24*28; // 28 days
    const window = 60*60*24*7; // 7 days
    const numOfVaults = period/window;

    const suffix = ['a','b','c','d']; // should only need 4 vault instances

    const time = await blockTimestamp(); // lets ensure we've deployed all
    console.log(time);

    for (let i = 0; i < numOfVaults; i++) {
        const name = `temple-1m-vault`; //TODO confirm name
        const symbol = `temple-1m-vault-${suffix[i]}`;
        const ts = time + (i*window);

        const tx = await opsManager.createVaultInstance(
            name,
            symbol,
            period,
            window,
            {p:1,q:1},
            ts
        );

        const vaultAddr = await extractDeployedAddress(tx, "CreateVaultInstance");
        console.log(`Deployed vault ${name} with symbol ${symbol} at ${vaultAddr}`);
        console.log(`period: ${period}, window: ${window}, timestamp: ${ts}`);
        console.log(`yarn hardhat verify --network rinkeby --constructor-args scripts/deploys/mainnet/temple-1m-vault-verify/temple-1m-vault-${suffix[i]}.js ${vaultAddr}`)
    }
}

async function extractDeployedAddress(tx: ContractTransaction, eventName: string) : Promise<string> {
    let result = 'FAILED TO FIND';
    await tx.wait(0).then(receipt => {
      let event = receipt.events?.filter(evt => {
        if (evt.event) {
          return evt.event === eventName
        };
      })[0];
  
      if (event?.args) {
        result = event.args[0]
      }
    })
  
    return result;
  }

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });