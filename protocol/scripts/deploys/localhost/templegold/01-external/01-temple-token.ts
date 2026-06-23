import '@nomiclabs/hardhat-ethers';
import { FakeERC20__factory } from '../../../../../typechain';
import {
  deployAndMine,
  runAsyncMain,
  toAtto,
} from '../../../helpers';
import { getLocalhostDeployContext } from '../deploy-context';

async function main() {
  const { owner } = await getLocalhostDeployContext(__dirname);
  const factory = new FakeERC20__factory(owner);
  await deployAndMine(
    'TEMPLE_TOKEN',
    factory,
    factory.deploy,
    "Temple",
    "TEMPLE",
    await owner.getAddress(),
    toAtto(1000)
  );
}

runAsyncMain(main);
