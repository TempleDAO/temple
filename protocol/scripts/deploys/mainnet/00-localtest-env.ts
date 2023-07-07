import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { FakeERC20, FakeERC20__factory } from '../../../typechain';
import { deployAndMine } from '../helpers';
import { zeroAddress } from 'ethereumjs-util';

async function main() {
  const [owner] = await ethers.getSigners();

  const fraxFactory = new FakeERC20__factory(owner);
  const FRAX: FakeERC20 = await deployAndMine(
    'FRAX', fraxFactory , fraxFactory .deploy,
    'FRAX',
    'FRAX', 
    zeroAddress(), 0
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