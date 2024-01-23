import "@nomiclabs/hardhat-ethers";
import { ethers } from "hardhat";
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from "../../../helpers";
import { RamosTestnetAuraStaking__factory } from "../../../../../typechain";
import { getDeployedContracts } from '../contract-addresses';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const TEMPLE_V2_ADDRESSES = getDeployedContracts();

  const auraStakingFactory = new RamosTestnetAuraStaking__factory(owner);
  await deployAndMine(
      "RAMOS.TEMPLE_DAI.AURA_STAKING", auraStakingFactory, auraStakingFactory.deploy,
      TEMPLE_V2_ADDRESSES.CORE.RESCUER_MSIG,
      await owner.getAddress(),
      TEMPLE_V2_ADDRESSES.RAMOS.TEMPLE_DAI.BPT_TOKEN,
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
