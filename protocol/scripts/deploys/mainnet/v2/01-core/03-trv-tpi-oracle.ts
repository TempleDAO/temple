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

  const existingOracle = TreasuryPriceIndexOracle__factory.connect(TEMPLE_V2_ADDRESSES.TREASURY_RESERVES_VAULT.TPI_ORACLE, owner);

  const treasuryPriceIndexOracle = new TreasuryPriceIndexOracle__factory(owner);
  await deployAndMine(
    'CORE.TREASURY_RESERVES_VAULT.TPI_ORACLE',
    treasuryPriceIndexOracle,
    treasuryPriceIndexOracle.deploy,
    TEMPLE_V2_ADDRESSES.CORE.RESCUER_MSIG,
    await owner.getAddress(),
    await existingOracle.treasuryPriceIndex(),
    ethers.utils.parseEther("1"), // maxTreasuryPriceIndexDelta: $1
    14 * 86_400, // minTreasuryPriceIndexTargetTimeDelta: 2 weeks
    ethers.utils.parseEther("0.01").div(86_400), // maxAbsTreasuryPriceIndexRateOfChange: 1c/day
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