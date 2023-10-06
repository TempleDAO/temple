import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { TestnetRelic__factory } from '../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../helpers';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();

  const relicFactory= new TestnetRelic__factory(owner);
  await deployAndMine(
      'RELIC',
      relicFactory,
      relicFactory.deploy,
      "RELIC",
      "REL"
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