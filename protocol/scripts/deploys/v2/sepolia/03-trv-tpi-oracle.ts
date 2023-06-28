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
    await owner.getAddress(),
    await owner.getAddress(),
    ethers.utils.parseEther("1.025"),
    ethers.utils.parseEther("0.05"),
    300
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