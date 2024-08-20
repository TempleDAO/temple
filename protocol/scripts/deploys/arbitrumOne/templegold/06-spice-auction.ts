import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { SpiceAuction__factory } from '../../../../typechain';
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
  const ARBITRUM_ONE_CHAIN_ID = 42161;
  const ARBITRUM_ONE_LZ_EID = 30110;

  const factory = new SpiceAuction__factory(owner);
  await deployAndMine(
    'SPICE_AUCTION',
    factory,
    factory.deploy,
    TEMPLEGOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD,
    '', // spice token
    CORE_ADDRESSES.CORE.EXECUTOR_MSIG, // dao executor placeholder
    ARBITRUM_ONE_LZ_EID, // layer zero EID arbitrum one
    ARBITRUM_ONE_CHAIN_ID, // mint chain
    'name'
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