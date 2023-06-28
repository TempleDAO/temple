import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { TempleCircuitBreakerAllUsersPerPeriod__factory } from '../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../helpers';
import { getDeployedContracts } from './contract-addresses';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const TEMPLE_V2_DEPLOYED = getDeployedContracts();

  const circuitBreakerFactory = new TempleCircuitBreakerAllUsersPerPeriod__factory(owner);
  await deployAndMine(
    'TLC_CIRCUIT_BREAKERS_DAI',
    circuitBreakerFactory,
    circuitBreakerFactory.deploy,
    TEMPLE_V2_DEPLOYED.CORE.RESCUER_MSIG,
    TEMPLE_V2_DEPLOYED.CORE.EXECUTOR_MSIG,
    60*60, // TODO: update value
    24, // TODO: update value
    100e18, // TODO: update value
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