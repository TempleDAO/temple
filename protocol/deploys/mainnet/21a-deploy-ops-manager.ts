import "@nomiclabs/hardhat-ethers";
import { ethers, network } from "hardhat";
import {
  OpsManager,
  OpsManager__factory,
  JoiningFee,
  JoiningFee__factory,
  VaultProxy,
  VaultProxy__factory,
  TempleStaking__factory,
  OpsManagerLib,
  OpsManagerLib__factory,
} from "../../../typechain";
import {
  deployAndMine,
  DEPLOYED_CONTRACTS,
  DeployedContracts,
  ensureExpectedEnvvars,
  mine,
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

    const joiningFeeFactory = new JoiningFee__factory(owner)
    const joiningFee: JoiningFee = await deployAndMine("Joining Fee", 
                joiningFeeFactory, 
                joiningFeeFactory.deploy, 
                15941331320609
        )

    const opsManagerLibFactory = new OpsManagerLib__factory(owner) //await (await ethers.getContractFactory("OpsManagerLib")).connect(owner);
    const opsManagerLib: OpsManagerLib = await deployAndMine("Ops Manager Lib", 
                opsManagerLibFactory, 
                opsManagerLibFactory.deploy
        )

    const opsManagerFactory = new OpsManager__factory({ "contracts/core/OpsManagerLib.sol:OpsManagerLib" : opsManagerLib.address }, owner)
    const opsManager: OpsManager = await deployAndMine("Ops Manager", 
                opsManagerFactory, 
                opsManagerFactory.deploy,
                DEPLOYED.TEMPLE,
                joiningFee.address
        )

    const templeStaking = new TempleStaking__factory(owner).attach(DEPLOYED.STAKING);

    const vaultProxyFactory = await new VaultProxy__factory(owner);
    const vaultProxy: VaultProxy = await deployAndMine("Vault Proxy",
                vaultProxyFactory,
                vaultProxyFactory.deploy,
                await templeStaking.OG_TEMPLE(),
                DEPLOYED.TEMPLE,
                DEPLOYED.STAKING,
                DEPLOYED.FAITH
    )

    console.log(`You'll need to set the Vault Proxy as a Faith Manager with the Multisig`);
    console.log(`Faith: ${DEPLOYED.FAITH}`);
    console.log(`Vault Proxy: ${vaultProxy.address}`);

    // transfer ownership

    await mine(joiningFee.transferOwnership(DEPLOYED.MULTISIG));
    await mine(opsManager.transferOwnership(DEPLOYED.MULTISIG));
    await mine(vaultProxy.transferOwnership(DEPLOYED.MULTISIG));

    // print vault details
    console.log(`*********`)
    console.log(`Details for running OpsManager#createVaultInstance for 1month vaults`)
    console.log(`*********`)
    const period = 60*60*24*28; // 28 days
    const window = 60*60*24*7; // 7 days
    const numOfVaults = period/window;

    const suffix = ['a','b','c','d']; // should only need 4 vault instances

    const time = await blockTimestamp();

    for (let i = 0; i < numOfVaults; i++) {
        const name = `temple-1m-vault`; //TODO confirm name
        const symbol = `temple-1m-vault-${suffix[i]}`;
        const ts = time + (i*window);

        const vaultProps: { [key: string]: string } = {
          name: name,
          symbol: symbol,
          periodDuration: period.toString(),
          enterExitWindowDuration: window.toString(),
          shareBoostFactory: "{p:1,q:1}",
          firstPeriodStartTimestamp: ts.toString()
        }

        console.log(`Parameters for vault ${symbol}`)
        for (const prop in vaultProps) {
          console.log(`${prop} = ${vaultProps[prop]}`)
        }

        console.log(`yarn hardhat verify --network rinkeby --constructor-args scripts/deploys/mainnet/temple-1m-vault-verify/temple-1m-vault-${suffix[i]}.js <vault-addr>`)
        console.log(`**********`)
    }

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });