import '@nomiclabs/hardhat-ethers';
import { SpiceAuction__factory } from '../../../../../typechain';
import {
  deployAndMine,
  runAsyncMain,
} from '../../../helpers';
import { getLocalhostDeployContext } from '../deploy-context';

async function main() {
  const { owner } = await getLocalhostDeployContext(__dirname);
  const factory = new SpiceAuction__factory(owner);
  await deployAndMine(
    'SPICE_AUCTION_IMPLEMENTATION',
    factory,
    factory.deploy
  );
}

runAsyncMain(main);
