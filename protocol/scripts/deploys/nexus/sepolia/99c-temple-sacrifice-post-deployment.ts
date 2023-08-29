import { ethers, network } from 'hardhat';
import {
    blockTimestamp,
    ensureExpectedEnvvars,
    mine,
    toAtto
} from '../../helpers';
import { TempleSacrifice__factory } from '../../../../typechain';
import { DEPLOYED_CONTRACTS } from '../../helpers';


async function main() {
    ensureExpectedEnvvars();
  
    const [owner] = await ethers.getSigners();
    const ownerAddress = await owner.getAddress();
    const deployedContracts = DEPLOYED_CONTRACTS[network.name];
    const templeSacrifice = TempleSacrifice__factory.connect(deployedContracts.TEMPLE_SACRIFICE, owner);

    {
        await mine(templeSacrifice.setCustomPrice(toAtto(30)));
        await mine(templeSacrifice.setOriginTime(blockTimestamp()));
        await mine(templeSacrifice.setWhitelistContract(ownerAddress));
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