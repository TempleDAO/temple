import "@nomiclabs/hardhat-ethers";
import { ethers, network } from "hardhat";
import {
  TempleZaps,
  TempleZaps__factory,
} from "../../../typechain";
import {
  deployAndMine,
  DEPLOYED_CONTRACTS,
  DeployedContracts,
  ensureExpectedEnvvars,
  mine
} from "../helpers";

import addresses from "../../../test/constants";

const { TEMPLE_STABLE_ROUTER } = addresses.contracts;
const addressZero = "0x0000000000000000000000000000000000000000";

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

  const templeZapsFactory: TempleZaps__factory = new TempleZaps__factory(owner);
  const templeZaps: TempleZaps = await deployAndMine(
    "Temple Zaps", templeZapsFactory, templeZapsFactory.deploy,
    DEPLOYED.TEMPLE,
    TEMPLE_STABLE_ROUTER,
    addressZero
  );

  // transfer ownership
  console.log('Transfering ownership');
  await mine(templeZaps.transferOwnership(DEPLOYED.MULTISIG));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });