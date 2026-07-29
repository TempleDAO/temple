import '@nomiclabs/hardhat-ethers';
import { SpiceAuctionFactory__factory } from '../../../../../typechain';
import {
  deployAndMine,
  runAsyncMain,
} from '../../../helpers';
import { getLocalhostDeployContext } from '../deploy-context';

async function main() {
  const { owner, rescuer, ADDRS } = await getLocalhostDeployContext(__dirname);
  const factory = new SpiceAuctionFactory__factory(owner);
  await deployAndMine(
    'SPICE_AUCTION_FACTORY',
    factory,
    factory.deploy,
    ADDRS.TEMPLE_GOLD.SPICE_AUCTION_IMPLEMENTATION,
    await rescuer.getAddress(),
    await owner.getAddress(), // executor
    await owner.getAddress(), // dao executor
    await owner.getAddress(), // operator
    await owner.getAddress(), // strategy gnosis
    ADDRS.TEMPLE_GOLD.TEMPLE_GOLD,
    30101,
    1
  );
}

runAsyncMain(main);
