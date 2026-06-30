import { ethers } from 'hardhat';
import {
    mine,
    runAsyncMain,
} from '../../../helpers';
import { getDeployedContracts as getSepoliaDeployedContracts } from '../../../sepolia/templegold/contract-addresses';
import { TempleGold } from '../../../../../typechain';
import { DEFAULT_SETTINGS } from '../default-settings';
import { getDeployContext } from '../deploy-context';

async function setSepoliaPeer(templeGold: TempleGold) {
    const SEPOLIA_DEPLOYED_CONTRACTS = getSepoliaDeployedContracts();
    const SEPOLIA_TGLD = SEPOLIA_DEPLOYED_CONTRACTS.TEMPLE_GOLD.TEMPLE_GOLD;
    await mine(templeGold.setPeer(DEFAULT_SETTINGS.GLOBAL.MINT_CHAIN_LZ_EID, ethers.utils.zeroPad(SEPOLIA_TGLD, 32)));
}

async function main() {
    const { INSTANCES } = await getDeployContext(__dirname);

    await setSepoliaPeer(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD);
}

runAsyncMain(main);
