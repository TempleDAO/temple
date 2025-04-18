import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { TempleTeleporter__factory } from '../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../helpers';
import { getDeployedTempleGoldContracts } from '../../mainnet/templegold/contract-addresses';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const TEMPLEGOLD_ADDRESSES = getDeployedTempleGoldContracts();

  const factory = new TempleTeleporter__factory(owner);
  await deployAndMine(
    'TEMPLE_TELEPORTER',
    factory,
    factory.deploy,
    await owner.getAddress(),
    TEMPLEGOLD_ADDRESSES.CORE.TEMPLE_TOKEN,
    TEMPLEGOLD_ADDRESSES.EXTERNAL.LAYER_ZERO.ENDPOINT
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