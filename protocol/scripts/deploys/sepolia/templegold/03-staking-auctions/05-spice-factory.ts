import '@nomiclabs/hardhat-ethers';
import { SpiceAuctionFactory__factory } from '../../../../../typechain';
import {
  deployAndMine,
  runAsyncMain,
} from '../../../helpers';
import { getDeployedContracts } from '../contract-addresses';
import { DEFAULT_SETTINGS } from '../default-settings';
import { getDeployContext } from '../deploy-context';

async function main() {
  const { owner } = await getDeployContext(__dirname);
  const ownerAddress = await owner.getAddress();
  const TEMPLEGOLD_ADDRESSES = getDeployedContracts();

  const factory = new SpiceAuctionFactory__factory(owner);
  await deployAndMine(
    'SPICE_AUCTION_FACTORY',
    factory,
    factory.deploy,
    TEMPLEGOLD_ADDRESSES.TEMPLE_GOLD.SPICE_AUCTION_IMPLEMENTATION,
    DEFAULT_SETTINGS.GLOBAL.RESCUER_PLACEHOLDER,
    ownerAddress, // executor
    ownerAddress, // dao executor, placeholder
    ownerAddress, // spice auction operator
    ownerAddress, // strategy gnosis funds auctions
    TEMPLEGOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD,
    DEFAULT_SETTINGS.GLOBAL.LZ_EID,
    DEFAULT_SETTINGS.GLOBAL.CHAIN_ID
  );
}

runAsyncMain(main);
