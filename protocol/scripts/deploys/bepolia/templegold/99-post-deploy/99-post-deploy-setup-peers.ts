import { ethers } from 'hardhat';
import {
    runAsyncMain,
    mine,
} from '../../../helpers';
import { CONTRACTS as SEPOLIA_DEPLOYED_CONTRACTS} from '../../../sepolia/templegold/contract-addresses/sepolia';
import { TempleGold } from '../../../../../typechain';
import { DEFAULT_SETTINGS } from '../default-settings';
import { getDeployContext } from '../deploy-context';

async function setSepoliaPeer(templeGold: TempleGold) {
    const SEPOLIA_LZ_EID = DEFAULT_SETTINGS.GLOBAL.MINT_CHAIN_LZ_EID;
    const SEPOLIA_TGLD = SEPOLIA_DEPLOYED_CONTRACTS.TEMPLE_GOLD.TEMPLE_GOLD;
    await mine(templeGold.setPeer(SEPOLIA_LZ_EID, ethers.utils.zeroPad(SEPOLIA_TGLD, 32)));
}

async function main() {
    const { INSTANCES } = await getDeployContext(__dirname);

    await setSepoliaPeer(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD);
}

runAsyncMain(main);
