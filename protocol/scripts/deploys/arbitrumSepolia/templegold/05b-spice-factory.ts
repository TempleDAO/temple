import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { SpiceAuctionFactory__factory } from '../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../helpers';
import { getDeployedTempleGoldContracts } from '../../mainnet/templegold/contract-addresses';
import { Constants as SEPOLIA_CONSTANTS } from '../../sepolia/constants';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const ownerAddress = await owner.getAddress();
  const TEMPLEGOLD_ADDRESSES = getDeployedTempleGoldContracts();
  const RESCUER = "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720"; // rescuer can't be executor. using placeholder

  const factory = new SpiceAuctionFactory__factory(owner);
  await deployAndMine(
    'SPICE_AUCTION_FACTORY',
    factory,
    factory.deploy,
    TEMPLEGOLD_ADDRESSES.TEMPLE_GOLD.SPICE_AUCTION_IMPLEMENTATION,
    RESCUER,
    ownerAddress, // executor
    ownerAddress, // dao executor, placeholder
    ownerAddress, // spice auction operator
    ownerAddress, // strategy gnosis funds auctions
    TEMPLEGOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD,
    SEPOLIA_CONSTANTS.LAYER_ZERO.EID,
    SEPOLIA_CONSTANTS.CHAIN_ID
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