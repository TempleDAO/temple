import "@nomiclabs/hardhat-ethers";
import { ethers, network } from "hardhat";
import {
  InstantExitQueue__factory,
} from "../../../typechain";
import {
  deployAndMine,
  DEPLOYED_CONTRACTS,
  DeployedContracts,
  ensureExpectedEnvvars,
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

    const instantExitQueueFactory = await new InstantExitQueue__factory(owner);
    const instantExitQueue = await deployAndMine("Instant Exit Queue",
                instantExitQueueFactory,
                instantExitQueueFactory.deploy,
                DEPLOYED.STAKING,
                DEPLOYED.TEMPLE
    )

    // No ownership transfer necessary

    console.log(`You'll need to set the Instant Exit Queue as the Exit Queue for the Temple Staking contract.`);
    console.log(`Temple Staking: ${DEPLOYED.STAKING}`);
    console.log(`Instant Exit Queue: ${instantExitQueue.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });