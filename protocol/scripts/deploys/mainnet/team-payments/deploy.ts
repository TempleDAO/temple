import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';
import { TempleTeamPayments__factory } from '../../../../typechain';
import {
  DeployedContracts,
  DEPLOYED_CONTRACTS,
  expectAddressWithPrivateKey,
  toAtto,
  waitForMaxGas,
} from '../../helpers';
import snapshot from './json/epoch10.json';

// @dev: UPDATE THIS
const maxGasPrice = ethers.utils.parseUnits('18', 'gwei');

// TODO: Add command line arguments for max gas price and json allocations file
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

  let currentGasPrice = await waitForMaxGas(maxGasPrice);

  const templeTeamPaymentsFactory = new TempleTeamPayments__factory(owner);
  const startDate = Math.round(Date.now() / 1000);
  const templeTeamPayments = await templeTeamPaymentsFactory.deploy(
    DEPLOYED.TEMPLE,
    10, // although no vesting, but has to be at least 1 second vesting else division by zero error
    startDate,
    {
      gasPrice: currentGasPrice,
    }
  );
  console.log(
    `Deployed... waiting for transaction to mine: ${templeTeamPayments.deployTransaction.hash}`
  );
  await templeTeamPayments.deployed();
  console.log('Contract deployed');
  console.log(
    `yarn hardhat verify --network ${network.name} ${templeTeamPayments.address} ${DEPLOYED.TEMPLE} 10 ${startDate}`
  );

  currentGasPrice = await waitForMaxGas(maxGasPrice);
  console.log('Setting allocations');
  const tx1 = await templeTeamPayments.setAllocations(
    Object.keys(snapshot),
    Object.values(snapshot).map((amount) => toAtto(amount)),
    {
      gasPrice: currentGasPrice,
    }
  );
  await tx1.wait();
  console.log('Mined');
  console.log(
    `Total $TEMPLE allocated: ${Object.values(snapshot).reduce(
      (sum, cur) => (sum += cur),
      0
    )}, across ${Object.keys(snapshot).length} addresses`
  );

  console.log('Transferring owner');
  const tx2 = await templeTeamPayments.transferOwnership(DEPLOYED.MULTISIG);
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
