import '@nomiclabs/hardhat-ethers';
import { WishingWell__factory } from '../../../../../typechain';
import {
  deployAndMine,
  runAsyncMain,
} from '../../../helpers';
import { getDeployContext } from '../deploy-context';

async function main() {
  const { owner } = await getDeployContext(__dirname);

  const factory = new WishingWell__factory(owner);
  await deployAndMine(
    'WISHING_WELL',
    factory,
    factory.deploy
  );
}

runAsyncMain(main);
