import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';
import { TempleStaking, TempleStaking__factory, InstantExitQueue__factory, } from '../../../typechain';
import {
  deployAndMine,
  DeployedContracts,
  DEPLOYED_CONTRACTS,
  ensureExpectedEnvvars,
  mine,
} from '../helpers';

const EPOCH_SIZE = 24 * 60 * 60;

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

  const stakingFactory = new TempleStaking__factory(owner);
  const STAKING: TempleStaking = await deployAndMine(
    'STAKING', stakingFactory, stakingFactory.deploy,
    DEPLOYED.TEMPLE,
    '`0x414A98FFA0F885218Ed86da53C5750FF77F0040A`', // Goerli Exit Queue
    EPOCH_SIZE,
    Math.round(Date.now()/1000.0) - 2,
  );

  await mine(STAKING.transferOwnership(DEPLOYED.MULTISIG));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });