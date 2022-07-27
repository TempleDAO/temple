import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';
import { TempleERC20Token, TempleERC20Token__factory } from '../../../typechain';
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

  const templeFactory = new TempleERC20Token__factory(owner);
  const TEMPLE: TempleERC20Token = await deployAndMine(
    'TEMPLE', templeFactory, templeFactory.deploy,
  )

  await mine(TEMPLE.transferOwnership(DEPLOYED.MULTISIG));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });