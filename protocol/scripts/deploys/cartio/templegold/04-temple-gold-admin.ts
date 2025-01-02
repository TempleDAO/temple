import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { TempleGoldAdmin__factory } from '../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../helpers';
import { getDeployedTempleGoldContracts } from '../../mainnet/templegold/contract-addresses';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const TEMPLEGOLD_ADDRESSES = getDeployedTempleGoldContracts();
  const rescuer = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

  const factory = new TempleGoldAdmin__factory(owner);
  await deployAndMine(
    'TEMPLE_GOLD_ADMIN',
    factory,
    factory.deploy,
    rescuer, // rescuer
    await owner.getAddress(), // executor
    TEMPLEGOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });