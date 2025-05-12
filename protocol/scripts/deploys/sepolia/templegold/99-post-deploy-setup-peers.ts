import { ethers } from 'hardhat';
import {
    ensureExpectedEnvvars,
    mine,
} from '../../helpers';
import { connectToContracts, TEMPLEGOLD_DEPLOYED_CONTRACTS } from '../../mainnet/templegold/contract-addresses';
import { TempleGold } from '../../../../typechain';

async function setBepoliaPeer(templeGold: TempleGold) {
    const BEPOLIA_LZ_EID = 40371;
    const BEPOLIA_TGLD = TEMPLEGOLD_DEPLOYED_CONTRACTS['bepolia'].TEMPLE_GOLD.TEMPLE_GOLD;
    await mine(templeGold.setPeer(BEPOLIA_LZ_EID, ethers.utils.zeroPad(BEPOLIA_TGLD, 32)));
}

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const TEMPLE_GOLD_INSTANCES = connectToContracts(owner);

    await setBepoliaPeer(TEMPLE_GOLD_INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD);
}

  
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
