import '@nomiclabs/hardhat-ethers';
import {
  runAsyncMain,
  mine
} from '../../../helpers';

import { TempleGold, TempleGold__factory } from '../../../../../typechain';
import { EnforcedOptionParamStruct } from '../../../../../typechain/@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OAppOptionsType3';
import { DEFAULT_SETTINGS } from '../default-settings';
import { getDeployContext } from '../deploy-context';

async function setTempleGoldEnforcedOptionsSepolia(templeGold: TempleGold) {
  const options: EnforcedOptionParamStruct[] = [{
    eid: DEFAULT_SETTINGS.GLOBAL.MINT_CHAIN_LZ_EID,
    msgType: DEFAULT_SETTINGS.LAYER_ZERO.ENFORCED_OPTIONS.MSG_TYPE,
    options: DEFAULT_SETTINGS.LAYER_ZERO.ENFORCED_OPTIONS.OPTIONS, // 200k gas limit
  }];
  await mine(templeGold.setEnforcedOptions(options));
}

async function main() {
  const { owner, ADDRS } = await getDeployContext(__dirname);
  const templeGold = TempleGold__factory.connect(ADDRS.TEMPLE_GOLD.TEMPLE_GOLD, owner);

  await setTempleGoldEnforcedOptionsSepolia(templeGold);
}

runAsyncMain(main);
