import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';
import { ExitQueue__factory } from '../../../typechain';
import { deployAndMine, DEPLOYED_CONTRACTS, toAtto } from '../helpers';

const MAX_EXITABLE_PER_ADDRESS = toAtto(1000) ;
const MAX_EXITABLE_PER_EPOCH = toAtto(1000) ;

async function main() {
  const [owner] = await ethers.getSigners();

  let DEPLOYED: {
    FRAX: string,
    PRESALE_ALLOCATION: string;
    TEMPLE: string;
  };

  if (DEPLOYED_CONTRACTS[network.name] === undefined) {
    console.log(`No contracts configured for ${network.name}`)
    return;
  } else {
    DEPLOYED = DEPLOYED_CONTRACTS[network.name];
  }

  const exitQueueFactory = new ExitQueue__factory(owner);
  const EXIT_QUEUE = await deployAndMine(
    'EXIT_QUEUE', exitQueueFactory, exitQueueFactory.deploy,
    DEPLOYED.TEMPLE,
    MAX_EXITABLE_PER_EPOCH,
    MAX_EXITABLE_PER_ADDRESS,
    10 /* NOTE: This is the old queue, which works in blocks */
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