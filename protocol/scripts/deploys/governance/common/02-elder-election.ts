import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { ElderElection__factory } from '../../../../typechain';
import {
  getDeployedContracts,
} from '../contract-addresses';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../helpers';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const DEPLOYED = getDeployedContracts();

  const factory = new ElderElection__factory(owner);
  await deployAndMine(
    'ElderElection', factory, factory.deploy,
    DEPLOYED.TEMPLAR_NFT,
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