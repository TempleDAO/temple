import { ethers } from 'hardhat';
import {
    ensureExpectedEnvvars,
    mine,
} from '../../helpers';
import { connectToContracts, getDeployedTempleGoldContracts } from '../../mainnet/templegold/contract-addresses';

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const TEMPLE_GOLD_INSTANCES = connectToContracts(owner);
    const ADDRESSES = getDeployedTempleGoldContracts();

    // Transfer ownership of TGLD to executor msig
    await mine(TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.transferOwnership(ADDRESSES.TEMPLE_GOLD.EXECUTOR_MSIG));
    // Transfer ownership of Spice factory to executor msig
    await mine(TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.SPICE_AUCTION_FACTORY.proposeNewExecutor(ADDRESSES.TEMPLE_GOLD.EXECUTOR_MSIG));
}
  
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
