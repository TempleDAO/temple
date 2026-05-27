import '@nomiclabs/hardhat-ethers';
import { StableGoldAuction__factory } from '../../../../../typechain';
import {
  deployAndMine,
  runAsyncMain,
} from '../../../helpers';
import { getDeployedContracts } from '../contract-addresses';
import { DEFAULT_SETTINGS } from '../default-settings';
import { getDeployContext } from '../deploy-context';

async function main() {
  const { owner } = await getDeployContext(__dirname);
  const ownerAddress = await owner.getAddress();
  const TEMPLEGOLD_ADDRESSES = getDeployedContracts();

  const factory = new StableGoldAuction__factory(owner);
  await deployAndMine(
    'DAI_GOLD_AUCTION',
    factory,
    factory.deploy,
    TEMPLEGOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD,
    TEMPLEGOLD_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN,
    ownerAddress, // treasury
    DEFAULT_SETTINGS.GLOBAL.RESCUER_PLACEHOLDER, // rescuer can't be executor. using placeholder
    ownerAddress, // executor
    ownerAddress // auction automation eoa
  );
}

runAsyncMain(main);
