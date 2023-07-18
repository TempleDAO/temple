import '@nomiclabs/hardhat-ethers';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import {
  ExitQueue__factory,
  FakeERC20__factory, Presale__factory,
  TempleERC20Token__factory,
  TempleStaking__factory,
  TempleTreasury__factory
} from '../typechain';
import { zeroAddress } from 'ethereumjs-util';

function toAtto(n: number) {
  return BigNumber.from(10).pow(18).mul(n);
}

function fromAtto(n: BigNumber) {
  return n.div(BigNumber.from(10).pow(18)).toNumber();
}

async function main() {
  const [owner] = await ethers.getSigners();

  const TEMPLE = await new TempleERC20Token__factory(owner).deploy()
  const EXIT_QUEUE = await new ExitQueue__factory(owner).deploy(
    TEMPLE.address,
    toAtto(10000), /* max per epoch */
    toAtto(1000), /* max per address per epoch */
    10, /* epoch size, in blocks */
  )

  const STAKING = await new TempleStaking__factory(owner).deploy(
    TEMPLE.address,
    EXIT_QUEUE.address,
    10, /* epoch size, in blocks */
  );
  await STAKING.setStartingBlock(await EXIT_QUEUE.firstBlock());
  await STAKING.setEpy(100,1000);

  const DAI = await new FakeERC20__factory(owner).deploy("DAI", "DAI", zeroAddress(), 0);
  const TREASURY = await new TempleTreasury__factory(owner).deploy(
        TEMPLE.address,
        DAI.address,
  );
  await TEMPLE.addMinter(TREASURY.address);

  const PRESALE = await new Presale__factory(owner).deploy(
    DAI.address,
    TEMPLE.address,
    STAKING.address,
    TREASURY.address,
    2,
    10, /* lock in period */
  )

  // mint fake DAI into all test accounts
  const accounts = await ethers.getSigners();

  // mint some DAI into all test accounts
  for (const account of accounts) {
    const address = await account.getAddress();
    await DAI.mint(address, toAtto(100000));
  }

  // Seed mint to bootstrap treasury
  await DAI.increaseAllowance(TREASURY.address, 100);
  await TREASURY.seedMint(100,1000);

  // Add both Mint and Stake and TempleStake as strategies
  // NOTE: Currently we just mint temple into each, the later should be done as a strategy
  await TREASURY.addPool(PRESALE.address, 0, toAtto(10000000), 0)
  await TREASURY.addPool(STAKING.address, 0, toAtto(10000000), 0)

  // Add an allowance for each account to join mint and stake
  for (const account of accounts) {
    await PRESALE.increaseAddressAllocation(await account.getAddress(), toAtto(100000))
  }

  // Print config required to run dApp
  const contract_address: { [key: string]: string; } = {
    'DAI_ADDRESS': DAI.address,
    'TEMPLE_ADDRESS': TEMPLE.address,
    'TEMPLE_STAKING_ADDRESS': STAKING.address,
    'MINT_AND_STAKE_ADDRESS': PRESALE.address,
    'TREASURY_ADDRESS': TREASURY.address,
    'EXIT_QUEUE_ADDRESS': EXIT_QUEUE.address,
  }

  console.log('Replicating fidels bug, running mint and stake twice');
  const [_, staker] = await ethers.getSigners();
  await (await TEMPLE.addMinter(owner.address)).wait();
  await (await TEMPLE.mint(staker.address, toAtto(10000))).wait();

  for (let i = 0; i < 5; i++) {
    console.log(`iteration: ${i}`);
    //await (await DAI.connect(staker).approve(PRESALE.address, toAtto(10))).wait();
    //await (await PRESALE.connect(staker).mintAndStake(toAtto(10))).wait();

    const amount = toAtto(10)

    await (await DAI.connect(staker).increaseAllowance(PRESALE.address, amount)).wait();
    await (await PRESALE.connect(staker).mintAndStake(amount)).wait();

    // await (await STAKING.connect(staker).stakeWithLockIn(staker.address, amount, 10)).wait();
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
