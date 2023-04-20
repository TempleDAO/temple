import "@nomiclabs/hardhat-ethers";
import { ethers, network } from "hardhat";
import {
    AuraStaking__factory
} from "../../../../../typechain";
import {
  deployAndMine,
  DEPLOYED_CONTRACTS, 
  DeployedContracts,
  ensureExpectedEnvvars,
} from "../../../helpers";

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

  const auraStakingFactory: AuraStaking__factory = new AuraStaking__factory(owner);
  await deployAndMine(
      "RAMOS Aura Staking", auraStakingFactory, auraStakingFactory.deploy,
      "0x0000000000000000000000000000000000000000", // Temporary - operator needs setting in post-deploy
      DEPLOYED.TEMPLE_DAI_LP_TOKEN,
      DEPLOYED.AURA_BOOSTER,
      [DEPLOYED.BALANCER_TOKEN, DEPLOYED.AURA_TOKEN]
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
