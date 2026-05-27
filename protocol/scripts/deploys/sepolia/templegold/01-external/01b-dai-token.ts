import '@nomiclabs/hardhat-ethers';
import { FakeERC20__factory } from '../../../../../typechain';
import {
  deployAndMine,
  runAsyncMain,
  toAtto,
} from '../../../helpers';
import { getDeployContext } from '../deploy-context';

async function main() {
    const { owner } = await getDeployContext(__dirname);
    
    const factory = new FakeERC20__factory(owner);
    await deployAndMine(
        'DAI_TOKEN',
        factory,
        factory.deploy,
        "Dai Token",
        "DAI",
        await owner.getAddress(),
        toAtto(100_000)
    );
}

runAsyncMain(main);