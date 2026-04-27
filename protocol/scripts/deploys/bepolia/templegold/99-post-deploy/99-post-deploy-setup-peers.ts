import { ethers } from 'hardhat';
import {
    ensureExpectedEnvvars,
    mine,
} from '../../../helpers';
import { connectToContracts } from '../contract-addresses';
import { CONTRACTS as SEPOLIA_DEPLOYED_CONTRACTS} from '../../../sepolia/templegold/contract-addresses/sepolia';
import { TempleGold } from '../../../../../typechain';
import { DEFAULT_SETTINGS } from '../default-settings';

async function setSepoliaPeer(templeGold: TempleGold) {
    const SEPOLIA_LZ_EID = DEFAULT_SETTINGS.GLOBAL.MINT_CHAIN_LZ_EID;
    const SEPOLIA_TGLD = SEPOLIA_DEPLOYED_CONTRACTS.TEMPLE_GOLD.TEMPLE_GOLD;
    await mine(templeGold.setPeer(SEPOLIA_LZ_EID, ethers.utils.zeroPad(SEPOLIA_TGLD, 32)));
}

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const INSTANCES = connectToContracts(owner);

    await setSepoliaPeer(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
