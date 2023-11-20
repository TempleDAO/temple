import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';
import { Relic__factory } from '../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
  DEPLOYED_CONTRACTS
} from '../../helpers';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();

  const relicFactory= new Relic__factory(owner);
  const nexusCommon = DEPLOYED_CONTRACTS[network.name].NEXUS_COMMON;
  await deployAndMine(
      'RELIC',
      relicFactory,
      relicFactory.deploy,
      "RELIC",
      "REL",
      nexusCommon,
      await owner.getAddress() // initial executor
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