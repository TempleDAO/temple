import '@nomiclabs/hardhat-ethers';
import { TempleGoldStaking__factory } from '../../../../../typechain';
import {
  deployAndMine,
  runAsyncMain
} from '../../../helpers';
import { getDeployedContracts } from '../contract-addresses';
import { getDeployedContracts as getDeployedContractsV2 } from '../../v2/contract-addresses';
import { DEFAULT_SETTINGS } from '../default-settings';
import { getDeployContext } from '../deploy-context';

async function main() {
  const { owner } = await getDeployContext(__dirname);
  const ownerAddress = await owner.getAddress();
  const SEPOLIA_TEMPLEGOLD_ADDRESSES = getDeployedContracts();
  const SEPOLIA_V2_ADDRESSES = getDeployedContractsV2();

  const factory = new TempleGoldStaking__factory(owner);
  await deployAndMine(
    'TEMPLE_GOLD_STAKING',
    factory,
    factory.deploy,
    DEFAULT_SETTINGS.GLOBAL.RESCUER_PLACEHOLDER, // rescuer can't be executor. using placeholder
    ownerAddress,
    SEPOLIA_V2_ADDRESSES.CORE.TEMPLE_TOKEN,
    SEPOLIA_TEMPLEGOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD
  );
}

runAsyncMain(main);
