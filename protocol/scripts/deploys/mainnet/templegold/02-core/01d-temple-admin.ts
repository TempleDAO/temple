import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { TempleGoldAdmin__factory } from '../../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../../helpers';
import { getDeployedContracts } from '../contract-addresses';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const ADDRS = getDeployedContracts();

  const factory = new TempleGoldAdmin__factory(owner);
  await deployAndMine(
    'TEMPLE_GOLD_ADMIN',
    factory,
    factory.deploy,
    ADDRS.CORE.RESCUER_MSIG,
    ADDRS.CORE.EXECUTOR_MSIG,
    ADDRS.TEMPLE_GOLD.TEMPLE_GOLD
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
