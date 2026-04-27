import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { TempleGold__factory } from '../../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../../helpers';
import { getDeployedContracts } from '../contract-addresses';
import { DEFAULT_SETTINGS } from '../default-settings';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const ADDRS = getDeployedContracts();
  const initArgs =  {
    executor:  await owner.getAddress(),// transfer to ADDRS.CORE.EXECUTOR_MSIG in post deploy
    layerZeroEndpoint: ADDRS.EXTERNAL.LAYER_ZERO.ENDPOINT, // local endpoint address
    mintChainId: DEFAULT_SETTINGS.GLOBAL.CHAIN_ID, // only mint on mint chain id
    mintChainLzEid: DEFAULT_SETTINGS.GLOBAL.LZ_EID,
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

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
