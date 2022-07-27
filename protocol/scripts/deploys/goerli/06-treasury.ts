import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';
import { TempleTreasury, TempleTreasury__factory } from '../../../typechain';
import {
  deployAndMine,
  DeployedContracts,
  DEPLOYED_CONTRACTS,
  ensureExpectedEnvvars,
  mine,
} from '../helpers';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();

  let DEPLOYED: DeployedContracts;

  if (DEPLOYED_CONTRACTS[network.name] === undefined) {
    console.log(`No contracts configured for ${network.name}`)
    return;
  } else {
    DEPLOYED = DEPLOYED_CONTRACTS[network.name];
  }

  const treasuryFactory = new TempleTreasury__factory(owner);
  const TREASURY: TempleTreasury = await deployAndMine(
    'TREASURY', treasuryFactory, treasuryFactory.deploy,
    DEPLOYED.TEMPLE,
    DEPLOYED.FRAX,
  )

  await mine(TREASURY.transferOwnership(DEPLOYED.MULTISIG));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });