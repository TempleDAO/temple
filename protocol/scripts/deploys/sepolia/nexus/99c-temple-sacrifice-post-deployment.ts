import { ethers } from 'hardhat';
import {
    blockTimestamp,
    ensureExpectedEnvvars,
    mine,
    toAtto
} from '../../helpers';
import { connectToContracts } from './contract-addresses';

async function main() {
    ensureExpectedEnvvars();
  
    const [owner] = await ethers.getSigners();
    const deployedContracts = connectToContracts(owner);
    const templeSacrifice = deployedContracts.NEXUS.TEMPLE_SACRIFICE;

    await mine(templeSacrifice.setOriginTime(await blockTimestamp() + 360));
    const priceParams = {
        priceMaxPeriod: 1732125018,
        minimumPrice: toAtto(30),
        maximumPrice: toAtto(100)
    }
    await mine(templeSacrifice.setPriceParams(priceParams));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });