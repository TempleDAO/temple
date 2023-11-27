import { ethers, network } from 'hardhat';
import {
    blockTimestamp,
    ensureExpectedEnvvars,
    mine
} from '../../helpers';
import { PartnerZeroSacrifice__factory } from '../../../../typechain';
import { DEPLOYED_CONTRACTS } from '../../helpers';

async function main() {
    ensureExpectedEnvvars();
  
    const [owner] = await ethers.getSigners();
    const deployedContracts = DEPLOYED_CONTRACTS[network.name];
    const partnerSacrifice = PartnerZeroSacrifice__factory.connect(deployedContracts.PARTNER_ZERO_SACRIFICE, owner);
    
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