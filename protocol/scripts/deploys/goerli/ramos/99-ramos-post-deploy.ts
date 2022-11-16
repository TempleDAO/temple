import "@nomiclabs/hardhat-ethers";
import { ethers, network } from "hardhat";
import {
  RAMOSGoerli__factory
} from "../../../../typechain";
import {
  DEPLOYED_CONTRACTS, 
  DeployedContracts,
  ensureExpectedEnvvars,
  mine
} from "../../helpers";


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

    const ramos = RAMOSGoerli__factory.connect(DEPLOYED.RAMOS, owner);

    // ramos
    await mine(ramos.setPoolHelper(DEPLOYED.RAMOS_POOL_HELPER));
    await mine(ramos.transferOwnership(DEPLOYED.MULTISIG));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });