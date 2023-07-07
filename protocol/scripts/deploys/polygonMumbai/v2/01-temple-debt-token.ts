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
  await deployAndMine(
    'templeDebtToken', factory, factory.deploy,
    'Temple Debt Token', 'dUSD', 
    await owner.getAddress(),
    ethers.utils.parseEther("0.01"), 
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