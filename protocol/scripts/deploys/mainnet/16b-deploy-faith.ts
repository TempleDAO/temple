import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';
import { Devotion, Devotion__factory, Faith, Faith__factory, LockedOGTemple, LockedOGTemple__factory, TempleStaking, TempleStaking__factory} from '../../../typechain';
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

  const faithFactory = new Faith__factory(owner);
  const faith: Faith = await deployAndMine(
    'FAITH', faithFactory, faithFactory.deploy,
  )

  await mine(faith.transferOwnership(DEPLOYED.MULTISIG));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });