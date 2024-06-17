import '@nomiclabs/hardhat-ethers';
import { ethers, network } from 'hardhat';
import { TempleTeamPayments__factory } from '../../../../typechain';
import {
  DEPLOYED_CONTRACTS,
  expectAddressWithPrivateKey,
  toAtto,
} from '../../helpers';
import snapshot from './json/epoch24b.json';

// TODO: Add command line arguments for json allocations file
async function main() {
  expectAddressWithPrivateKey();
  const [owner] = await ethers.getSigners();

  if (DEPLOYED_CONTRACTS[network.name] === undefined) {
    console.log(`No contracts configured for ${network.name}`);
    return;
  }
  const DEPLOYED = DEPLOYED_CONTRACTS[network.name];

  const templeTeamPaymentsFactory = new TempleTeamPayments__factory(owner);
  const startDate = Math.round(Date.now() / 1000);
  const DAI = '0x6b175474e89094c44da98b954eedeac495271d0f';
  const templeTeamPayments = await templeTeamPaymentsFactory.deploy(
    DAI,
    10, // although no vesting, but has to be at least 1 second vesting else division by zero error
    startDate
  );
  console.log(
    `Deployment mining...: https://etherscan.io/tx/${templeTeamPayments.deployTransaction.hash}`
  );
  await templeTeamPayments.deployed();
  console.log('Contract deployed');
  console.log(
    `yarn hardhat verify --network ${network.name} ${templeTeamPayments.address} ${DAI} 10 ${startDate}`
  );

  console.log('Setting allocations');
  const tx1 = await templeTeamPayments.setAllocations(
    Object.keys(snapshot),
    Object.values(snapshot).map((amount) => toAtto(amount))
  );
  await tx1.wait();
  console.log('Mined');
  console.log(
    `https://etherscan.io/address/${templeTeamPayments.address} ${Object.values(
      snapshot
    )
      .reduce((sum, cur) => (sum += cur), 0)
      .toFixed(2)} DAI allocated across ${
      Object.keys(snapshot).length
    } addresses`
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
