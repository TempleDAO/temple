import "@nomiclabs/hardhat-ethers";
import { ethers } from "hardhat";
import { ThresholdSafeGuard__factory } from "../../../../typechain";
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from "../../helpers";

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();

  const factory = new ThresholdSafeGuard__factory(owner);
  await deployAndMine(
    "Threshold Safe Guard", factory, factory.deploy,
    await owner.getAddress(), 3
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
