import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { TempleTokenBaseStrategy__factory } from '../../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../../helpers';
import { getDeployedContracts } from '../contract-addresses';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const TEMPLE_V2_ADDRESSES = getDeployedContracts();

  const templeTokenBaseFactory = new TempleTokenBaseStrategy__factory(owner);
  await deployAndMine(
    'STRATEGIES.TEMPLE_BASE_STRATEGY.ADDRESS',
    templeTokenBaseFactory,
    templeTokenBaseFactory.deploy,
    TEMPLE_V2_ADDRESSES.CORE.RESCUER_MSIG,
    await owner.getAddress(),
    "TempleBaseStrategy",
    TEMPLE_V2_ADDRESSES.TREASURY_RESERVES_VAULT.ADDRESS,
    TEMPLE_V2_ADDRESSES.CORE.TEMPLE_TOKEN
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