import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { TempleDebtToken__factory } from '../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../helpers';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();

  const factory = new TempleDebtToken__factory(owner);

  // See the forge test: test_dsr_interest_equivalence()
  // The DAI rate is 3.49% APR
  // Continuously compounded representation == ln(1.0349)
  const dsrRateAPY = ethers.utils.parseEther("0.034304803691990293");

  await deployAndMine(
    'templeDebtToken', factory, factory.deploy,
    'Temple Debt Token', 'dUSD', 
    await owner.getAddress(), await owner.getAddress(),
    dsrRateAPY, 
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