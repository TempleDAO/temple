import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';
import { LockedOGTemple__factory, TempleStaking__factory } from '../../../typechain';
import { deployAndMine, DeployedContracts, DEPLOYED_CONTRACTS } from '../helpers';

async function main() {
  const [owner] = await ethers.getSigners();

  let DEPLOYED: DeployedContracts

  if (DEPLOYED_CONTRACTS[network.name] === undefined) {
    console.log(`No contracts configured for ${network.name}`)
    return;
  } else {
    DEPLOYED = DEPLOYED_CONTRACTS[network.name];
  }

  const STAKING = new TempleStaking__factory(owner).attach(DEPLOYED.STAKING);
  const lockedOgTempleFactory = new LockedOGTemple__factory(owner);

  const LOCKED_OG_TEMPLE = await deployAndMine(
    'LOCKED_OG_TEMPLE', lockedOgTempleFactory, lockedOgTempleFactory.deploy,
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