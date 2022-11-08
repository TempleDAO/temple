import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';
import { TempleTeamPaymentsFactory__factory } from '../../../typechain';
import {
  DeployedContracts,
  DEPLOYED_CONTRACTS,
  expectAddressWithPrivateKey,
} from '../helpers';

async function main() {
  expectAddressWithPrivateKey();
  const [owner] = await ethers.getSigners();

  let DEPLOYED: DeployedContracts;

  if (DEPLOYED_CONTRACTS[network.name] === undefined) {
    console.log(`No contracts configured for ${network.name}`);
    return;
  } else {
    DEPLOYED = DEPLOYED_CONTRACTS[network.name];
  }

  // Set gasPrice manually instead of using deployAndMine/mine()
  const gasPrice = ethers.utils.parseUnits('34', 'gwei');

  const lastPaidEpoch = 6;
  const templeTeamPaymentsFactory =
    await new TempleTeamPaymentsFactory__factory(owner).deploy(lastPaidEpoch, {
      gasPrice,
    });
  console.log(
    `Deployed TempleTeamPaymentsFactory... waiting for transaction to mine: ${templeTeamPaymentsFactory.deployTransaction.hash}`
  );
  await templeTeamPaymentsFactory.deployed();
  console.log('Contract deployed');
  console.log(
    `yarn hardhat verify --network ${network.name} ${templeTeamPaymentsFactory.address} ${lastPaidEpoch}`
  );
  console.log(`Transferring ownership to ${DEPLOYED.MULTISIG}`);
  const tx2 = await templeTeamPaymentsFactory.transferOwnership(
    DEPLOYED.MULTISIG,
    {
      gasPrice,
    }
  );
  await tx2.wait();
  console.log('Mined');
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
