import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { SpiceAuctionFactory__factory } from '../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../helpers';
import { getDeployedTempleGoldContracts } from '../../mainnet/templegold/contract-addresses';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const ownerAddress = await owner.getAddress();
  const TEMPLEGOLD_ADDRESSES = getDeployedTempleGoldContracts();
  const SEPOLIA_CHAIN_ID = 11155111;
  const SEPOLIA_LZ_EID = 40161;

  const factory = new SpiceAuctionFactory__factory(owner);
  await deployAndMine(
    'SPICE_AUCTION_FACTORY',
    factory,
    factory.deploy,
    "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720", // rescuer can't be executor. using placeholder
    ownerAddress, // executor
    ownerAddress, // dao executor, placeholder
    ownerAddress, // spice auction operator
    TEMPLEGOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD,
    SEPOLIA_LZ_EID,
    SEPOLIA_CHAIN_ID
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