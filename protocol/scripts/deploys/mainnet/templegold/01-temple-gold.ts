import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { TempleGold__factory } from '../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../helpers';
import { getDeployedContracts } from '../v2/contract-addresses';
import { getDeployedTempleGoldContracts } from './contract-addresses';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const CORE_ADDRESSES = getDeployedContracts();
  const TEMPLEGOLD_ADDRESSES = getDeployedTempleGoldContracts();
  const MAINNET_CHAIN_ID = 1;
  const MAINNET_LZ_EID = 30101;
  const _initArgs =  {
    // Changed in transfer ownership to TempleAdmin
    executor: CORE_ADDRESSES.CORE.EXECUTOR_MSIG, // executor is also used as delegate in LayerZero Endpoint.
    layerZeroEndpoint: TEMPLEGOLD_ADDRESSES.EXTERNAL.LAYER_ZERO.ENDPOINT, // local endpoint address
    mintChainId: MAINNET_CHAIN_ID,
    mintChainLzEid: MAINNET_LZ_EID,
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

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });