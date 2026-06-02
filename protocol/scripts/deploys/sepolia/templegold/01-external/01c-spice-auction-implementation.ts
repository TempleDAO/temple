import '@nomiclabs/hardhat-ethers';
import { SpiceMock__factory } from '../../../../../typechain';
import {
  deployAndMine,
  runAsyncMain,
} from '../../../helpers';
import { getDeployContext } from '../deploy-context';

async function main() {
    const { owner } = await getDeployContext(__dirname);
    
    const factory = new SpiceMock__factory(owner);
    await deployAndMine(
        'SPICE_AUCTION_IMPLEMENTATION',
        factory,
        factory.deploy
    );
}


runAsyncMain(main);
