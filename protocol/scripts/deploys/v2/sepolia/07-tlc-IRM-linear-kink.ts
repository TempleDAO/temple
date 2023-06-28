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
    -1, // TODO: update value
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