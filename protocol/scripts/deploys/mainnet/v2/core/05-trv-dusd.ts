import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { TempleDebtToken__factory } from '../../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../../helpers';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();

  const dUsdDebtTokenFactory = new TempleDebtToken__factory(owner);
  await deployAndMine(
    'CORE.TREASURY_RESERVES_VAULT.D_USD_TOKEN',
    dUsdDebtTokenFactory,
    dUsdDebtTokenFactory.deploy,
    "Temple Debt USD",
    "dUSD",
    await owner.getAddress(),
    await owner.getAddress(),
    ethers.utils.parseEther("0.034304803691990293"), // 34.9% APR or ~34.304%APY
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