import '@nomiclabs/hardhat-ethers';
import { FakeERC20__factory } from '../../../../../typechain';
import {
  deployAndMine,
  runAsyncMain,
  toAtto,
} from '../../../helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { DEFAULT_SETTINGS } from '../default-settings';
import { getDeployContext } from '../deploy-context';

async function main() {
    const { owner } = await getDeployContext(__dirname);
    
    await _deployTempleToken(owner);
}
  
async function _deployTempleToken(owner: SignerWithAddress) {
    const factory = new FakeERC20__factory(owner);
    await deployAndMine(
        'TEMPLE_TOKEN',
        factory,
        factory.deploy,
        DEFAULT_SETTINGS.TEMPLE_TOKEN.NAME,
        DEFAULT_SETTINGS.TEMPLE_TOKEN.SYMBOL,
        await owner.getAddress(),
        toAtto(Number(DEFAULT_SETTINGS.TEMPLE_TOKEN.INITIAL_MINT))
    );
}

runAsyncMain(main);
