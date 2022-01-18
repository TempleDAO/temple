import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';
import { LockedOGTempleDeprecated__factory, TempleStaking__factory } from '../../../typechain';
import {
  deployAndMine,
  DeployedContracts,
  DEPLOYED_CONTRACTS,
  ensureExpectedEnvvars,
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

  const STAKING = new TempleStaking__factory(owner).attach(DEPLOYED.STAKING);
  const LockedOgTempleDeprecatedFactory = new LockedOGTempleDeprecated__factory(owner);

  const LEGACY_LOCKED_OG_TEMPLE = await deployAndMine(
    'LEGACY_LOCKED_OG_TEMPLE', LockedOgTempleDeprecatedFactory, LockedOgTempleDeprecatedFactory.deploy,
    await STAKING.OG_TEMPLE(),
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