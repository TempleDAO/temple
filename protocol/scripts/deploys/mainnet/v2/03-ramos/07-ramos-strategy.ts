import "@nomiclabs/hardhat-ethers";
import { ethers } from "hardhat";
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from "../../../helpers";
import { RamosStrategy__factory } from "../../../../../typechain";
import { getDeployedContracts } from '../contract-addresses';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const TEMPLE_V2_ADDRESSES = getDeployedContracts();

  const factory = new RamosStrategy__factory(owner);
  await deployAndMine(
    "STRATEGIES.RAMOS_STRATEGY.ADDRESS",
    factory,
    factory.deploy,
    TEMPLE_V2_ADDRESSES.CORE.RESCUER_MSIG,
    await owner.getAddress(),
    "RamosStrategy",
    TEMPLE_V2_ADDRESSES.TREASURY_RESERVES_VAULT.ADDRESS,
    TEMPLE_V2_ADDRESSES.RAMOS.TEMPLE_DAI.ADDRESS,
    TEMPLE_V2_ADDRESSES.CORE.TEMPLE_TOKEN,
    TEMPLE_V2_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN,
    TEMPLE_V2_ADDRESSES.CORE.CIRCUIT_BREAKER_PROXY,
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
