import { ethers, network } from 'hardhat';
import {
    ensureExpectedEnvvars,
    mine,
    toAtto
} from '../../helpers';
import { TempleSacrifice__factory } from '../../../../typechain';
import { DEPLOYED_CONTRACTS } from '../../helpers';


async function main() {
    ensureExpectedEnvvars();
  
    const [owner] = await ethers.getSigners();
    const deployedContracts = DEPLOYED_CONTRACTS[network.name];
    const templeSacrifice = TempleSacrifice__factory.connect(deployedContracts.TEMPLE_SACRIFICE, owner);

    // set sacrificed temple recipient
    {
        const recipient = '0x759bc1678e9d35BdD78C50e4bCF4aCeAf4869A8D';
        await mine(templeSacrifice.setSacrificedTempleRecipient(recipient));
    }
    // set price params
    {
        const priceParams = {
            minimumPrice: toAtto(40),
            maximumPrice: toAtto(100),
            priceMaxPeriod: 365 * 24 * 60 * 60
        }
        await mine(templeSacrifice.setPriceParams(priceParams));
    }
    // set origin time
    {
        
    }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });