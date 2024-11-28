import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { SpiceAuction__factory } from '../../../../typechain';
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
  const MAINNET_CHAIN_ID = 1;
  const MAINNET_LZ_EID = 30101;

  const factory = new SpiceAuction__factory(owner);
  await deployAndMine(
    'SPICE_AUCTION',
    factory,
    factory.deploy,
    TEMPLEGOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD,
    '', // spice token
    CORE_ADDRESSES.CORE.EXECUTOR_MSIG, // dao executor placeholder
    TEMPLEGOLD_ADDRESSES.TEMPLE_GOLD.SPICE_AUCTION_OPERATOR, // operator
    MAINNET_LZ_EID, // layer zero EID mainnet
    MAINNET_CHAIN_ID, // mint source chain
    'spice_auction_name'
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