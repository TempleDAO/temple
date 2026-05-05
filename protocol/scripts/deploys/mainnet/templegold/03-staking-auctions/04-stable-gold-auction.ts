import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { StableGoldAuction__factory } from '../../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../../helpers';
import { getDeployedContracts } from '../contract-addresses';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const ADDRS = getDeployedContracts();
  const treasury = ADDRS.TEMPLE_GOLD.TEAM_GNOSIS;

  const factory = new StableGoldAuction__factory(owner);
  await deployAndMine(
    'STABLE_GOLD_AUCTION',
    factory,
    factory.deploy,
    ADDRS.TEMPLE_GOLD.TEMPLE_GOLD,
    ADDRS.EXTERNAL.SKY.USDS,
    treasury, // gnosis for CSS strategy
    ADDRS.CORE.RESCUER_MSIG,
    ADDRS.CORE.EXECUTOR_MSIG,
    ADDRS.CORE.EXECUTOR_MSIG, // start with executor
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
