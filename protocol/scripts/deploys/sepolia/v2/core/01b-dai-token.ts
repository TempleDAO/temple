import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { FakeERC20__factory } from '../../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../../helpers';
import { zeroAddress } from 'ethereumjs-util';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();

  const daiTokenFactory = new FakeERC20__factory(owner);
  await deployAndMine(
    'EXTERNAL.MAKER_DAO.DAI_TOKEN',
    daiTokenFactory,
    daiTokenFactory.deploy,
    "Dai stablecoin",
    "DAI",
    zeroAddress(), // initial account
    0, // initial balance
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