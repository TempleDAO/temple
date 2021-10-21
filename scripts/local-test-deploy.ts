import '@nomiclabs/hardhat-ethers';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import {
  ExitQueue__factory,
  FakeERC20__factory,
  LockedOGTemple__factory,
  Presale__factory,
  PresaleAllocation__factory,
  TempleERC20Token__factory,
  TempleOpeningCeremony__factory,
  TempleStaking__factory,
  TempleTreasury__factory
} from '../typechain';

function toAtto(n: number) {
  return BigNumber.from(10).pow(18).mul(n);
}

function fromAtto(n: BigNumber) {
  return n.div(BigNumber.from(10).pow(18)).toNumber();
}

async function main() {
  const [owner] = await ethers.getSigners();

  const startEpochSeconds = Math.floor(Date.now() / 1000);
  const epochSizeSeconds = 24 * 60 * 60;
  const unlockTimestampSeconds = startEpochSeconds + epochSizeSeconds * 2;

  const TEMPLE = await new TempleERC20Token__factory(owner).deploy();
  const EXIT_QUEUE = await new ExitQueue__factory(owner).deploy(
      TEMPLE.address,
      toAtto(10000), /* max per epoch */
      toAtto(1000), /* max per address per epoch */
      epochSizeSeconds, /* epoch size, in blocks */
  );

  const STAKING = await new TempleStaking__factory(owner).deploy(
      TEMPLE.address,
      EXIT_QUEUE.address,
      epochSizeSeconds, /* epoch size, in blocks */
      startEpochSeconds
  );
  // await STAKING.setStartingBlock(await EXIT_QUEUE.firstBlock());
  await STAKING.setEpy(80, 10000);

  const STABLE_COIN = await new FakeERC20__factory(owner).deploy('FRAX', 'FRAX');
  const TREASURY = await new TempleTreasury__factory(owner).deploy(
      TEMPLE.address,
      STABLE_COIN.address,
  );
  await TEMPLE.addMinter(TREASURY.address);

  const STAKING_LOCK = await new LockedOGTemple__factory(owner).deploy(await STAKING.OG_TEMPLE());
  const PRESALE_ALLOCATION = await new PresaleAllocation__factory(owner).deploy();

  const PRESALE = await new Presale__factory(owner).deploy(
      STABLE_COIN.address,
      TEMPLE.address,
      STAKING.address,
      STAKING_LOCK.address,
      TREASURY.address,
      PRESALE_ALLOCATION.address,
      6,
      unlockTimestampSeconds,
  );
  await TEMPLE.addMinter(PRESALE.address);

  // mint fake STABLE_COIN into all test accounts
  const accounts = await ethers.getSigners();

  // mint some STABLE_COIN into all test accounts
  for (const account of accounts) {
    const address = await account.getAddress();
    await STABLE_COIN.mint(address, toAtto(15000));
  }

  // Seed mint to bootstrap treasury
  await STABLE_COIN.increaseAllowance(TREASURY.address, 100);
  await TREASURY.seedMint(100, 1000);

  // await STABLE_COIN.connect(accounts[accounts.length-1]).approve(PRESALE.address, toAtto(5000));

  // Add both Mint and Stake and TempleStake as strategies
  // NOTE: Currently we just mint temple into each, the later should be done as a strategy
  // await TREASURY. addPool(PRESALE.address, 0, toAtto(10000000), 0);
  // await TREASURY.addPool(STAKING.address, 0, toAtto(10000000), 0);

  // Add an allowance for each account to join mint and stake
  let counter = 0;
  // set allocation only on the 1st half of the accounts
  for (const account of accounts) {
    const stakerAddress = await account.getAddress();
    if (counter < accounts.length / 2) {
      await PRESALE_ALLOCATION.setAllocation(stakerAddress, toAtto(15000), 6);
    }
    if (counter < accounts.length / 3) {
      await PRESALE_ALLOCATION.setAllocation(stakerAddress, toAtto(15000), 7);
    }
    if (counter < accounts.length / 4) {
      await PRESALE_ALLOCATION.setAllocation(stakerAddress, toAtto(15000), 8);
    }
    if (counter > accounts.length - 3) {
      await PRESALE_ALLOCATION.setAllocation(stakerAddress, toAtto(15000), 0);
    }

    counter++;
  }

  // Print config required to run dApp
  const contract_address: { [key: string]: string; } = {
    'EXIT_QUEUE_ADDRESS': EXIT_QUEUE.address,
    'LOCKED_OG_TEMPLE_ADDRESS': STAKING_LOCK.address,
    'PRESALE_ADDRESS': PRESALE.address,
    'PRESALE_ALLOCATION_ADDRESS': PRESALE_ALLOCATION.address,
    'STABLE_COIN_ADDRESS': STABLE_COIN.address,
    'TEMPLE_ADDRESS': TEMPLE.address,
    'TEMPLE_STAKING_ADDRESS': STAKING.address,
    'TREASURY_ADDRESS': TREASURY.address,
  };

  console.log();
  console.log('=========================================');
  console.log('*** Copy/pasta into .env.local for dApp dev\n\n');
  for (let envvar in contract_address) {
    console.log(`NEXT_PUBLIC_${envvar}=${contract_address[envvar]}`);
  }

  console.log();
  console.log('=========================================');
  console.log('*** Copy/pasta into terminal to use with scripts like metrics/test-temple interactions etc\n\n');
  for (let envvar in contract_address) {
    console.log(`EXPORT ${envvar}=${contract_address[envvar]}`);
  }

  console.log(`==================== TEMPLE OPENING CEREMONY =====================`);
  const TEMPLE_OPENING_CEREMONY = await new TempleOpeningCeremony__factory(owner).deploy();
  // Add data to account 0 to be in step 1
  const openingCeremonyDataStep1 = {
    roles: ['echoing whispers'],
  };
  const stringifyOpeningCeremonyData = JSON.stringify(openingCeremonyDataStep1);
  await TEMPLE_OPENING_CEREMONY.setData(accounts[0].address, 1, stringifyOpeningCeremonyData);

  // Add data to account 1 to be in step 2
  const openingCeremonyDataStep2 = {
    roles: ['echoing whispers', 'enclave member'],
    joinedEnclaveAt: Date.now(),
  };
  const stringifyOpeningCeremonyData2 = JSON.stringify(openingCeremonyDataStep2);
  await TEMPLE_OPENING_CEREMONY.setData(accounts[1].address, 1, stringifyOpeningCeremonyData2);
  console.log(`TEMPLE_OPENING_CEREMONY: ${TEMPLE_OPENING_CEREMONY.address}`);

  for (const account of accounts) {
    const address = await account.getAddress();
    const allocation = await PRESALE_ALLOCATION.allocationOf(address);
    const { amount, epoch } = allocation;
    const logData = await TEMPLE_OPENING_CEREMONY.dataOf(address);
    console.info(`address: ${address} amount: ${fromAtto(amount)} epoch: ${epoch.toNumber()}`);
    if (logData.version) {
      console.info(`Opening Ceremony Data:`);
      console.info(`version: ${logData.version} data: ${logData.data}`);
    }
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
