import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';
import { ethers } from 'hardhat';
import {
  ensureExpectedEnvvars,
  mine
} from '../../../helpers';
import {
    getDeployedContracts
} from '../contract-addresses';
import { TempleGold, TempleGold__factory } from '../../../../../typechain';
import { EnforcedOptionParamStruct } from '../../../../../typechain/@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OAppOptionsType3';
import { DEFAULT_SETTINGS } from '../default-settings';

async function setTempleGoldEnforcedOptionsSepolia(templeGold: TempleGold) {
  const options: EnforcedOptionParamStruct[] = [{
    eid: DEFAULT_SETTINGS.GLOBAL.MINT_CHAIN_LZ_EID,
    msgType: DEFAULT_SETTINGS.LAYER_ZERO.ENFORCED_OPTIONS.MSG_TYPE,
    options: DEFAULT_SETTINGS.LAYER_ZERO.ENFORCED_OPTIONS.OPTIONS, // 200k gas limit
  }];
  await mine(templeGold.setEnforcedOptions(options));
}

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const TEMPLEGOLD_ADDRESSES = getDeployedContracts();
  const templeGold = TempleGold__factory.connect(TEMPLEGOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD, owner);

  await setTempleGoldEnforcedOptionsSepolia(templeGold);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
