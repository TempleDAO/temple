import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { FakeERC20CustomDecimals__factory } from '../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../helpers';
import { zeroAddress } from 'ethereumjs-util';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();

  const factory = new FakeERC20CustomDecimals__factory(owner);
  await deployAndMine(
    'EXTERNAL.OLYMPUS.OHM_TOKEN',
    factory,
    factory.deploy,
    "OlympusDao Token",
    "OHM",
    zeroAddress(), // initial account
    0, // initial balance
    9, // 9 decimal places to match mainnet
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