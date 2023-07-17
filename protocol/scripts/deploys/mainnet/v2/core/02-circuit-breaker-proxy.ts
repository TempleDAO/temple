import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { TempleCircuitBreakerProxy__factory } from '../../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../../helpers';
import { getDeployedContracts } from '../contract-addresses';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();

  const templeCircuitBreakerProxyFactory = new TempleCircuitBreakerProxy__factory(owner);
  await deployAndMine(
    'CORE.CIRCUIT_BREAKER_PROXY',
    templeCircuitBreakerProxyFactory,
    templeCircuitBreakerProxyFactory.deploy,
    await owner.getAddress(),
    await owner.getAddress(),
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