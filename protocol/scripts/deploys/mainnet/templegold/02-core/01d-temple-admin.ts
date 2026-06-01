import '@nomiclabs/hardhat-ethers';
import { TempleGoldAdmin__factory } from '../../../../../typechain';
import {
  deployAndMine,
  runAsyncMain
} from '../../../helpers';
import { getDeployContext } from '../deploy-context';

async function main() {
  const { owner, ADDRS } = await getDeployContext(__dirname);

  console.log("owner", await owner.getAddress());

  const factory = new TempleGoldAdmin__factory(owner);
  await deployAndMine(
    'TEMPLE_GOLD_ADMIN',
    factory,
    factory.deploy,
    ADDRS.CORE.RESCUER_MSIG,
    ADDRS.CORE.EXECUTOR_MSIG,
    ADDRS.TEMPLE_GOLD.TEMPLE_GOLD
  );
}

runAsyncMain(main);