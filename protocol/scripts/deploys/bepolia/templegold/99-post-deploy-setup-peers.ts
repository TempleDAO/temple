import { ethers } from 'hardhat';
import {
    ensureExpectedEnvvars,
    mine,
} from '../../helpers';
import { connectToContracts, TEMPLEGOLD_DEPLOYED_CONTRACTS } from '../../mainnet/templegold/contract-addresses';
import { TempleGold } from '../../../../typechain';

async function setSepoliaPeer(templeGold: TempleGold) {
    const SEPOLIA_LZ_EID = 40161;
    const SEPOLIA_TGLD = TEMPLEGOLD_DEPLOYED_CONTRACTS['sepolia'].TEMPLE_GOLD.TEMPLE_GOLD;
    await mine(templeGold.setPeer(SEPOLIA_LZ_EID, ethers.utils.zeroPad(SEPOLIA_TGLD, 32)));
}

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const TEMPLE_GOLD_INSTANCES = connectToContracts(owner);

    await setSepoliaPeer(TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD);
}

  
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
