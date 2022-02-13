import '@nomiclabs/hardhat-ethers';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { blockTimestamp, mineNBlocks } from '../../test/helpers';
import {
  Devotion__factory,
  AMMWhitelist__factory,
  ExitQueue__factory,
  Faith__factory,
  FakeERC20__factory,
  LockedOGTemple__factory,
  OGTemple__factory,
  TempleCashback__factory,
  TempleERC20Token__factory,
  TempleFraxAMMOps__factory,
  TempleFraxAMMRouter__factory,
  TempleStaking__factory,
  TempleTeamPayments__factory,
  LockedOGTempleDeprecated__factory,
  TempleTreasury__factory,
  TempleUniswapV2Pair__factory,
  TreasuryManagementProxy__factory,
  AcceleratedExitQueue,
  AcceleratedExitQueue__factory,
  TempleZaps__factory,
} from '../../typechain';

function toAtto(n: number) {
  return BigNumber.from(10).pow(18).mul(n);
}

function fromAtto(n: BigNumber) {
  return n.div(BigNumber.from(10).pow(18)).toNumber();
}

async function main() {
  const [owner, account1, account2] = await ethers.getSigners();

  const startEpochSeconds = await blockTimestamp();
  const epochSizeSeconds = 24 * 60 * 60;

  const templeToken = await new TempleERC20Token__factory(owner).deploy();
  await templeToken.addMinter(await owner.getAddress()); // useful for tests for owner to be able to mint temple

  const exitQueue = await new ExitQueue__factory(owner).deploy(
    templeToken.address,
    toAtto(50) /* max per epoch */,
    toAtto(1000) /* max per address per epoch */,
    640 /* epoch size, in blocks */
  );

  const templeStaking = await new TempleStaking__factory(owner).deploy(
    templeToken.address,
    exitQueue.address,
    epochSizeSeconds /* epoch size, in blocks */,
    startEpochSeconds
  );
  await templeStaking.setEpy(80, 10000);

  const ogTempleToken = new OGTemple__factory(owner).attach(
    await templeStaking.OG_TEMPLE()
  );

  const stablecToken = await new FakeERC20__factory(owner).deploy(
    'FRAX',
    'FRAX'
  );
  const treasury = await new TempleTreasury__factory(owner).deploy(
    templeToken.address,
    stablecToken.address
  );
  await templeToken.addMinter(treasury.address);

  const lockedOgTemple_old = await new LockedOGTempleDeprecated__factory(
    owner
  ).deploy(ogTempleToken.address);
  const lockedOgTemple_new = await new LockedOGTemple__factory(owner).deploy(
    ogTempleToken.address
  );

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
  const treasuryManagementProxy = await new TreasuryManagementProxy__factory(
    owner
  ).deploy(await owner.getAddress(), treasury.address);
  await treasury.transferOwnership(treasuryManagementProxy.address);

  const verifier = ethers.Wallet.createRandom();

  const templeCashback = await new TempleCashback__factory(owner).deploy(
    verifier.address
  );
  await templeToken.mint(templeCashback.address, toAtto(150000));

  // stake, lock and exit some temple for a few users
  let nLocks = 1;
  for (const account of accounts.slice(1, 5)) {
    const address = await account.getAddress();
    await templeToken.mint(address, toAtto(30000));
    await templeToken
      .connect(account)
      .increaseAllowance(templeStaking.address, toAtto(20000));
    await templeStaking.connect(account).stake(toAtto(20000)); // stake a bunch, leave some free temple
    await ogTempleToken
      .connect(account)
      .increaseAllowance(lockedOgTemple_old.address, toAtto(10000));
    await ogTempleToken
      .connect(account)
      .increaseAllowance(templeStaking.address, toAtto(10000));
    const nOgTemple = (await ogTempleToken.balanceOf(address)).div(2); // only lock half

    // Lock temple, and unstake some, so it's in the exit queue
    const lockedUntil = await blockTimestamp();
    for (let i = 0; i < nLocks; i++) {
      await lockedOgTemple_old
        .connect(account)
        .lock(nOgTemple.div(nLocks).sub(1), lockedUntil + i * 600);
      await templeStaking.connect(account).unstake(nOgTemple.div(nLocks * 2));
    }

    nLocks += 1;
  }

  // // Mine a couple of epochs forward, to help testing
  // await mineNBlocks((await exitQueue.epochSize()).toNumber() * 2);

  // Create 2 versions of the team payment contract (contigent and fixed)
  const teamPaymentsFixed = await new TempleTeamPayments__factory(owner).deploy(
    templeToken.address,
    1,
    1
  );
  const teamPaymentsContigent = await new TempleTeamPayments__factory(
    owner
  ).deploy(templeToken.address, 1, 1);

  templeToken.mint(teamPaymentsFixed.address, toAtto(1000000));
  templeToken.mint(teamPaymentsContigent.address, toAtto(1000000));

  // Setup payments for first 5 users
  for (let i = 0; i < 5; i++) {
    teamPaymentsFixed.setAllocation(
      accounts[i + 1].address,
      toAtto(1000 * (i + 1))
    );
    teamPaymentsContigent.setAllocation(
      accounts[i + 1].address,
      toAtto(1000 * (i + 1))
    );
  }

  // Setup custom AMM with liquidity
  const pair = await new TempleUniswapV2Pair__factory(owner).deploy(
    await owner.getAddress(),
    templeToken.address,
    stablecToken.address
  );
  const templeRouter = await new TempleFraxAMMRouter__factory(owner).deploy(
    pair.address,
    templeToken.address,
    stablecToken.address,
    treasury.address,
    treasury.address,
    { frax: 100000, temple: 9000 },
    100 /* threshold decay per block */,
    { frax: 1000000, temple: 1000000 },
    { frax: 1000000, temple: 100000 }
  );

  // Contract where we send frax earned by treasury
  const ammOps = await new TempleFraxAMMOps__factory(owner).deploy(
    templeToken.address,
    templeRouter.address,
    treasuryManagementProxy.address,
    stablecToken.address,
    treasury.address,
    pair.address
  );

  await pair.setRouter(templeRouter.address);
  await templeToken.addMinter(templeRouter.address);
  await templeRouter.setProtocolMintEarningsAccount(ammOps.address);

  // Add liquidity to the AMM
  templeToken.mint(owner.address, toAtto(10000000));
  stablecToken.mint(owner.address, toAtto(10000000));
  await templeToken.increaseAllowance(templeRouter.address, toAtto(10000000));
  await stablecToken.increaseAllowance(templeRouter.address, toAtto(10000000));
  await templeRouter.addLiquidity(
    toAtto(100000),
    toAtto(1000000),
    1,
    1,
    await owner.getAddress(),
    (await blockTimestamp()) + 900
  );

  // Make temple router open access
  await templeRouter.toggleOpenAccess();

  // AMMWhitelist
  const ammWhitelist = await new AMMWhitelist__factory(owner).deploy(
    templeRouter.address,
    verifier.address
  );

  // Buy the Dip
  const faith = await new Faith__factory(owner).deploy();

  const acceleratedExitQueue: AcceleratedExitQueue =
    await new AcceleratedExitQueue__factory(owner).deploy(
      templeToken.address,
      exitQueue.address,
      templeStaking.address
    );
  await exitQueue.transferOwnership(acceleratedExitQueue.address);

  const devotion = await new Devotion__factory(owner).deploy(
    templeToken.address,
    faith.address,
    pair.address,
    lockedOgTemple_new.address,
    templeStaking.address,
    60 // 60 seconds
  );

  const expiryDate = (): number => Math.floor(Date.now() / 1000) + 900;
  await devotion.addDevotionMaster(owner.address);
  await faith.addManager(devotion.address);
  await faith.addManager(await owner.getAddress());
  await templeToken.increaseAllowance(
    templeRouter.address,
    toAtto(10000000000)
  );
  await stablecToken.increaseAllowance(
    templeRouter.address,
    toAtto(10000000000)
  );
  await templeRouter.addLiquidity(
    toAtto(100000),
    toAtto(100000),
    1,
    1,
    await owner.getAddress(),
    expiryDate()
  );
  await devotion.startDevotion(1, 1);
  // set a win state on Devotion
  await templeRouter.swapExactFraxForTemple(
    10000,
    1,
    account1.address,
    expiryDate()
  );
  await templeRouter.swapExactFraxForTemple(
    10000,
    1,
    account2.address,
    expiryDate()
  );
  // Add value to templePrizePool
  await templeToken.transfer(devotion.address, toAtto(1000));
  await mineNBlocks(3);
  await devotion.initiateDevotionFinalHour();
  await mineNBlocks(3);
  await devotion.connect(account1);
  // lock verify account1 OGT
  const DEVOTION = new Devotion__factory(owner)
    .attach(devotion.address)
    .connect(account1);
  const OG_TEMPLE = new OGTemple__factory(owner)
    .attach(await templeStaking.OG_TEMPLE())
    .connect(account1);
  await OG_TEMPLE.approve(lockedOgTemple_new.address, toAtto(1000000));
  const amountOGTemple1 = await ogTempleToken.balanceOf(account1.address);
  console.info(`amountOGTemple1: ${fromAtto(amountOGTemple1)}`);
  await DEVOTION.lockAndVerify(amountOGTemple1);
  // await devotion.endDevotionRound();
  await faith.gain(account1.address, 25);
  await faith.gain(account2.address, 45);

  //deploy templeZaps contract
  const templeZaps = await new TempleZaps__factory(owner).deploy(
    templeToken.address,
    templeRouter.address
  );

  // Print config required to run dApp
  const contract_address: { [key: string]: string } = {
    EXIT_QUEUE_ADDRESS: exitQueue.address,
    LOCKED_OG_TEMPLE_ADDRESS: lockedOgTemple_old.address,
    LOCKED_OG_TEMPLE_ADDRESS_NEW: lockedOgTemple_new.address,
    STABLE_COIN_ADDRESS: stablecToken.address,
    TEMPLE_ADDRESS: templeToken.address,
    TEMPLE_STAKING_ADDRESS: templeStaking.address,
    TREASURY_ADDRESS: treasury.address,
    TREASURY_MANAGEMENT_ADDRESS: treasuryManagementProxy.address,
    TEMPLE_AMM_OPS_ADDRESS: ammOps.address,
    TEMPLE_CASHBACK_ADDRESS: templeCashback.address,
    TEMPLE_TEAM_FIXED_PAYMENTS_ADDRESS: teamPaymentsFixed.address,
    TEMPLE_TEAM_CONTIGENT_PAYMENTS_ADDRESS: teamPaymentsContigent.address,
    TEMPLE_V2_PAIR_ADDRESS: pair.address,
    TEMPLE_V2_ROUTER_ADDRESS: templeRouter.address,
    TEMPLE_ROUTER_WHITELIST: ammWhitelist.address,
    ACCELERATED_EXIT_QUEUE_ADDRESS: acceleratedExitQueue.address,
    TEMPLE_DEVOTION_ADDRESS: devotion.address,
    TEMPLE_FAITH_ADDRESS: faith.address,
    LOCKED_OG_TEMPLE_DEVOTION_ADDRESS: lockedOgTemple_new.address,
    TEMPLE_ZAPS_ADDRESS: templeZaps.address,

    // TODO: Shouldn't output directly, but rather duplicate for every contract we need a verifier for.
    //       In production, these will always be different keys
    LOCALDEV_VERIFER_EXTERNAL_ADDRESS: verifier.address,
    LOCALDEV_VERIFER_EXTERNAL_PRIVATE_KEY: verifier.privateKey,
  };

  console.log();
  console.log('=========================================');
  console.log('*** Copy/pasta into .env.local for dApp dev\n\n');
  for (const envvar in contract_address) {
    console.log(`VITE_PUBLIC_${envvar}=${contract_address[envvar]}`);
  }

  console.log();
  console.log('=========================================');
  console.log(
    '*** Copy/pasta into terminal to use with scripts like metrics/test-temple interactions etc\n\n'
  );
  for (const envvar in contract_address) {
    console.log(`EXPORT ${envvar}=${contract_address[envvar]}`);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
