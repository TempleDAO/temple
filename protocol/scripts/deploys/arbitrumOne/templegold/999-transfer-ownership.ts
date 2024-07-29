import { ethers } from 'hardhat';
import {
    ensureExpectedEnvvars,
    mine,
} from '../../helpers';
import { connectToContracts, getDeployedTempleGoldContracts } from '../contract-addresses';

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const TEMPLE_GOLD_ADDRESSES = getDeployedTempleGoldContracts();
    const TEMPLE_GOLD_INSTANCES = connectToContracts(owner);

    // Transfer ownership to the temple gold admin
    await mine(TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.transferOwnership(TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD_ADMIN));
}
  
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
