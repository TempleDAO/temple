import '@nomiclabs/hardhat-ethers';
import { FakeERC20__factory } from '../../../../../typechain';
import {
  deployAndMine,
  runAsyncMain,
  toAtto,
} from '../../../helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { getDeployContext } from '../deploy-context';

async function main() {
    const { owner } = await getDeployContext(__dirname);
    
    await _deployTempleToken(owner);
}
  
async function _deployTempleToken(owner: SignerWithAddress) {
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
