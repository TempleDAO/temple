import '@nomiclabs/hardhat-ethers';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { blockTimestamp, mineNBlocks } from '../../test/helpers';
import {
  ExitQueue__factory,
  FakeERC20__factory,
  LockedOGTemple__factory,
  OGTemple__factory,
  OpeningCeremony__factory,
  TempleCashback__factory,
  TempleERC20Token__factory,
  TempleStaking__factory,
  TempleTreasury__factory,
  TreasuryManagementProxy__factory,
} from '../../typechain';

function toAtto(n: number) {
  return BigNumber.from(10).pow(18).mul(n);
}

function fromAtto(n: BigNumber) {
  return n.div(BigNumber.from(10).pow(18)).toNumber();
}

async function main() {
  const [owner, user] = await ethers.getSigners();

  const startEpochSeconds = await blockTimestamp();
  const epochSizeSeconds = 24 * 60 * 60;
  const unlockTimestampSeconds = startEpochSeconds + epochSizeSeconds * 2;

  const TEMPLE = await new TempleERC20Token__factory(owner).deploy();
  const EXIT_QUEUE = await new ExitQueue__factory(owner).deploy(
      TEMPLE.address,
      toAtto(50), /* max per epoch */
      toAtto(1000), /* max per address per epoch */
      10, /* epoch size, in blocks */
  );

  const STAKING = await new TempleStaking__factory(owner).deploy(
      TEMPLE.address,
      EXIT_QUEUE.address,
      epochSizeSeconds, /* epoch size, in blocks */
      startEpochSeconds
  );
  await STAKING.setEpy(80, 10000);

  const OG_TEMPLE = new OGTemple__factory(owner).attach(await STAKING.OG_TEMPLE());

  const stablecToken = await new FakeERC20__factory(owner).deploy('FRAX', 'FRAX');
  const treasury = await new TempleTreasury__factory(owner).deploy(
      TEMPLE.address,
      stablecToken.address,
  );
  await TEMPLE.addMinter(treasury.address);

  const OG_TEMPLE_LOCKED = await new LockedOGTemple__factory(owner).deploy(OG_TEMPLE.address);

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
    TEMPLE.address,
    STAKING.address,
    OG_TEMPLE_LOCKED.address,
    treasury.address,
    treasuryManagementProxy.address,
    toAtto(10000),
    toAtto(30000),
    2, /* invites per person */
    { numerator: 2, denominator: 10 },
    { numerator: 1, denominator: 10 },
  );
  await TEMPLE.addMinter(openingCeremony.address);

  const verifier = ethers.Wallet.createRandom();

  const templeCashback = await new TempleCashback__factory(owner).deploy(await owner.getAddress());

  await TEMPLE.addMinter(await owner.getAddress());
  await TEMPLE.mint(await owner.getAddress(), toAtto(1000000));

	// Deposit TEMPLE to TempleCashback Contract
  Promise.all([
		await TEMPLE
			.connect(owner)
			.transfer(templeCashback.address, toAtto(150000)),
  ]);

  // UNLOCK SETUP
  await TEMPLE.addMinter(owner.address);
  await TEMPLE.mint(STAKING.address,           toAtto(1000000000));
  await TEMPLE.mint(user.address,           toAtto(700));
  await OG_TEMPLE.connect(user).increaseAllowance(OG_TEMPLE_LOCKED.address, toAtto(1000));
  const lockedUntil = (await blockTimestamp());
  await TEMPLE.connect(user).increaseAllowance(STAKING.address, toAtto(1000));
  await STAKING.connect(user).stake(toAtto(100));
  const userBalanceOGT = await OG_TEMPLE.balanceOf(user.address);
  await OG_TEMPLE.connect(user).increaseAllowance(STAKING.address, userBalanceOGT);
  await STAKING.connect(user).unstake(userBalanceOGT);

  await STAKING.connect(user).stake(toAtto(600));

  await OG_TEMPLE_LOCKED.connect(user).lock(toAtto(100), lockedUntil);
  await OG_TEMPLE_LOCKED.connect(user).lock(toAtto(50), lockedUntil + 10);
  await OG_TEMPLE_LOCKED.connect(user).lock(toAtto(100), lockedUntil);
  await OG_TEMPLE_LOCKED.connect(user).lock(toAtto(150), lockedUntil + 24 * 60 * 60);
  await OG_TEMPLE_LOCKED.connect(user).lock(toAtto(200), lockedUntil + 7 * 24 * 60 * 60);
  // // JoinQueue
  await OG_TEMPLE_LOCKED.connect(user).withdraw(0);
  await OG_TEMPLE_LOCKED.connect(user).withdraw(1);

  // go to epoch 2
  await mineNBlocks((await EXIT_QUEUE.epochSize()).toNumber() * 2);
  await EXIT_QUEUE.withdraw(1);

  // Print config required to run dApp
  const contract_address: { [key: string]: string; } = {
    'EXIT_QUEUE_ADDRESS': EXIT_QUEUE.address,
    'LOCKED_OG_TEMPLE_ADDRESS': OG_TEMPLE_LOCKED.address,
    'STABLE_COIN_ADDRESS': stablecToken.address,
    'TEMPLE_ADDRESS': TEMPLE.address,
    'TEMPLE_STAKING_ADDRESS': STAKING.address,
    'TREASURY_ADDRESS': treasury.address,
    'TREASURY_MANAGEMENT_ADDRESS': treasuryManagementProxy.address,
    'OPENING_CEREMONY_ADDRESS': openingCeremony.address,
    'TEMPLE_CASHBACK_ADDRESS': templeCashback.address,
    'VERIFY_QUEST_ADDRESS': verifier.address,
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
