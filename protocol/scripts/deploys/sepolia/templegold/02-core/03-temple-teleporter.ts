import '@nomiclabs/hardhat-ethers';
import { TempleTeleporter__factory } from '../../../../../typechain';
import {
  deployAndMine,
  runAsyncMain,
} from '../../../helpers';
import { getDeployedContracts } from '../contract-addresses';
import { getDeployedContracts as getDeployedContractsV2 } from '../../v2/contract-addresses';
import { getDeployContext } from '../deploy-context';

async function main() {
  const { owner } = await getDeployContext(__dirname);
  const TEMPLEGOLD_ADDRESSES = getDeployedContracts();
  const CORE_ADDRESSES = getDeployedContractsV2(); 


  const factory = new TempleTeleporter__factory(owner);
  await deployAndMine(
    'TEMPLE_TELEPORTER',
    factory,
    factory.deploy,
    await owner.getAddress(), // executor
    CORE_ADDRESSES.CORE.TEMPLE_TOKEN,
    TEMPLEGOLD_ADDRESSES.EXTERNAL.LAYER_ZERO.ENDPOINT
  );
}

runAsyncMain(main);
