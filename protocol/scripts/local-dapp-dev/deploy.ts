import '@nomiclabs/hardhat-ethers';
import { BigNumber, ContractTransaction } from 'ethers';
import { ethers } from 'hardhat';
import { blockTimestamp, mineNBlocks } from '../../test/helpers';
import {
  ExitQueue__factory,
  Faith__factory,
  FakeERC20__factory,
  OGTemple__factory,
  TempleERC20Token__factory,
  TempleFraxAMMOps__factory,
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
  TempleStableAMMRouter__factory,
  VaultProxy__factory,
  InstantExitQueue__factory,
  Relic__factory,
  RelicItems__factory,
} from '../../typechain';
import { writeFile } from 'fs/promises';

function toAtto(n: number) {
  return BigNumber.from(10).pow(18).mul(n);
}

function fromAtto(n: BigNumber) {
  return n.div(BigNumber.from(10).pow(18)).toNumber();
}

async function extractDeployedAddress(
  tx: ContractTransaction,
  eventName: string
): Promise<string> {
  let result = 'FAILED TO FIND';
  await tx.wait(0).then((receipt) => {
    let event = receipt.events?.filter((evt) => {
      if (evt.event) {
        return evt.event === eventName;
      }
    })[0];

    if (event?.args) {
      result = event.args[0];
    }
  });

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

  const frax = await new FakeERC20__factory(owner).deploy('FRAX', 'FRAX');
  const fei = await new FakeERC20__factory(owner).deploy('FEI', 'FEI');

  const treasury = await new TempleTreasury__factory(owner).deploy(
    templeToken.address,
    frax.address
  );
  await templeToken.addMinter(treasury.address);

  const lockedOgTemple_old = await new LockedOGTempleDeprecated__factory(
    owner
  ).deploy(ogTempleToken.address);

  const accounts = await ethers.getSigners();

  // mint some frax and frei into all test accounts
  for (const account of accounts) {
    const address = await account.getAddress();
    await frax.mint(address, toAtto(15000));
    await fei.mint(address, toAtto(15000));
  }

  // Seed mint to bootstrap treasury
  await frax.increaseAllowance(treasury.address, 100);
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

  // Create team payment contracts
  const teamPaymentsFixedR1 = await new TempleTeamPayments__factory(
    owner
  ).deploy(templeToken.address, 1, 1);
  await templeToken.mint(teamPaymentsFixedR1.address, toAtto(1000000));

  await teamPaymentsFixedR1.setAllocation(owner.address, toAtto(1000));
  const teamPaymentsFixedR2 = await new TempleTeamPayments__factory(
    owner
  ).deploy(templeToken.address, 1, 1);
  await templeToken.mint(teamPaymentsFixedR2.address, toAtto(1000000));

  await teamPaymentsFixedR2.setAllocation(owner.address, toAtto(1000));

  const teamPaymentsFixedR3 = await new TempleTeamPayments__factory(
    owner
  ).deploy(templeToken.address, 1, 1);
  await templeToken.mint(teamPaymentsFixedR3.address, toAtto(1000000));

  await teamPaymentsFixedR3.setAllocation(owner.address, toAtto(1000));

  const teamPaymentsFixedR4 = await new TempleTeamPayments__factory(
    owner
  ).deploy(templeToken.address, 1, 1);
  await templeToken.mint(teamPaymentsFixedR4.address, toAtto(1000000));

  await teamPaymentsFixedR4.setAllocation(owner.address, toAtto(1000));

  // Setup custom AMM with liquidity
  const pair = await new TempleUniswapV2Pair__factory(owner).deploy(
    await owner.getAddress(),
    templeToken.address,
    frax.address
  );

  const feiPair = await new TempleUniswapV2Pair__factory(owner).deploy(
    await owner.getAddress(),
    templeToken.address,
    fei.address
  );

  const templeRouter = await new TempleStableAMMRouter__factory(owner).deploy(
    templeToken.address,
    treasury.address,
    fei.address
  );

  await templeRouter.addPair(frax.address, pair.address);
  await templeRouter.addPair(fei.address, feiPair.address);

  // Contract where we send frax earned by treasury
  const ammOps = await new TempleFraxAMMOps__factory(owner).deploy(
    templeToken.address,
    templeRouter.address,
    treasury.address /* XXX: Unuse */,
    frax.address,
    treasury.address,
    pair.address
  );

  await pair.setRouter(templeRouter.address);
  await feiPair.setRouter(templeRouter.address);

  await templeToken.mint(owner.address, toAtto(10000000));
  await frax.mint(owner.address, toAtto(10000000));
  await fei.mint(owner.address, toAtto(10000000));
  await templeToken.increaseAllowance(templeRouter.address, toAtto(10000000));
  await frax.increaseAllowance(templeRouter.address, toAtto(10000000));
  await fei.increaseAllowance(templeRouter.address, toAtto(10000000));
  await templeRouter.addLiquidity(
    toAtto(100000),
    toAtto(1000000),
    1,
    1,
    frax.address,
    await owner.getAddress(),
    (await blockTimestamp()) + 900
  );
  await templeRouter.addLiquidity(
    toAtto(100000),
    toAtto(1000000),
    1,
    1,
    fei.address,
    await owner.getAddress(),
    (await blockTimestamp()) + 900
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
  await faith.addManager(await owner.getAddress());

  console.log('ACCOUNT 1 ADDRESS => ', await account1.getAddress(), '\n\n\n\n');
  await faith.gain(await account1.getAddress(), toAtto(10000));
  await faith.gain(await account2.getAddress(), toAtto(5000));

  // add liquidity to AMM
  const expiryDate = (): number => Math.floor(Date.now() / 1000) + 900;
  await templeToken.increaseAllowance(
    templeRouter.address,
    toAtto(10000000000)
  );
  await frax.increaseAllowance(templeRouter.address, toAtto(10000000000));

  // create and initialise contract that allows a permissionless
  // swap @ IV
  const templeIVSwap = await new TempleIVSwap__factory(owner).deploy(
    templeToken.address,
    frax.address,
    { temple: 100, frax: 65 } /* iv */
  );
  await frax.mint(templeIVSwap.address, toAtto(1000000));

  const joiningFee = await new JoiningFee__factory(owner).deploy(
    100000000000000
  );

  const opsManagerLib = await (await ethers.getContractFactory('OpsManagerLib'))
    .connect(owner)
    .deploy();
  const opsManager = await new OpsManager__factory(
    { 'contracts/core/OpsManagerLib.sol:OpsManagerLib': opsManagerLib.address },
    owner
  ).deploy(templeToken.address, joiningFee.address);

  const vaultedTempleAddr = await opsManager.vaultedTemple();

  const THIRTY_MINUTES = 30 * 60;
  const FIVE_MINUTES = 5 * 60;

  const period = Number(process.env.E2E_TEST_DEPLOY_PERIOD) || THIRTY_MINUTES;
  const window = Number(process.env.E2E_TEST_DEPLOY_WINDOW) || FIVE_MINUTES;

  console.log(`Using vault period ${period} and entry window ${window}`);

  const numberOfSubVaults = period / window;
  if (period % window)
    throw new Error('Vault period should divide perfectly by vault window');

  for (let i = 0; i < numberOfSubVaults; i++) {
    const vaultTx = await opsManager.createVaultInstance(
      'temple-1m-vault',
      'TPL-1M-V1',
      period,
      window,
      { p: 1, q: 1 },
      Math.floor(Date.now() / 1000) + i * window
    );

    let vault = await extractDeployedAddress(vaultTx, 'CreateVaultInstance');
    console.log(vault);
  }

  const vaultProxy = await new VaultProxy__factory(owner).deploy(
    ogTempleToken.address,
    templeToken.address,
    templeStaking.address,
    faith.address
  );
  await templeToken.mint(vaultProxy.address, toAtto(1000000));

  await faith.addManager(vaultProxy.address);

  const instantExitQueue = await new InstantExitQueue__factory(owner).deploy(
    templeStaking.address,
    templeToken.address
  );

  await templeStaking.setExitQueue(instantExitQueue.address);

  const relic = await new Relic__factory(owner).deploy()
  const relicItems = await new RelicItems__factory(owner).deploy()
  await relic.setItemContract(relicItems.address)
  await relicItems.setRelic(relic.address)
  
  // Print config required to run dApp
  const contract_address: { [key: string]: string } = {
    EXIT_QUEUE_ADDRESS: exitQueue.address,
    LOCKED_OG_TEMPLE_ADDRESS: lockedOgTemple_old.address,
    STABLE_COIN_ADDRESS: frax.address,
    FEI_ADDRESS: fei.address,
    TEMPLE_ADDRESS: templeToken.address,
    TEMPLE_STAKING_ADDRESS: templeStaking.address,
    TREASURY_ADDRESS: treasury.address,
    TEMPLE_AMM_OPS_ADDRESS: ammOps.address,
    TEMPLE_R1_TEAM_FIXED_PAYMENTS_ADDRESS: teamPaymentsFixedR1.address,
    TEMPLE_R2_TEAM_FIXED_PAYMENTS_ADDRESS: teamPaymentsFixedR2.address,
    TEMPLE_R3_TEAM_FIXED_PAYMENTS_ADDRESS: teamPaymentsFixedR3.address,
    TEMPLE_R4_TEAM_FIXED_PAYMENTS_ADDRESS: teamPaymentsFixedR4.address,
    TEMPLE_V2_PAIR_ADDRESS: pair.address,
    TEMPLE_V2_FEI_PAIR_ADDRESS: feiPair.address,
    TEMPLE_V2_ROUTER_ADDRESS: templeRouter.address,
    TEMPLE_ROUTER_WHITELIST: 'removed',
    ACCELERATED_EXIT_QUEUE_ADDRESS: acceleratedExitQueue.address,
    INSTANT_EXIT_QUEUE_ADDRESS: instantExitQueue.address,
    TEMPLE_FAITH_ADDRESS: faith.address,

    TEMPLE_IV_SWAP: templeIVSwap.address,
    TEMPLE_VAULT_OPS_MANAGER: opsManager.address,
    TEMPLE_VAULTED_TEMPLE: vaultedTempleAddr,
    TEMPLE_VAULT_PROXY: vaultProxy.address,
    // TEMPLE_VAULT_1_M_1: vault1,
    // TEMPLE_VAULT_1_M_2: vault2,
    // TEMPLE_VAULT_1_M_3: vault3,
    // TEMPLE_VAULT_1_M_4: vault4,

    // TODO: Shouldn't output directly, but rather duplicate for every contract we need a verifier for.
    //       In production, these will always be different keys
    LOCALDEV_VERIFER_EXTERNAL_ADDRESS: verifier.address,
    LOCALDEV_VERIFER_EXTERNAL_PRIVATE_KEY: verifier.privateKey,

    TEMPLE_RELIC_ADDRESS: relic.address,
    TEMPLE_RELIC_ITEMS_ADDRESS: relicItems.address,
  };

  await writeFile('../shared/stack/deployed-addr.txt', '');

  let newVarsToWrite = '';
  console.log();
  console.log('=========================================');
  console.log('*** Copy/pasta into .env.local for dApp dev\n\n');
  for (const envvar in contract_address) {
    let line = `VITE_PUBLIC_${envvar}=${contract_address[envvar]}`;

    console.log(line);
    newVarsToWrite += line + `\n`;
  }

  await writeFile('../shared/stack/deployed-addr.txt', newVarsToWrite);

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
