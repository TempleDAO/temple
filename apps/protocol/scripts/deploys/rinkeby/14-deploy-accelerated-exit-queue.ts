import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';
import { AcceleratedExitQueue, AcceleratedExitQueue__factory } from '../../../typechain';
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
  
  const acceleratedExitQueueFactory = await new AcceleratedExitQueue__factory(owner);
  const acceleratedExitQueue: AcceleratedExitQueue = await deployAndMine(
    'ACCELERATED_EXIT_QUEUE', acceleratedExitQueueFactory, acceleratedExitQueueFactory.deploy,
    DEPLOYED.TEMPLE,
    DEPLOYED.EXIT_QUEUE,
    DEPLOYED.STAKING,
  )

  await mine(acceleratedExitQueue.transferOwnership(DEPLOYED.MULTISIG));
  
  console.log("**** TODO: Needs to be manually wired post deploy");
  console.log("exitQueue.transferOwnership(acceleratedExitQueue)");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });