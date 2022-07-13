import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';
import { ExitQueue, ExitQueue__factory } from '../../../typechain';
import {
  deployAndMine,
  DeployedContracts,
  DEPLOYED_CONTRACTS,
  ensureExpectedEnvvars,
  
  mine,
  toAtto
} from '../helpers';

const MAX_EXITABLE_PER_ADDRESS = toAtto(1000);
const MAX_EXITABLE_PER_EPOCH = toAtto(1000);

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

  const exitQueueFactory = new ExitQueue__factory(owner);
  const EXIT_QUEUE: ExitQueue = await deployAndMine(
    'EXIT_QUEUE', exitQueueFactory, exitQueueFactory.deploy,
    DEPLOYED.TEMPLE,
    MAX_EXITABLE_PER_EPOCH,
    MAX_EXITABLE_PER_ADDRESS,
    10 /* number of blocks per epoch */
  )

  await mine(EXIT_QUEUE.transferOwnership(DEPLOYED.MULTISIG));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });