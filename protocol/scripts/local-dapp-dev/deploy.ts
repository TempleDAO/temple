import '@nomiclabs/hardhat-ethers';
import { BigNumber, ContractTransaction } from 'ethers';
import { ethers } from 'hardhat';
import { blockTimestamp, mineNBlocks } from '../../test/helpers';
import {
  AMMWhitelist__factory,
  ExitQueue__factory,
  Faith__factory,
  FakeERC20__factory,
  OGTemple__factory,
  TempleERC20Token__factory,
  TempleFraxAMMOps__factory,
  TempleFraxAMMRouter__factory,
  TempleStaking__factory,
  TempleTeamPayments__factory,
  LockedOGTempleDeprecated__factory,
  TempleTreasury__factory,
  TempleUniswapV2Pair__factory,
  AcceleratedExitQueue,
  AcceleratedExitQueue__factory,
  TempleIVSwap__factory,
  JoiningFee__factory,
  OpsManager__factory,
} from '../../typechain';
import { writeFile } from 'fs/promises';

function toAtto(n: number) {
  return BigNumber.from(10).pow(18).mul(n);
}

function fromAtto(n: BigNumber) {
  return n.div(BigNumber.from(10).pow(18)).toNumber();
}

async function extractDeployedAddress(tx: ContractTransaction, eventName: string) : Promise<string> {
  let result = 'FAILED TO FIND';
  await tx.wait(0).then(receipt => {
    let event = receipt.events?.filter(evt => {
      if (evt.event) {
        return evt.event === eventName
      };
    })[0];

    if (event?.args) {
      result = event.args[0]
    }
  })

  return result;
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

  const verifier = ethers.Wallet.createRandom();

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
    treasury.address, /* XXX: Unuse */
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

  // acceleated exit queue
  const acceleratedExitQueue: AcceleratedExitQueue =
    await new AcceleratedExitQueue__factory(owner).deploy(
      templeToken.address,
      exitQueue.address,
      templeStaking.address
    );
  await exitQueue.transferOwnership(acceleratedExitQueue.address);

  // Devotion
  const faith = await new Faith__factory(owner).deploy();

  // add liquidity to AMM
  const expiryDate = (): number => Math.floor(Date.now() / 1000) + 900;
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

  // create and initialise contract that allows a permissionless
  // swap @ IV
  const templeIVSwap = await new TempleIVSwap__factory(owner).deploy(
    templeToken.address,
    stablecToken.address,
    {temple: 100, frax: 65}, /* iv */
  );
  await stablecToken.mint(templeIVSwap.address, toAtto(1000000));

  const joiningFee = await new JoiningFee__factory(owner).deploy(
    100000000000000,
  );

  const opsManagerLib = await (await ethers.getContractFactory("OpsManagerLib")).connect(owner).deploy();
  const opsManager = await new OpsManager__factory({ "contracts/core/OpsManagerLib.sol:OpsManagerLib" : opsManagerLib.address }, owner).deploy(
    templeToken.address,
    joiningFee.address
  );

  const exposureTx = await opsManager.createExposure(
    "Stable Exposure",
    "STBCXP",
    stablecToken.address
  );

  let exposure = await extractDeployedAddress(exposureTx, 'CreateExposure');


  const oneDay = 60 * 60 * 24;
  const period = oneDay * 30;
  const window = oneDay * 10
  const numberOfSubVaults = period / window
  if (period % window) throw new Error('Vault period should divide perfectly by vault window')

  for (let i = 0; i < numberOfSubVaults; i++) {
    const vaultTx = await opsManager.createVaultInstance(
      "temple-1m-vault",
      "TPL-1M-V1",
      period,
      window,
      { p: 1, q : 1},
      Math.floor(Date.now() / 1000) + i * window
    );

    let vault = await extractDeployedAddress(vaultTx, 'createVaultInstance');

    await ethers.provider.send('evm_increaseTime', [window]);
  }

  // Print config required to run dApp
  const contract_address: { [key: string]: string } = {
    EXIT_QUEUE_ADDRESS: exitQueue.address,
    LOCKED_OG_TEMPLE_ADDRESS: lockedOgTemple_old.address,
    STABLE_COIN_ADDRESS: stablecToken.address,
    TEMPLE_ADDRESS: templeToken.address,
    TEMPLE_STAKING_ADDRESS: templeStaking.address,
    TREASURY_ADDRESS: treasury.address,
    TEMPLE_AMM_OPS_ADDRESS: ammOps.address,
    TEMPLE_TEAM_FIXED_PAYMENTS_ADDRESS: teamPaymentsFixed.address,
    TEMPLE_TEAM_CONTIGENT_PAYMENTS_ADDRESS: teamPaymentsContigent.address,
    TEMPLE_V2_PAIR_ADDRESS: pair.address,
    TEMPLE_V2_ROUTER_ADDRESS: templeRouter.address,
    TEMPLE_ROUTER_WHITELIST: ammWhitelist.address,
    ACCELERATED_EXIT_QUEUE_ADDRESS: acceleratedExitQueue.address,

    TEMPLE_IV_SWAP: templeIVSwap.address,
    TEMPLE_VAULT_OPS_MANAGER: opsManager.address,
    TEMPLE_VAULT_STABLEC_EXPOSURE: exposure,
    // TEMPLE_VAULT_1_M_1: vault1,
    // TEMPLE_VAULT_1_M_2: vault2,
    // TEMPLE_VAULT_1_M_3: vault3,
    // TEMPLE_VAULT_1_M_4: vault4,

    // TODO: Shouldn't output directly, but rather duplicate for every contract we need a verifier for.
    //       In production, these will always be different keys
    LOCALDEV_VERIFER_EXTERNAL_ADDRESS: verifier.address,
    LOCALDEV_VERIFER_EXTERNAL_PRIVATE_KEY: verifier.privateKey,
  };

  await writeFile('../shared/stack/deployed-addr.txt', '')

  let newVarsToWrite = ''
  console.log();
  console.log('=========================================');
  console.log('*** Copy/pasta into .env.local for dApp dev\n\n');
  for (const envvar in contract_address) {
    let line = `VITE_PUBLIC_${envvar}=${contract_address[envvar]}`

    console.log(line);
    newVarsToWrite += line + `\n`
  }

  await writeFile('../shared/stack/deployed-addr.txt', newVarsToWrite)

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
