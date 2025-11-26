import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { SpiceAuctionFactory__factory } from '../../../../typechain';
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

  const factory = new SpiceAuctionFactory__factory(owner);
  await deployAndMine(
    'SPICE_AUCTION_FACTORY',
    factory,
    factory.deploy,
    TEMPLEGOLD_ADDRESSES.TEMPLE_GOLD.SPICE_AUCTION_IMPLEMENTATION,
    CORE_ADDRESSES.CORE.RESCUER_MSIG,
    CORE_ADDRESSES.CORE.EXECUTOR_MSIG,
    CORE_ADDRESSES.CORE.EXECUTOR_MSIG,
    TEMPLEGOLD_ADDRESSES.TEMPLE_GOLD.SPICE_AUCTION_OPERATOR, // Overlord bot
    CORE_ADDRESSES.STRATEGIES.COSECHA_SEGUNDA_GNOSIS_STRATEGY.UNDERLYING_GNOSIS_SAFE, // Strategy Gnosis. Funds auctions
    TEMPLEGOLD_ADDRESSES.TEMPLE_GOLD.TEMPLE_GOLD, // TGLD
    MAINNET_LZ_EID, // Mint chain Layer Zero EID
    MAINNET_CHAIN_ID // Mint chain ID
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