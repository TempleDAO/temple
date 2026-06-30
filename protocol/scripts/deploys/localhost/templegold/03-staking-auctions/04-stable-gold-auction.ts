import '@nomiclabs/hardhat-ethers';
import { StableGoldAuction__factory } from '../../../../../typechain';
import {
  deployAndMine,
  runAsyncMain,
} from '../../../helpers';
import { getLocalhostDeployContext } from '../deploy-context';

async function main() {
  const { owner, rescuer, ADDRS } = await getLocalhostDeployContext(__dirname);
  const factory = new StableGoldAuction__factory(owner);
  await deployAndMine(
    'STABLE_GOLD_AUCTION',
    factory,
    factory.deploy,
    ADDRS.TEMPLE_GOLD.TEMPLE_GOLD,
    ADDRS.EXTERNAL.MAKER_DAO.DAI_TOKEN,
    await owner.getAddress(), // treasury
    await rescuer.getAddress(),
    await owner.getAddress(),
    ADDRS.TEMPLE_GOLD.AUCTION_AUTOMATION_EOA
  );
}

runAsyncMain(main);
