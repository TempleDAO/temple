import { ethers } from 'hardhat';
import {
    ensureExpectedEnvvars,
    mine,
} from '../../../helpers';
import { connectToContracts } from '../contract-addresses';
import { EnforcedOptionParamStruct } from '../../../../../typechain/@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OAppOptionsType3';
import { TempleGold } from '../../../../../typechain';
import { DEFAULT_SETTINGS } from '../default-settings';

async function main() {
    ensureExpectedEnvvars();
    const [owner] = await ethers.getSigners();
    const INSTANCES = connectToContracts(owner);
    // set enforced options
    await setEnforcedOptionsMainnet(INSTANCES.TEMPLE_GOLD.TEMPLE_GOLD);
}

async function setEnforcedOptionsMainnet(templeGold: TempleGold) {
    // set enforced options
    const options: EnforcedOptionParamStruct[] = [{
        eid: DEFAULT_SETTINGS.GLOBAL.MINT_CHAIN_LZ_EID,
        msgType: DEFAULT_SETTINGS.LAYER_ZERO.ENFORCED_OPTIONS.MSG_TYPE,
        options: DEFAULT_SETTINGS.LAYER_ZERO.ENFORCED_OPTIONS.OPTIONS, // 200k gas limit
    }];
    await mine(templeGold.setEnforcedOptions(options));
}
  
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
