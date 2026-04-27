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

    // Transfer ownership of TGLD to executor msig
    // Originally, ownership was intended for the TempleGoldAdmin contract. But executor is handling this well now.
    // await mine(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD.transferOwnership(ADDRS.CORE.EXECUTOR_MSIG));
    // Transfer ownership of Spice factory to executor msig
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
