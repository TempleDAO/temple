import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { TempleTokenBaseStrategy__factory } from '../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../helpers';
import { getDeployedContracts } from './contract-addresses';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const TEMPLE_V2_DEPLOYED = getDeployedContracts();

  const templeTokenBaseFactory = new TempleTokenBaseStrategy__factory(owner);
  await deployAndMine(
    'TEMPLE_BASE_STRATEGY',
    templeTokenBaseFactory,
    templeTokenBaseFactory.deploy,
    await owner.getAddress(),
    await owner.getAddress(),
    "TempleBaseStrategy", // TODO: update value
    TEMPLE_V2_DEPLOYED.TREASURY_RESERVES_VAULT.ADDRESS,
    TEMPLE_V2_DEPLOYED.CORE.TEMPLE_TOKEN
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