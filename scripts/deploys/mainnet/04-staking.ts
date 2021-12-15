import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';
import { TempleStaking, TempleStaking__factory } from '../../../typechain';
import { deployAndMine, DeployedContracts, DEPLOYED_CONTRACTS, fromAtto, toAtto } from '../helpers';

const EPOCH_SIZE = 24 * 60 * 60;
const START_TIMESTAMP = 1632880800; // Wednesday, September 29, 2021 2:00:00 AM UTC

async function main() {
  const [owner] = await ethers.getSigners();

  let DEPLOYED: DeployedContracts

  if (DEPLOYED_CONTRACTS[network.name] === undefined) {
    console.log(`No contracts configured for ${network.name}`)
    return;
  } else {
    DEPLOYED = DEPLOYED_CONTRACTS[network.name];
  }

  const stakingFactory = new TempleStaking__factory(owner);
  const STAKING: TempleStaking = await deployAndMine(
    'STAKING', stakingFactory, stakingFactory.deploy,
    DEPLOYED.TEMPLE,
    DEPLOYED.EXIT_QUEUE,
    EPOCH_SIZE,
    START_TIMESTAMP, // TODO: Should make it now
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