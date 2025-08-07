import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';
import { ethers } from 'hardhat';
import {
  ensureExpectedEnvvars,
  mine
} from '../../helpers';
import {
    getDeployedTempleGoldContracts
} from '../../mainnet/templegold/contract-addresses';
import { Constants as SEPOLIA_CONSTANTS } from '../../sepolia/constants';
import { TempleGold, TempleGold__factory } from '../../../../typechain';
import { EnforcedOptionParamStruct } from '../../../../typechain/@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OAppOptionsType3';

async function setTempleGoldEnforcedOptionsSepolia(templeGold: TempleGold) {
  const options: EnforcedOptionParamStruct[] = [{
    eid: SEPOLIA_CONSTANTS.LAYER_ZERO.EID,
    msgType: 1, // SEND
    options: "0x00030100110100000000000000000000000000030d40", // 200k gas limit
  }];
  await mine(templeGold.setEnforcedOptions(options));
}

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const TEMPLEGOLD_ADDRESSES = getDeployedTempleGoldContracts();
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