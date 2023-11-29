import { ethers } from 'hardhat';
import {
    ensureExpectedEnvvars,
    mine,
} from '../../helpers';
import { connectToContracts, getDeployedContracts } from './contract-addresses';

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const CORE_ADDRESSES = getDeployedContracts();
    const CORE_INSTANCES = connectToContracts(owner);

    // Transfer ownership to the multisig
    await mine(CORE_INSTANCES.OTC_OFFER.DAI_OHM.transferOwnership(CORE_ADDRESSES.CORE.CORE_MULTISIG));
    await mine(CORE_INSTANCES.OTC_OFFER.DAI_GOHM.transferOwnership(CORE_ADDRESSES.CORE.CORE_MULTISIG));
}
  
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
