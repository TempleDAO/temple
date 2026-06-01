import '@nomiclabs/hardhat-ethers';
import { SpiceAuctionFactory__factory } from '../../../../../typechain';
import {
  deployAndMine,
  runAsyncMain,
} from '../../../helpers';
import { DEFAULT_SETTINGS } from '../default-settings';
import { getDeployContext } from '../deploy-context';

async function main() {
  const { owner, ADDRS } = await getDeployContext(__dirname);
  const ownerAddress = await owner.getAddress();

  const factory = new SpiceAuctionFactory__factory(owner);
  await deployAndMine(
    'SPICE_AUCTION_FACTORY',
    factory,
    factory.deploy,
    ADDRS.TEMPLE_GOLD.SPICE_AUCTION_IMPLEMENTATION,
    DEFAULT_SETTINGS.GLOBAL.RESCUER_PLACEHOLDER,
    ownerAddress, // executor
    ownerAddress, // dao executor, placeholder
    ownerAddress, // spice auction operator
    ownerAddress, // strategy gnosis funds auctions
    ADDRS.TEMPLE_GOLD.TEMPLE_GOLD,
    DEFAULT_SETTINGS.GLOBAL.MINT_CHAIN_LZ_EID,
    DEFAULT_SETTINGS.GLOBAL.MINT_CHAIN_ID
  );
}

runAsyncMain(main);
