import '@nomiclabs/hardhat-ethers';
import { SpiceAuctionFactory__factory } from '../../../../../typechain';
import {
  deployAndMine,
  runAsyncMain,
} from '../../../helpers';
import { DEFAULT_SETTINGS } from '../default-settings';
import { getDeployContext } from '../deploy-context';

async function main() {
  const { owner, ADDRS } = await getDeployContext(__dirname);

  const factory = new SpiceAuctionFactory__factory(owner);
  await deployAndMine(
    'SPICE_AUCTION_FACTORY',
    factory,
    factory.deploy,
    ADDRS.TEMPLE_GOLD.SPICE_AUCTION_IMPLEMENTATION,
    ADDRS.CORE.RESCUER_MSIG,
    ADDRS.CORE.EXECUTOR_MSIG,
    ADDRS.CORE.EXECUTOR_MSIG, // current dao executor
    ADDRS.TEMPLE_GOLD.SPICE_AUCTION_OPERATOR,
    ADDRS.TEMPLE_GOLD.STRATEGY_GNOSIS,
    ADDRS.TEMPLE_GOLD.TEMPLE_GOLD,
    DEFAULT_SETTINGS.GLOBAL.LZ_EID,
    DEFAULT_SETTINGS.GLOBAL.CHAIN_ID
  );
}

runAsyncMain(main);
