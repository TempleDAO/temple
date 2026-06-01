import '@nomiclabs/hardhat-ethers';
import {
  mine,
  runAsyncMain
} from '../../../helpers';
import { Constants as ARBITRUM_SEPOLIA_CONSTANTS } from '../../../arbitrumSepolia/constants';
import { Constants as BEPOLIA_CONSTANTS } from '../../../bepolia/constants';
import { TempleGold, TempleGold__factory } from '../../../../../typechain';
import { EnforcedOptionParamStruct } from '../../../../../typechain/@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OAppOptionsType3';
import { DEFAULT_SETTINGS } from '../default-settings';
import { getDeployContext } from '../deploy-context';

async function setTempleGoldEnforcedOptionsArbitrumSepolia(templeGold: TempleGold) {
  const options: EnforcedOptionParamStruct[] = [{
    eid: ARBITRUM_SEPOLIA_CONSTANTS.LAYER_ZERO.EID,
    msgType: DEFAULT_SETTINGS.LAYER_ZERO.ENFORCED_OPTIONS.MSG_TYPE,
    options: DEFAULT_SETTINGS.LAYER_ZERO.ENFORCED_OPTIONS.OPTIONS, // 200k gas limit
  }];
  await mine(templeGold.setEnforcedOptions(options));
}

async function setTempleGoldEnforcedOptionsBepolia(templeGold: TempleGold) {
  const options: EnforcedOptionParamStruct[] = [{
    eid: BEPOLIA_CONSTANTS.LAYER_ZERO.EID,
    msgType: DEFAULT_SETTINGS.LAYER_ZERO.ENFORCED_OPTIONS.MSG_TYPE,
    options: DEFAULT_SETTINGS.LAYER_ZERO.ENFORCED_OPTIONS.OPTIONS, // 200k gas limit
  }];
  await mine(templeGold.setEnforcedOptions(options));
}

async function main() {
  const { owner, ADDRS } = await getDeployContext(__dirname);
  const templeGold = TempleGold__factory.connect(ADDRS.TEMPLE_GOLD.TEMPLE_GOLD, owner);
  await setTempleGoldEnforcedOptionsArbitrumSepolia(templeGold);
  await setTempleGoldEnforcedOptionsBepolia(templeGold);
}

runAsyncMain(main);
