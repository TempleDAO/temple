import "@nomiclabs/hardhat-ethers";
import { ethers, network } from "hardhat";
import {
  GenericZap,
  GenericZap__factory,
} from "../../../typechain";
import {
  deployAndMine,
  DEPLOYED_CONTRACTS,
  DeployedContracts,
  ensureExpectedEnvvars,
  mine
} from "../helpers";

import addresses from "../../../test/constants";
const { UNISWAP_V2_ROUTER } = addresses.contracts;

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

  const genericZapsFactory: GenericZap__factory = new GenericZap__factory(owner);
  const genericZaps: GenericZap = await deployAndMine(
    "Generic Zaps", genericZapsFactory, genericZapsFactory.deploy,
    UNISWAP_V2_ROUTER
  );

  // transfer ownership
  console.log('Transfering ownership');
  await mine(genericZaps.transferOwnership(DEPLOYED.MULTISIG));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });