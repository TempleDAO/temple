import '@nomiclabs/hardhat-ethers';
import { TempleTeleporter__factory } from '../../../../../typechain';
import {
  deployAndMine,
  runAsyncMain,
} from '../../../helpers';
import { getDeployContext } from '../deploy-context';

async function main() {
  const { owner, ADDRS } = await getDeployContext(__dirname);

  const factory = new TempleTeleporter__factory(owner);
  await deployAndMine(
    'TEMPLE_TELEPORTER',
    factory,
    factory.deploy,
    await owner.getAddress(),
    ADDRS.CORE.TEMPLE_TOKEN,
    ADDRS.EXTERNAL.LAYER_ZERO.ENDPOINT
  );
}

runAsyncMain(main);
