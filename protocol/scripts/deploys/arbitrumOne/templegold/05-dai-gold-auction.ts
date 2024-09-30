import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { DaiGoldAuction__factory } from '../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../helpers';
import { getDeployedTempleGoldContracts } from '../contract-addresses';
import { getDeployedContracts } from '../../mainnet/v2/contract-addresses';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const TEMPLEGOLD_ADDRESSES = getDeployedTempleGoldContracts();
  const CORE_ADDRESSES = getDeployedContracts(); 

  const factory = new DaiGoldAuction__factory(owner);
  await deployAndMine(
    'DAI_GOLD_AUCTION',
    factory,
    factory.deploy,
    TEMPLEGOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD,
    CORE_ADDRESSES.EXTERNAL.MAKER_DAO.DAI_TOKEN,
    CORE_ADDRESSES.CORE.EXECUTOR_MSIG, // treasury
    CORE_ADDRESSES.CORE.RESCUER_MSIG,
    CORE_ADDRESSES.CORE.EXECUTOR_MSIG,
    TEMPLEGOLD_ADDRESSES.TEMPLE_GOLD.AUCTION_AUTOMATION_EOA
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