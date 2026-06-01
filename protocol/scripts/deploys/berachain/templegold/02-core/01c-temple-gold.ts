import '@nomiclabs/hardhat-ethers';
import { TempleGold__factory } from '../../../../../typechain';
import {
  deployAndMine,
  runAsyncMain,
} from '../../../helpers';
import { DEFAULT_SETTINGS } from '../default-settings';
import { getDeployContext } from '../deploy-context';

async function main() {
  const { owner, ADDRS } = await getDeployContext(__dirname);
  const initArgs =  {
    executor:  await owner.getAddress(),// transfer to ADDRS.CORE.EXECUTOR_MSIG in post deploy
    layerZeroEndpoint: ADDRS.EXTERNAL.LAYER_ZERO.ENDPOINT, // local endpoint address
    mintChainId: DEFAULT_SETTINGS.GLOBAL.MINT_CHAIN_ID, // only mint on mint chain id
    mintChainLzEid: DEFAULT_SETTINGS.GLOBAL.MINT_CHAIN_LZ_EID,
    name: DEFAULT_SETTINGS.TEMPLE_GOLD.NAME,
    symbol: DEFAULT_SETTINGS.TEMPLE_GOLD.SYMBOL
  };
  const factory = new TempleGold__factory(owner);
  await deployAndMine(
    'TEMPLE_GOLD',
    factory,
    factory.deploy,
    initArgs
  );

}

runAsyncMain(main);
