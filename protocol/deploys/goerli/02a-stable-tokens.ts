import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';
import { FakeERC20, FakeERC20__factory } from '../../../typechain';
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

  const daiFactory = new FakeERC20__factory(owner);
  const DAI: FakeERC20 = await deployAndMine(
    'DAI', daiFactory, daiFactory.deploy, 'DAI','DAI'
  )

  const fraxFactory = new FakeERC20__factory(owner);
  const FRAX: FakeERC20 = await deployAndMine(
    'FRAX', daiFactory, daiFactory.deploy, 'FRAX','FRAX'
  )

  const feiFactory = new FakeERC20__factory(owner);
  const FEI: FakeERC20 = await deployAndMine(
    'FEI', daiFactory, daiFactory.deploy, 'FEI','FEI'
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