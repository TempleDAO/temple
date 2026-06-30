import '@nomiclabs/hardhat-ethers';
import { TempleGoldAdmin__factory } from '../../../../../typechain';
import {
  deployAndMine,
  runAsyncMain,
} from '../../../helpers';
import { getLocalhostDeployContext } from '../deploy-context';

async function main() {
  const { owner, rescuer, ADDRS } = await getLocalhostDeployContext(__dirname);
  const factory = new TempleGoldAdmin__factory(owner);
  await deployAndMine(
    'TEMPLE_GOLD_ADMIN',
    factory,
    factory.deploy,
    await rescuer.getAddress(),
    await owner.getAddress(),
    ADDRS.TEMPLE_GOLD.TEMPLE_GOLD
  );
}

runAsyncMain(main);
