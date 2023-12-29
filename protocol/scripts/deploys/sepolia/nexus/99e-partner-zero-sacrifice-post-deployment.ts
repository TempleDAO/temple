import { ethers } from 'hardhat';
import {
    blockTimestamp,
    ensureExpectedEnvvars,
    mine
} from '../../helpers';
import { connectToContracts } from './contract-addresses';

async function main() {
    ensureExpectedEnvvars();
  
    const [owner] = await ethers.getSigners();
    const deployedContracts = connectToContracts(owner);
    const partnerSacrifice = deployedContracts.NEXUS.PARTNER_ZERO_SACRIFICE;
    
    // for tesnet, use close time to enable sacrifice immediately. here 360 seconds from now
    await mine(partnerSacrifice.setOriginTime(await blockTimestamp() + 360));
}
  
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });