import "@nomiclabs/hardhat-ethers";
import { ethers, network } from "hardhat";
import { BigNumber } from "ethers";
import {
  PoolHelper__factory
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

  const poolHelperFactory = new PoolHelper__factory(owner);
  await deployAndMine(
    "RAMOS Pool Helper", poolHelperFactory, poolHelperFactory.deploy,
    DEPLOYED.BALANCER_VAULT,
    DEPLOYED.TEMPLE,
    DEPLOYED.BB_E_USD_TOKEN,
    DEPLOYED.TEMPLE_BB_E_USD_LP_TOKEN,
    DEPLOYED.RAMOS_BB_E_USD,
    BigNumber.from(0),
    DEPLOYED.TEMPLE_BB_E_USD_BALANCER_POOL_ID
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
