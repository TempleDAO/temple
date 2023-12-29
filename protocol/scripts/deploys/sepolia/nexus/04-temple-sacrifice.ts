import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { TempleSacrifice__factory } from '../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars
} from '../../helpers';
import { getDeployedContracts } from "./contract-addresses";

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const deployedContracts = getDeployedContracts();

    const templeSacrifice = new TempleSacrifice__factory(owner);
    const executor = await owner.getAddress();
    await deployAndMine(
        'NEXUS.TEMPLE_SACRIFICE',
        templeSacrifice,
        templeSacrifice.deploy,
        deployedContracts.NEXUS.RELIC,
        deployedContracts.CORE.TEMPLE_TOKEN,
        executor, // sacrificed token recipient
        executor // initial executor
    );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });