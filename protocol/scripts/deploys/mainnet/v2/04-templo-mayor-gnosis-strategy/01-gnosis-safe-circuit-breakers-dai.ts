import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { TempleCircuitBreakerAllUsersPerPeriod__factory } from '../../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../../helpers';
import { getDeployedContracts } from '../contract-addresses';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const TEMPLE_V2_ADDRESSES = getDeployedContracts();

  const circuitBreakerFactory = new TempleCircuitBreakerAllUsersPerPeriod__factory(owner);
  await deployAndMine(
    'STRATEGIES.TEMPLO_MAYOR_GNOSIS_STRATEGY.CIRCUIT_BREAKERS.DAI',
    circuitBreakerFactory,
    circuitBreakerFactory.deploy,
    TEMPLE_V2_ADDRESSES.CORE.RESCUER_MSIG,
    await owner.getAddress(),
    60*60*26, // 26 hours
    13, // no of buckets
    ethers.utils.parseEther("10000000"), // 10mm cap per bucket
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