import {
    mine,
    runAsyncMain,
} from '../../../helpers';
import { EnforcedOptionParamStruct } from '../../../../../typechain/@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OAppOptionsType3';
import { TempleGold } from '../../../../../typechain';
import { DEFAULT_SETTINGS } from '../default-settings';
import { getDeployContext } from '../deploy-context';

async function main() {
    const { INSTANCES } = await getDeployContext(__dirname);
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
  
runAsyncMain(main);
