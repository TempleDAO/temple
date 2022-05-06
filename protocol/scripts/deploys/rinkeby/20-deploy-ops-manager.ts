import "@nomiclabs/hardhat-ethers";
import { ethers, network } from "hardhat";
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
  toAtto
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

    const joiningFeeFactory = await new JoiningFee__factory(owner)
    const joiningFee = await deployAndMine("Joining Fee", 
                joiningFeeFactory, 
                joiningFeeFactory.deploy, 
                toAtto(0.0001)
        )

    const opsManagerLibFactory = await (await ethers.getContractFactory("OpsManagerLib")).connect(owner);
    const opsManagerLib = await deployAndMine("Ops Manager Lib", 
                opsManagerLibFactory, 
                opsManagerLibFactory.deploy
        )

    const opsManagerFactory = await new OpsManager__factory({ "contracts/core/OpsManagerLib.sol:OpsManagerLib" : opsManagerLib.address }, owner)
    const opsManager = await deployAndMine("Ops Manager", 
                opsManagerFactory, 
                opsManagerFactory.deploy,
                DEPLOYED.TEMPLE,
                joiningFee.address
        )
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });