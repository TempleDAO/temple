import "@nomiclabs/hardhat-ethers";
import { ethers } from "hardhat";
import {
    GnosisStrategy__factory
} from "../../../../../typechain";
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from "../../../helpers";
import { getDeployedContracts } from '../contract-addresses';

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const TEMPLE_V2_ADDRESSES = getDeployedContracts();

    const factory = new GnosisStrategy__factory(owner);
    await deployAndMine(
        "STRATEGIES.TEMPLO_MAYOR_GNOSIS_STRATEGY.ADDRESS",
        factory,
        factory.deploy,
        TEMPLE_V2_ADDRESSES.CORE.RESCUER_MSIG,
        await owner.getAddress(),
        "TemploMayorStrategy",
        TEMPLE_V2_ADDRESSES.TREASURY_RESERVES_VAULT.ADDRESS,
        TEMPLE_V2_ADDRESSES.STRATEGIES.TEMPLO_MAYOR_GNOSIS_STRATEGY.UNDERLYING_GNOSIS_SAFE,
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
