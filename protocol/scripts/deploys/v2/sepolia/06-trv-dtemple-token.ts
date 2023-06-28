import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { TempleDebtToken__factory } from '../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../helpers';
import { getDeployedContracts } from '../sepolia/contract-addresses';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const TEMPLE_V2_DEPLOYED = getDeployedContracts();

  const dTempleDebtTokenFactory = new TempleDebtToken__factory(owner);
  await deployAndMine(
    'TRV_DTEMPLE',
    dTempleDebtTokenFactory,
    dTempleDebtTokenFactory.deploy,
    "Temple Debt TEMPLE",
    "dTEMPLE",
    await owner.getAddress(),
    await owner.getAddress(),
    ethers.utils.parseEther("0"), // 0% IR
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