import { ethers } from 'hardhat';
import {
    ensureExpectedEnvvars,
    mine,
} from '../../helpers';
import { connectToContracts } from '../../mainnet/templegold/contract-addresses';
import { getDeployedTempleGoldContracts } from '../../mainnet/templegold/contract-addresses';

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const TEMPLE_GOLD_INSTANCES = connectToContracts(owner);
    const TEMPLE_V2_ADDRESSES = getDeployedTempleGoldContracts();

    await mine(TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.transferOwnership(TEMPLE_V2_ADDRESSES.CORE.EXECUTOR_MSIG));
    await mine(TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.SPICE_AUCTION_FACTORY.proposeNewExecutor(TEMPLE_V2_ADDRESSES.CORE.EXECUTOR_MSIG));
}
  
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
