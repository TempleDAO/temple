import { ethers } from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai";

import { blockTimestamp, fromAtto, mineNBlocks, shouldThrow, toAtto } from "./helpers";

import { AcceleratedExitQueue, AcceleratedExitQueue__factory, ExitQueue, ExitQueue__factory, OGTemple, OGTemple__factory, TempleERC20Token, TempleERC20Token__factory, TempleStaking, TempleStaking__factory } from "../typechain";
import { exit } from "process";

describe("Accelerated Exit Queue", async () => {
  let templeToken: TempleERC20Token;
  let staking: TempleStaking;
  let exitQueue: ExitQueue;
  let acceleratedExitQueue: AcceleratedExitQueue;
  let ogTempleToken: OGTemple;

  let owner: Signer
  let amanda: Signer
  let ben: Signer
  let clint: Signer
 
  beforeEach(async () => {
    [owner, amanda, ben, clint] = await ethers.getSigners();

    templeToken = await new TempleERC20Token__factory(owner).deploy()

    await templeToken.addMinter(await owner.getAddress());
    await Promise.all([
      templeToken.mint(await amanda.getAddress(), toAtto(10000)),
      templeToken.mint(await ben.getAddress(), toAtto(10000)),
      templeToken.mint(await clint.getAddress(), toAtto(10000)),
    ]);

    exitQueue = await new ExitQueue__factory(owner).deploy(
      templeToken.address,
      toAtto(10), /* max per epoch */
      toAtto(10), /* max per address per epoch */
      5, /* epoch size, in blocks */
    )

    staking = await new TempleStaking__factory(owner).deploy(
      templeToken.address,
      exitQueue.address,
      10, /* epoch size, seconds */
      await blockTimestamp()
    );
    ogTempleToken = new OGTemple__factory(owner).attach(await staking.OG_TEMPLE());

    acceleratedExitQueue = await new AcceleratedExitQueue__factory(owner).deploy(
      templeToken.address,
      exitQueue.address,
      staking.address
    );

    await exitQueue.transferOwnership(acceleratedExitQueue.address);

    await Promise.all([
      templeToken.connect(amanda).increaseAllowance(exitQueue.address, toAtto(1000)),
      templeToken.connect(ben).increaseAllowance(exitQueue.address, toAtto(1000)),
      templeToken.connect(clint).increaseAllowance(exitQueue.address, toAtto(1000)),
    ]);
  })

  it("Only owner can change settings", async () => {
    // Should work as owner
    await acceleratedExitQueue.setEpochSize(20);
    expect(await exitQueue.epochSize()).eq(20);

    await acceleratedExitQueue.setMaxPerAddress(10);
    expect(await exitQueue.maxPerAddress()).eq(10);

    await acceleratedExitQueue.setEpochSize(20);
    expect(await exitQueue.epochSize()).eq(20);

    const benAddress = await ben.getAddress();
    await acceleratedExitQueue.setOwedTemple([benAddress], [10]);
    expect(await exitQueue.owedTemple(benAddress)).eq(10);

    await acceleratedExitQueue.setAccelerationPolicy(1,1,0);
    expect(await acceleratedExitQueue.epochAccelerationFactorNumerator()).eq(1);
    expect(await acceleratedExitQueue.epochAccelerationFactorDenominator()).eq(1);
    expect(await acceleratedExitQueue.accelerationStartAtEpoch()).eq(0);

    // Should fail as anyone else
    const nonOwner = acceleratedExitQueue.connect(amanda);
    await shouldThrow(nonOwner.setEpochSize(20), /Ownable: caller is not the owner/);
    await shouldThrow(nonOwner.setMaxPerAddress(10), /Ownable: caller is not the owner/);
    await shouldThrow(nonOwner.setEpochSize(20), /Ownable: caller is not the owner/);
    await shouldThrow(nonOwner.setOwedTemple([benAddress], [10]), /Ownable: caller is not the owner/);
    await shouldThrow(nonOwner.setAccelerationPolicy(1,1,0), /Ownable: caller is not the owner/);
  });

  it("Correctly calculates EPOCHS when acceleration is turned off", async () => {
    const currentEpoch = (await exitQueue.currentEpoch()).toNumber();
    expect(await acceleratedExitQueue.currentEpoch()).eq(currentEpoch);
    await mineNBlocks((await exitQueue.epochSize()).toNumber());
    expect(await acceleratedExitQueue.currentEpoch()).eq(currentEpoch + 1);
  });

  it("Correctly calculates EPOCHS when acceleration is turned on", async () => {
    const currentEpoch = (await exitQueue.currentEpoch()).toNumber();
    expect(await acceleratedExitQueue.currentEpoch()).eq(currentEpoch);
    await mineNBlocks((await exitQueue.epochSize()).toNumber());
    expect(await acceleratedExitQueue.currentEpoch()).eq(currentEpoch + 1);
  });

  it('Can Restake after joining the exit queue', async () => {
    // amanda joins exit queue
    await exitQueue.connect(amanda).join(await amanda.getAddress(), toAtto(100));

    // amanda realises she'd rather stay staked than exit
    let templeBalanceBefore = await staking.balance(await ogTempleToken.balanceOf(await amanda.getAddress()));
    await acceleratedExitQueue.connect(amanda).restake([7,8,9], 3);
    expect(await staking.balance(await ogTempleToken.balanceOf(await amanda.getAddress()))).to.eq(templeBalanceBefore.add(toAtto(30)));
  });

  it('Can only restake temple owned by user', async () => {
    // amanda joins exit queue
    await exitQueue.connect(amanda).join(await amanda.getAddress(), toAtto(100));

    // ben tries to restake amanda's temple, gets error
    await shouldThrow(acceleratedExitQueue.connect(ben).restake([7,8,9], 3), /Cannot stake 0 token/);
  });

  it('Accelerated exit tests', async () => {
    // amanda and ben both joins exit queue
    await exitQueue.connect(amanda).join(await amanda.getAddress(), toAtto(30));
    await exitQueue.connect(ben).join(await ben.getAddress(), toAtto(30));

    // ben can't unstake, as his epochs haven't passed yet.
    const benExitState = await exitQueue.userData(await ben.getAddress());
    expect(benExitState.FirstExitEpoch.toNumber()).gt((await acceleratedExitQueue.currentEpoch()).toNumber());
    const benExitEpochs = [];
    for (let i = benExitState.FirstExitEpoch.toNumber(); i < benExitState.LastExitEpoch.toNumber()+1; i++) {
     benExitEpochs.push(i);
    }

    await shouldThrow(acceleratedExitQueue.connect(ben).withdrawEpochs(benExitEpochs, 3), /Can only withdraw from processed epochs/);

    // However, if we start accelerating the queue, ben can unstake
    const currentEpoch = (await exitQueue.currentEpoch()).toNumber();
    await acceleratedExitQueue.setAccelerationPolicy(2,1, currentEpoch);

    // mine to what would be ben's first exitable epoch, he should be able to exit
    // everything based on the acceleration factor
    await mineNBlocks((await exitQueue.epochSize()).toNumber() * (benExitState.FirstExitEpoch.toNumber() - currentEpoch));
    await shouldThrow(exitQueue.connect(ben).withdrawEpochs(benExitEpochs, 3), /Can only withdraw from past epochs/);
    await acceleratedExitQueue.connect(ben).withdrawEpochs(benExitEpochs, 3);
  });

  it('disable accelerated exit queue', async () => {
    // transfers ownership to owner of the exit queue marketplace
    expect(await exitQueue.owner()).to.eq(acceleratedExitQueue.address);
    await acceleratedExitQueue.disableAcceleratedExitQueue();
    expect(await exitQueue.owner()).to.eq(await acceleratedExitQueue.owner());
  });
});
