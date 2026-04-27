import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { SpiceAuctionFactory__factory } from '../../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../../helpers';
import { getDeployedContracts } from '../contract-addresses';
import { DEFAULT_SETTINGS } from '../default-settings';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const ADDRS = getDeployedContracts();

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

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
