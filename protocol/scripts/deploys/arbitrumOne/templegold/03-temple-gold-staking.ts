import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { TempleGoldStaking__factory } from '../../../../typechain';
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


  const factory = new TempleGoldStaking__factory(owner);
  await deployAndMine(
    'TEMPLE_GOLD_STAKING',
    factory,
    factory.deploy,
    CORE_ADDRESSES.CORE.RESCUER_MSIG,
    CORE_ADDRESSES.CORE.EXECUTOR_MSIG,
    CORE_ADDRESSES.CORE.TEMPLE_TOKEN,
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