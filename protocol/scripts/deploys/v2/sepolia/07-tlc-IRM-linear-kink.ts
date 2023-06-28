import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { LinearWithKinkInterestRateModel__factory } from '../../../../typechain';
import {
  deployAndMine,
  ensureExpectedEnvvars,
} from '../../helpers';
import { getDeployedContracts } from './contract-addresses';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();
  const TEMPLE_V2_DEPLOYED = getDeployedContracts();

  const linearKinkIRMFactory = new LinearWithKinkInterestRateModel__factory(owner);
  await deployAndMine(
    'TLC_LINEAR_KINK_IRM',
    linearKinkIRMFactory,
    linearKinkIRMFactory.deploy,
    await owner.getAddress(),
    await owner.getAddress(),
    ethers.utils.parseEther("0.05"), // 5% IR
    ethers.utils.parseEther("0.2"), // 20% Max IR
    ethers.utils.parseEther("0.9"), // 90% kink UR
    ethers.utils.parseEther("0.1") // 10% kink IR
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