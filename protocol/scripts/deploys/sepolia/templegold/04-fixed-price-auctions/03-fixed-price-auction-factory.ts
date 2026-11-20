import '@nomiclabs/hardhat-ethers';
import { FixedPriceAuctionFactory__factory } from '../../../../../typechain';
import {
  deployAndMine,
  runAsyncMain,
} from '../../../helpers';
import { DEFAULT_SETTINGS } from '../default-settings';
import { getDeployContext } from '../deploy-context';

async function main() {
  const { owner, ADDRS } = await getDeployContext(__dirname);
  const ownerAddress = await owner.getAddress();
  const rescuer = DEFAULT_SETTINGS.GRANARY.RESCUER;

  const factory = new FixedPriceAuctionFactory__factory(owner);
  await deployAndMine(
    'FIXED_PRICE_AUCTION_FACTORY',
    factory,
    factory.deploy,
    ownerAddress,
    rescuer,
    ADDRS.GRANARY.FIXED_PRICE_AUCTION_IMPLEMENTATION
  );
}

runAsyncMain(main);