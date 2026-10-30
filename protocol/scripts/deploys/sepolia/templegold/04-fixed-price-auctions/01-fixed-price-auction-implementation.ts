import '@nomiclabs/hardhat-ethers';
import { FixedPriceAuction__factory } from '../../../../../typechain';
import {
  deployAndMine,
  runAsyncMain,
} from '../../../helpers';
import { getDeployContext } from '../deploy-context';

async function main() {
  const { owner } = await getDeployContext(__dirname);

  const factory = new FixedPriceAuction__factory(owner);
  await deployAndMine(
    'FIXED_PRICE_AUCTION_IMPLEMENTATION',
    factory,
    factory.deploy
  );
}

runAsyncMain(main);