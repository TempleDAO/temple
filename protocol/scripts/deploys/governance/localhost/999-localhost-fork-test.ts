import '@nomiclabs/hardhat-ethers';
import { ethers } from 'hardhat';
import { 
  Templar__factory,
  ElderElection__factory,
} from '../../../../typechain';
import {
  ensureExpectedEnvvars,
  impersonateSigner,
} from '../../helpers';
// import { impersonateSigner, mineForwardSeconds, ZERO_ADDRESS } from '../../../test/helpers';
import {
  DeployedContracts, 
  getDeployedContracts
} from '../contract-addresses';

async function main() {
  ensureExpectedEnvvars();
  const [owner] = await ethers.getSigners();

  const DEPLOYED: DeployedContracts = getDeployedContracts();
  const templarNft = Templar__factory.connect(DEPLOYED.TEMPLAR_NFT, owner);
  const elderElection = ElderElection__factory.connect(DEPLOYED.ELDER_ELECTION, owner);
  const multisig = await impersonateSigner(DEPLOYED.MULTISIG);

  // Send the msig some eth for the transactions.
  await owner.sendTransaction({
    to: await multisig.getAddress(),
    value: ethers.utils.parseEther("1"),
  });

  // ... do some things on the deployed contracts to test post deploy.

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
