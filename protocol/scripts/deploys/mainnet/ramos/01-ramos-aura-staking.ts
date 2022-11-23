import "@nomiclabs/hardhat-ethers";
import { ethers, network } from "hardhat";
import {
    AuraStaking__factory
} from "../../../../typechain";
import amoAddresses from "../../../../test/amo/amo-constants";
import {
  deployAndMine,
  DEPLOYED_CONTRACTS, 
  DeployedContracts,
  ensureExpectedEnvvars,
} from "../../helpers";


const { AURA_BOOSTER } = amoAddresses.mainnet.contracts;
const { BALANCER_TOKEN, AURA_TOKEN, TEMPLE_BBAUSD_LP_TOKEN } = amoAddresses.mainnet.tokens;

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
      DEPLOYED.RAMOS,
      TEMPLE_BBAUSD_LP_TOKEN,
      AURA_BOOSTER,
      [BALANCER_TOKEN, AURA_TOKEN]
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
