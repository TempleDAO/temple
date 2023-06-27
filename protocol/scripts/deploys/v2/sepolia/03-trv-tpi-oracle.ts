import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { TreasuryPriceIndexOracle__factory } from '../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../helpers';
import { getDeployedContracts } from './contract-addresses';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const TEMPLE_V2_DEPLOYED = getDeployedContracts();

  const treasuryPriceIndexOracle = new TreasuryPriceIndexOracle__factory(owner);
  await deployAndMine(
    'TRV_TREASURY_PRICE_INDEX_ORACLE',
    treasuryPriceIndexOracle,
    treasuryPriceIndexOracle.deploy,
    TEMPLE_V2_DEPLOYED.CORE.RESCUER_MSIG,
    TEMPLE_V2_DEPLOYED.CORE.EXECUTOR_MSIG,
    -1, // TODO: update value 
    -1, // TODO: update value
    -1 // TODO: update value
  )

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });