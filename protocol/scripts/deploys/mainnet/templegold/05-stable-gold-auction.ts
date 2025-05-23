import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { StableGoldAuction__factory } from '../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../helpers';
import { getDeployedTempleGoldContracts } from './contract-addresses';
import { getDeployedContracts } from '../v2/contract-addresses';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const TEMPLEGOLD_ADDRESSES = getDeployedTempleGoldContracts();
  const CORE_ADDRESSES = getDeployedContracts(); 
  const treasury = "0xA1f01d98d60273ED562eE79fEb718bbdB85E1d9C";

  const factory = new StableGoldAuction__factory(owner);
  await deployAndMine(
    'STABLE_GOLD_AUCTION',
    factory,
    factory.deploy,
    TEMPLEGOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD,
    TEMPLEGOLD_ADDRESSES.EXTERNAL.SKY.USDS,
    treasury, // gnosis for CSS strategy
    CORE_ADDRESSES.CORE.RESCUER_MSIG,
    CORE_ADDRESSES.CORE.EXECUTOR_MSIG,
    CORE_ADDRESSES.CORE.EXECUTOR_MSIG, // start with executor //TEMPLEGOLD_ADDRESSES.TEMPLE_GOLD.AUCTION_AUTOMATION_EOA
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