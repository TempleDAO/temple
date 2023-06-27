import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { TempleCircuitBreakerProxy__factory } from '../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../helpers';
import { getDeployedContracts } from '../sepolia/contract-addresses';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const TEMPLE_V2_DEPLOYED = getDeployedContracts();

  const templeCircuitBreakerFactory = new TempleCircuitBreakerProxy__factory(owner);
  await deployAndMine(
    'TEMPLE_CIRCUIT_BREAKER',
    templeCircuitBreakerFactory,
    templeCircuitBreakerFactory.deploy,
    TEMPLE_V2_DEPLOYED.CORE.RESCUER_MSIG,
    TEMPLE_V2_DEPLOYED.CORE.EXECUTOR_MSIG,
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