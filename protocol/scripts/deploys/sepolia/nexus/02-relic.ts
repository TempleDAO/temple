import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { Relic__factory } from '../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../helpers';
import { getDeployedContracts } from "./contract-addresses";

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const deployedContracts = getDeployedContracts();

  const relicFactory= new Relic__factory(owner);
  await deployAndMine(
      'NEXUS.RELIC',
      relicFactory,
      relicFactory.deploy,
      "RELIC",
      "REL",
      deployedContracts.NEXUS.NEXUS_COMMON,
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