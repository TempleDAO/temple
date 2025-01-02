import { ethers } from 'hardhat';
import {
    ensureExpectedEnvvars,
    mine,
} from '../../helpers';
import { connectToContracts, ContractInstances, ContractAddresses, getDeployedTempleGoldContracts } from '../../mainnet/templegold/contract-addresses';

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const TEMPLE_GOLD_ADDRESSES = getDeployedTempleGoldContracts();
    const TEMPLE_GOLD_INSTANCES = connectToContracts(owner);

    // Transfer ownership to the temple gold admin
    await transferOwnerships(TEMPLE_GOLD_INSTANCES, TEMPLE_GOLD_ADDRESSES);
    
    await addMinter(TEMPLE_GOLD_INSTANCES, TEMPLE_GOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_TELEPORTER);
}

async function transferOwnerships(instances: ContractInstances, addresses: ContractAddresses) {
    await mine(instances.TEMPLE_GOLD.TEMPLE_GOLD.transferOwnership(addresses.TEMPLE_GOLD.TEMPLE_GOLD_ADMIN));
}

async function addMinter(instances: ContractInstances, minter: string) {
    await mine(instances.CORE.TEMPLE_TOKEN.addMinter(minter));
}
  
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
