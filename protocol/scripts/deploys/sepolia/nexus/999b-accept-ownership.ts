import { ethers } from 'hardhat';
import {
    ensureExpectedEnvvars,
    mine
} from '../../helpers';
import { connectToContracts } from './contract-addresses';

async function main() {
    ensureExpectedEnvvars();
  
    const [owner] = await ethers.getSigners();
    const deployedContracts = connectToContracts(owner);

    await mine(deployedContracts.NEXUS.NEXUS_COMMON.acceptExecutor());
    await mine(deployedContracts.NEXUS.RELIC.acceptExecutor());
    await mine(deployedContracts.NEXUS.SHARD.acceptExecutor());
    await mine(deployedContracts.NEXUS.TEMPLE_SACRIFICE.acceptExecutor());
    await mine(deployedContracts.NEXUS.PARTNER_ZERO_SACRIFICE.acceptExecutor());
}
  
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });