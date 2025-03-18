import '@nomiclabs/hardhat-ethers';
import { SkyFarmBaseStrategy__factory } from '../../../../../typechain';
import {
  deployAndMine,
  runAsyncMain,
} from '../../../helpers';
import { getDeployContext } from '../deploy-context';

async function main() {
  const { owner, TEMPLE_V2_ADDRESSES } = await getDeployContext();

  const factory = new SkyFarmBaseStrategy__factory(owner);
  await deployAndMine(
    'STRATEGIES.DAI_ORIGAMI_SKY_FARM_BASE_STRATEGY.ADDRESS',
    factory,
    factory.deploy,
    TEMPLE_V2_ADDRESSES.CORE.RESCUER_MSIG,
    TEMPLE_V2_ADDRESSES.CORE.EXECUTOR_MSIG,
    "DaiSkyFarmBaseStrategy",
    TEMPLE_V2_ADDRESSES.TREASURY_RESERVES_VAULT.ADDRESS,
    TEMPLE_V2_ADDRESSES.EXTERNAL.ORIGAMI.VAULTS.SUSDSpS.TOKEN,
    TEMPLE_V2_ADDRESSES.EXTERNAL.SKY.DAI_TO_USDS,
  );
}

runAsyncMain(main);
