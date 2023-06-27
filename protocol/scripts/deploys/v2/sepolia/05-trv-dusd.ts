import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { FakeERC20__factory } from '../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../helpers';
import { zeroAddress } from 'ethereumjs-util';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();

  const dusdFactory = new FakeERC20__factory(owner);

  await deployAndMine(
    'TRV_DUSD', dusdFactory, dusdFactory.deploy, 'DUSD','DUSD', zeroAddress(), 0
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