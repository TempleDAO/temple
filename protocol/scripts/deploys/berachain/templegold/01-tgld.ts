import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { TempleGold__factory } from '../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../helpers';
import { getDeployedTempleGoldContracts } from '../../mainnet/templegold/contract-addresses';
import { Constants as MAINNET_CONSTANTS } from '../../mainnet/constants';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const TEMPLEGOLD_ADDRESSES = getDeployedTempleGoldContracts();
  const MAINNET_CHAIN_ID = 1;
  const initArgs =  {
    executor:  await owner.getAddress(),// transfer to TEMPLEGOLD_ADDRESSES.CORE.EXECUTOR_MSIG in post deploy
    layerZeroEndpoint: TEMPLEGOLD_ADDRESSES.EXTERNAL.LAYER_ZERO.ENDPOINT, // local endpoint address
    mintChainId: MAINNET_CHAIN_ID, // only mint on mint chain id
    mintChainLzEid: MAINNET_CONSTANTS.LAYER_ZERO.EID,
    name: "TEMPLE GOLD",
    symbol: "TGLD"
  };
  const factory = new TempleGold__factory(owner);
  await deployAndMine(
    'TEMPLE_GOLD',
    factory,
    factory.deploy,
    initArgs
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