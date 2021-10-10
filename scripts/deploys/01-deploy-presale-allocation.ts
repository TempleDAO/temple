import '@nomiclabs/hardhat-ethers';
import { BaseContract, BigNumber, ContractTransaction } from 'ethers';
import { ethers, network } from 'hardhat';
import {
  ExitQueue__factory,
  FakeERC20__factory,
  PresaleAllocation,
  PresaleAllocation__factory,
  TempleERC20Token__factory,
  TempleStaking__factory,
  TempleTreasury__factory,
  Presale__factory
} from '../../typechain';
import { deployAndMine, expectAddressWithPrivateKeyOnMainnet } from './helpers';

async function main() {
  expectAddressWithPrivateKeyOnMainnet();

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
