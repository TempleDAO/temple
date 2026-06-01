import '@nomiclabs/hardhat-ethers';
import { TempleGoldStaking__factory } from '../../../../../typechain';
import {
  deployAndMine,
  runAsyncMain,
} from '../../../helpers';
import { getDeployContext } from '../deploy-context';

async function main() {
  const { owner, ADDRS } = await getDeployContext(__dirname);

  const factory = new TempleGoldStaking__factory(owner);
  await deployAndMine(
    'TEMPLE_GOLD_STAKING',
    factory,
    factory.deploy,
    ADDRS.CORE.RESCUER_MSIG,
    ADDRS.CORE.EXECUTOR_MSIG,
    ADDRS.CORE.TEMPLE_TOKEN,
    ADDRS.TEMPLE_GOLD.TEMPLE_GOLD
  );
}

runAsyncMain(main);
