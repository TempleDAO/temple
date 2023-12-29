import { ethers } from 'hardhat';
import {
    ensureExpectedEnvvars,
    mine
} from '../../helpers';
import { connectToContracts, getDeployedContracts } from './contract-addresses';

async function main() {
    ensureExpectedEnvvars();
  
    const [owner] = await ethers.getSigners();
    const multisig = getDeployedContracts().CORE.CORE_MULTISIG;
    const deployedContracts = connectToContracts(owner);

    await mine(deployedContracts.CORE.TEMPLE_TOKEN.transferOwnership(multisig));

    await mine(deployedContracts.NEXUS.NEXUS_COMMON.proposeNewExecutor(multisig));
    await mine(deployedContracts.NEXUS.RELIC.proposeNewExecutor(multisig));
    await mine(deployedContracts.NEXUS.SHARD.proposeNewExecutor(multisig));
    await mine(deployedContracts.NEXUS.TEMPLE_SACRIFICE.proposeNewExecutor(multisig));
    await mine(deployedContracts.NEXUS.PARTNER_ZERO_SACRIFICE.proposeNewExecutor(multisig));
}
  
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });