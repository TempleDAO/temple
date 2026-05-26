import '@nomiclabs/hardhat-ethers';
import { StableGoldAuction__factory } from '../../../../../typechain';
import {
  deployAndMine,
  runAsyncMain,
} from '../../../helpers';
import { getDeployContext } from '../deploy-context';

async function main() {
  const { owner, ADDRS } = await getDeployContext(__dirname);
  const treasury = ADDRS.TEMPLE_GOLD.TEAM_GNOSIS;

  const factory = new StableGoldAuction__factory(owner);
  await deployAndMine(
    'STABLE_GOLD_AUCTION',
    factory,
    factory.deploy,
    ADDRS.TEMPLE_GOLD.TEMPLE_GOLD,
    ADDRS.EXTERNAL.SKY.USDS,
    treasury, // gnosis for CSS strategy
    ADDRS.CORE.RESCUER_MSIG,
    ADDRS.CORE.EXECUTOR_MSIG,
    ADDRS.CORE.EXECUTOR_MSIG, // start with executor
  );
}

runAsyncMain(main);
