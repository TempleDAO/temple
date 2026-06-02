import { ethers } from 'hardhat';
import {
    mine,
    runAsyncMain,
} from '../../../helpers';
import { CONTRACTS as BEPOLIA_CONTRACTS } from '../../../bepolia/templegold/contract-addresses/bepolia';
import { CONTRACTS as ARB_SEPOLIA_CONTRACTS } from '../../../arbitrumSepolia/templegold/contract-addresses/arbitrumSepolia';
import { TempleGold } from '../../../../../typechain';
import { Constants as BEPOLIA_CONSTANTS } from '../../../bepolia/constants';
import { Constants as ARBITRUM_SEPOLIA_CONSTANTS } from '../../../arbitrumSepolia/constants';
import { getDeployContext } from '../deploy-context';

async function setBepoliaPeer(templeGold: TempleGold) {
    const BEPOLIA_LZ_EID = BEPOLIA_CONSTANTS.LAYER_ZERO.EID;
    const BEPOLIA_TGLD = BEPOLIA_CONTRACTS.TEMPLE_GOLD.TEMPLE_GOLD;
    await mine(templeGold.setPeer(BEPOLIA_LZ_EID, ethers.utils.zeroPad(BEPOLIA_TGLD, 32)));
}

async function setArbitrumSepoliaPeer(templeGold: TempleGold) {
    const ARBSEP_TGLD = ARB_SEPOLIA_CONTRACTS.TEMPLE_GOLD.TEMPLE_GOLD;
    await mine(templeGold.setPeer(ARBITRUM_SEPOLIA_CONSTANTS.LAYER_ZERO.EID, ethers.utils.zeroPad(ARBSEP_TGLD, 32)));
}

async function main() {
    const { INSTANCES } = await getDeployContext(__dirname);
    await setBepoliaPeer(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD);
    await setArbitrumSepoliaPeer(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD);
}

  
runAsyncMain(main);
