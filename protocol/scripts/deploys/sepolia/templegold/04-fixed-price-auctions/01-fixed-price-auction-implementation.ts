import '@nomiclabs/hardhat-ethers';
import { FixedPriceAuctionMock__factory } from '../../../../../typechain';
import {
  deployAndMine,
  runAsyncMain,
} from '../../../helpers';
import { getDeployContext } from '../deploy-context';

async function main() {
  const { owner } = await getDeployContext(__dirname);

  const factory = new FixedPriceAuctionMock__factory(owner);
  await deployAndMine(
    'FIXED_PRICE_AUCTION_IMPLEMENTATION',
    factory,
    factory.deploy
  );
}

runAsyncMain(main);