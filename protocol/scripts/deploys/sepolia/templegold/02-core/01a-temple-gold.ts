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
  const ownerAddress = await owner.getAddress();

  const _initArgs =  {
    // Changed in transfer ownership to TempleAdmin
    executor: ownerAddress, // executor is also used as delegate in LayerZero Endpoint.
    layerZeroEndpoint: ADDRS.EXTERNAL.LAYER_ZERO.ENDPOINT, // local endpoint address
    mintChainId: DEFAULT_SETTINGS.GLOBAL.CHAIN_ID,
    mintChainLzEid: DEFAULT_SETTINGS.GLOBAL.LZ_EID,
    name: DEFAULT_SETTINGS.TEMPLE_GOLD.NAME,
    symbol: DEFAULT_SETTINGS.TEMPLE_GOLD.SYMBOL
  };
  const factory = new TempleGold__factory(owner);
  await deployAndMine(
    'TEMPLE_GOLD',
    factory,
    factory.deploy,
    _initArgs
  );

}

runAsyncMain(main);

