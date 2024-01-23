import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { TreasuryPriceIndexOracle__factory } from '../../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../../helpers';
import { getDeployedContracts } from '../contract-addresses';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const TEMPLE_V2_ADDRESSES = getDeployedContracts();

  const treasuryPriceIndexOracle = new TreasuryPriceIndexOracle__factory(owner);
  await deployAndMine(
    'CORE.TREASURY_RESERVES_VAULT.TPI_ORACLE',
    treasuryPriceIndexOracle,
    treasuryPriceIndexOracle.deploy,
    TEMPLE_V2_ADDRESSES.CORE.RESCUER_MSIG,
    await owner.getAddress(),
    ethers.utils.parseEther("1.06"), // ~1.06 TPI at deployment date
    ethers.utils.parseEther("0.05"), // max treasury price index delta
    1_800 // cooldown
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