import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';
import {
    ensureExpectedEnvvars,
    mine
} from '../../helpers';
import { NexusCommon__factory } from '../../../../typechain';
import { DEPLOYED_CONTRACTS } from '../../helpers';

async function main() {
    ensureExpectedEnvvars();
  
    const [owner] = await ethers.getSigners();
    const deployedContracts = DEPLOYED_CONTRACTS[network.name];
    const nexusCommon = NexusCommon__factory.connect(deployedContracts.NEXUS_COMMON, owner);
    
    // set shard
    await mine(nexusCommon.setShard(deployedContracts.SHARD));
    // enclave names
    await mine(nexusCommon.setEnclaveName(1, "CHAOS"));
    await mine(nexusCommon.setEnclaveName(2, "ORDER"));
    await mine(nexusCommon.setEnclaveName(3, "LOGIC"));
    await mine(nexusCommon.setEnclaveName(4, "STRUCTURE"));
    await mine(nexusCommon.setEnclaveName(5, "MYSTERY"));
    // shard enclave Ids
    await mine(nexusCommon.setShardEnclave(1, 1));
    await mine(nexusCommon.setShardEnclave(2, 2));
    await mine(nexusCommon.setShardEnclave(3, 3));
    await mine(nexusCommon.setShardEnclave(4, 4));
    await mine(nexusCommon.setShardEnclave(5, 5));
}
  
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });