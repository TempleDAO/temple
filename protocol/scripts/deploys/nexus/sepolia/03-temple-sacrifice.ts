import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { TempleSacrifice__factory } from '../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../helpers';
import { getDeployedContracts } from '../../v2/sepolia/contract-addresses';

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const TEMPLE_V2_DEPLOYED = getDeployedContracts();
    const relicAddress = ""

    const templeSacrifice = new TempleSacrifice__factory(owner);
    await deployAndMine(
        'TEMPLE_SACRIFICE',
        templeSacrifice,
        templeSacrifice.deploy,
        relicAddress,
        TEMPLE_V2_DEPLOYED.CORE.TEMPLE_TOKEN
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