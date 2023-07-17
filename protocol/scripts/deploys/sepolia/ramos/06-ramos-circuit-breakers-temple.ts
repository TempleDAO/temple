import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { TempleCircuitBreakerAllUsersPerPeriod__factory } from '../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../helpers';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();

  const circuitBreakerFactory = new TempleCircuitBreakerAllUsersPerPeriod__factory(owner);
  await deployAndMine(
    'STRATEGIES.RAMOS_STRATEGY.CIRCUIT_BREAKERS.TEMPLE',
    circuitBreakerFactory,
    circuitBreakerFactory.deploy,
    await owner.getAddress(),
    await owner.getAddress(),
    60*60*26, // 26 hours
    13, // no of buckets
    ethers.utils.parseEther("50000000"), // cap per bucket
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