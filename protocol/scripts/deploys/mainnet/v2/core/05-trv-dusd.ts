import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { TempleDebtToken__factory } from '../../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../../helpers';
import { getDeployedContracts } from '../contract-addresses';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const TEMPLE_V2_ADDRESSES = getDeployedContracts();

  const dUsdDebtTokenFactory = new TempleDebtToken__factory(owner);
  await deployAndMine(
    'TREASURY_RESERVES_VAULT.D_USD_TOKEN',
    dUsdDebtTokenFactory,
    dUsdDebtTokenFactory.deploy,
    "Temple Debt USD",
    "dUSD",
    TEMPLE_V2_ADDRESSES.CORE.RESCUER_MSIG,
    await owner.getAddress(),
    // 5% APR == ln(1.05) == 4.87...% APY continuous compounding
    ethers.utils.parseEther("0.048790164169431991"),
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