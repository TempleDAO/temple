import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import {
  PresaleAllocation,
  PresaleAllocation__factory,
} from '../../../typechain';
import { deployAndMine, expectAddressWithPrivateKey } from '../helpers';

async function main() {
  expectAddressWithPrivateKey();

  const [owner] = await ethers.getSigners();

  // Create all contract factories first
  const presaleAllocationFactory = new PresaleAllocation__factory(owner);

  const PRESALE_ALLOCATION: PresaleAllocation = await deployAndMine(
    'PRESALE_ALLOCATION',
    presaleAllocationFactory,
    presaleAllocationFactory.deploy,
  )
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
