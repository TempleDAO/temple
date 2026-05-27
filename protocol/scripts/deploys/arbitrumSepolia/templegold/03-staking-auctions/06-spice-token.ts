import '@nomiclabs/hardhat-ethers';
import { FakeERC20__factory } from '../../../../../typechain';
import {
  deployAndMine,
  runAsyncMain,
  toAtto,
} from '../../../helpers';
import { DEFAULT_SETTINGS } from '../default-settings';
import { getDeployContext } from '../deploy-context';

async function main() {
    const { owner } = await getDeployContext(__dirname);
    
    const factory = new FakeERC20__factory(owner);
    await deployAndMine(
        'SPICE_TOKEN',
        factory,
        factory.deploy,
        DEFAULT_SETTINGS.SPICE.TOKEN_A.NAME,
        DEFAULT_SETTINGS.SPICE.TOKEN_A.SYMBOL,
        await owner.getAddress(),
        toAtto(Number(DEFAULT_SETTINGS.SPICE.TOKEN_A.INITIAL_MINT))
    );
}

runAsyncMain(main);
