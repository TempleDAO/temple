import '@nomiclabs/hardhat-ethers';
import { TempleGoldStaking__factory } from '../../../../../typechain';
import {
  deployAndMine,
  runAsyncMain,
} from '../../../helpers';
import { getLocalhostDeployContext } from '../deploy-context';

async function main() {
  const { owner, rescuer, ADDRS } = await getLocalhostDeployContext(__dirname);
  const factory = new TempleGoldStaking__factory(owner);
  await deployAndMine(
    'TEMPLE_GOLD_STAKING',
    factory,
    factory.deploy,
    await rescuer.getAddress(),
    await owner.getAddress(),
    ADDRS.CORE.TEMPLE_TOKEN,
    ADDRS.TEMPLE_GOLD.TEMPLE_GOLD
  );
}

runAsyncMain(main);
