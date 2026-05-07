import { ethers } from 'hardhat';
import {
    ensureExpectedEnvvars,
    mine,
} from '../../../helpers';
import { connectToContracts, getDeployedContracts } from '../contract-addresses';

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const INSTANCES = connectToContracts(owner);
    const ADDRS = getDeployedContracts();

    await mine(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.transferOwnership(ADDRS.CORE.EXECUTOR_MSIG));
    await mine(INSTANCES.TEMPLE_GOLD.SPICE_AUCTION_FACTORY.proposeNewExecutor(ADDRS.CORE.EXECUTOR_MSIG));
}
  
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
