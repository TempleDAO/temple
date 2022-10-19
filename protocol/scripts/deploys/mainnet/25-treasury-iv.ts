import "@nomiclabs/hardhat-ethers";
import { ethers, network } from "hardhat";
import {
  TreasuryIV,
  TreasuryIV__factory,
} from "../../../typechain";
import {
  deployAndMine,
  DEPLOYED_CONTRACTS,
  DeployedContracts,
  ensureExpectedEnvvars,
  mine
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

  // IV = 0.97 by default.
  const treasuryIvFactory = new TreasuryIV__factory(owner);
  const treasuryIv: TreasuryIV = await deployAndMine(
    "Temple Treasury IV", treasuryIvFactory, treasuryIvFactory.deploy,
    9700,
    10000,
  );

  // transfer ownership
  console.log('Transfering ownership');
  await mine(treasuryIv.transferOwnership(DEPLOYED.MULTISIG));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
