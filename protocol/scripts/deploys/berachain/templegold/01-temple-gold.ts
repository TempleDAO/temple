import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { TempleGold__factory } from '../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../helpers';
import { getDeployedTempleGoldContracts } from '../../mainnet/templegold/contract-addresses';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const ownerAddress = await owner.getAddress();
  const TEMPLEGOLD_ADDRESSES = getDeployedTempleGoldContracts();
  const BERACHAIN_CHAIN_ID = "";
  const BERACHAIN_LZ_EID = "";
  const _initArgs =  {
    // Changed in transfer ownership to TempleAdmin
    executor: ownerAddress, // executor is also used as delegate in LayerZero Endpoint.
    layerZeroEndpoint: TEMPLEGOLD_ADDRESSES.EXTERNAL.LAYER_ZERO.ENDPOINT, // local endpoint address
    mintChainId: BERACHAIN_CHAIN_ID,
    mintChainLzEid: BERACHAIN_LZ_EID,
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