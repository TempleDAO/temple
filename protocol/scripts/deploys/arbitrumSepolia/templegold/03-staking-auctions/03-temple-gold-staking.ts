import '@nomiclabs/hardhat-ethers';
import { TempleGoldStaking__factory } from '../../../../../typechain';
import {
  deployAndMine,
  runAsyncMain,
} from '../../../helpers';
import { DEFAULT_SETTINGS } from '../default-settings';
import { getDeployContext } from '../deploy-context';

async function main() {
  const { owner, ADDRS } = await getDeployContext(__dirname);
  const ownerAddress = await owner.getAddress();

  const factory = new TempleGoldStaking__factory(owner);
  await deployAndMine(
    'TEMPLE_GOLD_STAKING',
    factory,
    factory.deploy,
    DEFAULT_SETTINGS.GLOBAL.RESCUER_PLACEHOLDER, // rescuer can't be executor. using placeholder
    ownerAddress,
    ADDRS.CORE.TEMPLE_TOKEN,
    ADDRS.TEMPLE_GOLD.TEMPLE_GOLD
  );
}

runAsyncMain(main);
