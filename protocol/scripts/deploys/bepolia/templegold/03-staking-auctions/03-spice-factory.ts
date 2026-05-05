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
  const ownerAddress = await owner.getAddress();
  const ADDRS = getDeployedContracts();
  // rescuer can't be executor
  const RESCUER = ADDRS.CORE.RESCUER_MSIG;

  const factory = new SpiceAuctionFactory__factory(owner);
  await deployAndMine(
    'SPICE_AUCTION_FACTORY',
    factory,
    factory.deploy,
    ADDRS.TEMPLE_GOLD.SPICE_AUCTION_IMPLEMENTATION,
    RESCUER,
    ownerAddress, // executor
    ownerAddress, // dao executor, placeholder
    ownerAddress, // spice auction operator
    ownerAddress, // strategy gnosis funds auctions
    ADDRS.TEMPLE_GOLD.TEMPLE_GOLD,
    DEFAULT_SETTINGS.GLOBAL.MINT_CHAIN_LZ_EID,
    DEFAULT_SETTINGS.GLOBAL.MINT_CHAIN_ID
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
