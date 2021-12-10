import '@nomiclabs/hardhat-ethers';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { TempleERC20Token__factory, ExitQueue__factory, TempleStaking__factory, FakeERC20__factory, TempleTreasury__factory, LockedOGTemple__factory, PresaleAllocation__factory, TreasuryManagementProxy__factory, OpeningCeremony__factory, EchoingWhispers__factory, VerifyQuest, VerifyQuest__factory, TempleCashback__factory } from '../../typechain';

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

  const templeToken = await new TempleERC20Token__factory(owner).deploy();
  const exitQueue = await new ExitQueue__factory(owner).deploy(
      templeToken.address,
      toAtto(10000), /* max per epoch */
      toAtto(1000), /* max per address per epoch */
      epochSizeSeconds, /* epoch size, in blocks */
  );

  const staking = await new TempleStaking__factory(owner).deploy(
      templeToken.address,
      exitQueue.address,
      epochSizeSeconds, /* epoch size, in blocks */
      startEpochSeconds
  );
  // await staking.setStartingBlock(await exitQueue.firstBlock());
  await staking.setEpy(80, 10000);

  const stablecToken = await new FakeERC20__factory(owner).deploy('FRAX', 'FRAX');
  const treasury = await new TempleTreasury__factory(owner).deploy(
      templeToken.address,
      stablecToken.address,
  );
  await templeToken.addMinter(treasury.address);

  const lockedOGTemple = await new LockedOGTemple__factory(owner).deploy(await staking.OG_TEMPLE());
  const presaleAllocation = await new PresaleAllocation__factory(owner).deploy();

  // mint fake stablecToken into all test accounts
  const accounts = await ethers.getSigners();

  // mint some stablecToken into all test accounts
  for (const account of accounts) {
    const address = await account.getAddress();
    await stablecToken.mint(address, toAtto(15000));
  }

  // Seed mint to bootstrap treasury
  await stablecToken.increaseAllowance(treasury.address, 100);
  await treasury.seedMint(100, 1000);

  // Deploy treasury proxy (used for all treasury management going forward)
  const treasuryManagementProxy = await new TreasuryManagementProxy__factory(owner).deploy(
    await owner.getAddress(),
    treasury.address,
  );
  await treasury.transferOwnership(treasuryManagementProxy.address);

  const openingCeremony = await new OpeningCeremony__factory(owner).deploy(
    stablecToken.address,
    templeToken.address,
    staking.address,
    lockedOGTemple.address,
    treasury.address,
    treasuryManagementProxy.address,
    toAtto(10000),
    toAtto(30000),
    2, /* invites per person */
    { numerator: 2, denominator: 10 },
    { numerator: 1, denominator: 10 },
  );
  await templeToken.addMinter(openingCeremony.address);

  const verifier = ethers.Wallet.createRandom();
  const verifyQuest = new VerifyQuest__factory(owner).deploy(
    openingCeremony.address,
    verifier.address,
  )

  const echoingWhispers = await new EchoingWhispers__factory(owner).deploy();
  await echoingWhispers.setConditions(
      ethers.utils.keccak256(ethers.utils.formatBytes32String("1-5")),
      ethers.utils.keccak256(ethers.utils.formatBytes32String("3-2")))

  const templeCashback = await new TempleCashback__factory(owner).deploy(await owner.getAddress());

  // Add an allowance for each account to join mint and stake
  let counter = 0;
  // set allocation only on the 1st half of the accounts
  for (const account of accounts.slice(5)) {
    const stakerAddress = await account.getAddress();
    if (counter < accounts.length / 2) {
      await presaleAllocation.setAllocation(stakerAddress, toAtto(15000), 6);
    }
    if (counter < accounts.length / 3) {
      await presaleAllocation.setAllocation(stakerAddress, toAtto(15000), 7);
    }
    if (counter < accounts.length / 4) {
      await presaleAllocation.setAllocation(stakerAddress, toAtto(15000), 8);
    }
    if (counter > accounts.length - 3) {
      await presaleAllocation.setAllocation(stakerAddress, toAtto(15000), 0);
    }

    counter++;
  }

  // Print config required to run dApp
  const contract_address: { [key: string]: string; } = {
    'EXIT_QUEUE_ADDRESS': exitQueue.address,
    'LOCKED_OG_TEMPLE_ADDRESS': lockedOGTemple.address,
    'PRESALE_ALLOCATION_ADDRESS': presaleAllocation.address,
    'STABLE_COIN_ADDRESS': stablecToken.address,
    'TEMPLE_ADDRESS': templeToken.address,
    'TEMPLE_STAKING_ADDRESS': staking.address,
    'TREASURY_ADDRESS': treasury.address,
    'TREASURY_MANAGEMENT_ADDRESS': treasuryManagementProxy.address,
    'OPENING_CEREMONY_ADDRESS': openingCeremony.address,
    'ECHOING_WHISPERS_ADDRESS': echoingWhispers.address,
    'TEMPLE_CASHBACK_ADDRESS': templeCashback.address,
    'VERIFIER_PRIVATE_KEY': verifier.privateKey,
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
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
