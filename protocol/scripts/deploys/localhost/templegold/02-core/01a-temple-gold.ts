import '@nomiclabs/hardhat-ethers';
import { TempleGold__factory } from '../../../../../typechain';
import {
  deployAndMine,
  runAsyncMain,
} from '../../../helpers';
import { getLocalhostDeployContext } from '../deploy-context';

async function main() {
  const { owner, ADDRS } = await getLocalhostDeployContext(__dirname);
  const MINT_CHAIN_ID = 1;
  const MINT_CHAIN_LZ_EID = 30101;
  const _initArgs = {
    executor: await owner.getAddress(),
    layerZeroEndpoint: ADDRS.EXTERNAL.LAYER_ZERO.ENDPOINT,
    mintChainId: MINT_CHAIN_ID,
    mintChainLzEid: MINT_CHAIN_LZ_EID,
    name: "TEMPLE GOLD",
    symbol: "TGLD"
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
