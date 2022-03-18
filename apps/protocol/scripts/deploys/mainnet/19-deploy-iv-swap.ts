import "@nomiclabs/hardhat-ethers";
import { ethers, network } from "hardhat";
import {
  TempleIVSwap,
  TempleIVSwap__factory,
} from "../../../typechain";
import {
  deployAndMine,
  DEPLOYED_CONTRACTS,
  DeployedContracts,
  ensureExpectedEnvvars,
  mine,
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

  const templeIvSwapFactory = new TempleIVSwap__factory(owner);
  const templeIvSwap: TempleIVSwap = await deployAndMine(
    "TEMPLE_IV_SWAP",
    templeIvSwapFactory,
    templeIvSwapFactory.deploy,
    DEPLOYED.TEMPLE,
    DEPLOYED.FRAX,
    {frax: 65, temple: 100}, /* current IV on mainnet */
  );

  await mine(templeIvSwap.transferOwnership(DEPLOYED.MULTISIG));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
