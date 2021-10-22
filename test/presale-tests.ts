import { ethers } from "hardhat";
import { BigNumber, Signer } from "ethers";
import { expect } from "chai";

import { TempleERC20Token } from "../typechain/TempleERC20Token";
import { FakeERC20 } from "../typechain/FakeERC20";
import { TempleTreasury } from "../typechain/TempleTreasury";
import { TempleStaking } from "../typechain/TempleStaking";
import { blockTimestamp, fromAtto, mineToEpoch, shouldThrow, toAtto } from "./helpers";
import { ExitQueue } from "../typechain/ExitQueue";
import { TempleERC20Token__factory } from "../typechain/factories/TempleERC20Token__factory";
import { ExitQueue__factory } from "../typechain/factories/ExitQueue__factory";
import { TempleStaking__factory } from "../typechain/factories/TempleStaking__factory";
import { FakeERC20__factory } from "../typechain/factories/FakeERC20__factory";
import { TempleTreasury__factory } from "../typechain/factories/TempleTreasury__factory";
import { Presale__factory } from "../typechain/factories/Presale__factory";
import { Presale } from "../typechain/Presale";
import { LockedOGTemple } from "../typechain/LockedOGTemple";
import { PresaleAllocation } from "../typechain/PresaleAllocation";
import { PresaleAllocation__factory } from "../typechain/factories/PresaleAllocation__factory";
import { LockedOGTemple__factory } from "../typechain/factories/LockedOGTemple__factory";

xdescribe("Test mint and stake investment contract (used in genesis and staking campaigns)", async () => {
   let STABLCEC: FakeERC20;
   let TREASURY: TempleTreasury;
   let TEMPLE: TempleERC20Token;
   let EXIT_QUEUE: ExitQueue
   let STAKING: TempleStaking;
   let STAKING_LOCK: LockedOGTemple;
   let PRESALE: Presale;
   let PRESALE_ALLOCATION: PresaleAllocation;
   let owner: Signer;
   let stakers: Signer[];
   const EPOCH_SIZE = 600;

   beforeEach(async () => {
    [owner] = (await ethers.getSigners()) as Signer[];

    STABLCEC = await new FakeERC20__factory(owner).deploy("STABLCEC", "STABLCEC");
    TEMPLE = await new TempleERC20Token__factory(owner).deploy()
    
    TREASURY = await new TempleTreasury__factory(owner).deploy(
        TEMPLE.address,
        STABLCEC.address,
    );

    EXIT_QUEUE = await new ExitQueue__factory(owner).deploy(
      TEMPLE.address,
      200, /* max per epoch */
      100, /* max per address per epoch */
      EPOCH_SIZE,
    )
     
    STAKING = await new TempleStaking__factory(owner).deploy(
      TEMPLE.address,
      EXIT_QUEUE.address,
      EPOCH_SIZE,
      (await blockTimestamp()) - 1,
    );
    await STAKING.setEpy(0,100);

    STAKING_LOCK = await new LockedOGTemple__factory(owner).deploy(await STAKING.OG_TEMPLE());

    PRESALE_ALLOCATION = await new PresaleAllocation__factory(owner).deploy();

    PRESALE = await new Presale__factory(owner).deploy(
       STABLCEC.address,
       TEMPLE.address,
       STAKING.address,
       STAKING_LOCK.address,
       TREASURY.address,
       PRESALE_ALLOCATION.address,
       2, /* mint multiple */
       (await blockTimestamp()) + 60, /* start of unlock season */
    )

    await TEMPLE.addMinter(TREASURY.address);
    await TEMPLE.addMinter(PRESALE.address);

    stakers = (await ethers.getSigners()).slice(1, 5);

    for (const s of stakers) {
      await STABLCEC.mint(await s.getAddress(), toAtto(1000000))
      await STABLCEC.connect(s).increaseAllowance(PRESALE.address, toAtto(1000000))
    }

    await Promise.all([
      STABLCEC.mint(await owner.getAddress(), toAtto(100000)),
      STABLCEC.connect(owner).increaseAllowance(TREASURY.address, toAtto(100000)),
    ]);

    await TREASURY.seedMint(1,100);
  })

  it("Only owner can pause/unpause", async () => {
    // only owner can pause
    await shouldThrow(PRESALE.connect(stakers[0]).pause(), /Ownable:/);
    await PRESALE.pause();

    // Mint and stake should be disabled when contract is paused
    await shouldThrow(PRESALE.connect(stakers[0]).mintAndStake(10), /Pausable:/);
    await shouldThrow(PRESALE.mintAndStake(10), /Pausable:/);

    // Only owner can unpause
    await shouldThrow(PRESALE.connect(stakers[0]).unpause(), /Ownable:/);
    await PRESALE.unpause();

    await PRESALE_ALLOCATION.setAllocation(await stakers[0].getAddress(), 10, 0);
    await PRESALE.connect(stakers[0]).mintAndStake(10);
  });

  it("Happy path presale flow", async () => {
    // Give each staker an increasing allowance, starting at 10, and epoch 0
    for (let i = 0; i < stakers.length; i++) {
      const s = stakers[i];

      await PRESALE_ALLOCATION.setAllocation(await s.getAddress(), toAtto((i+1) * 10), i+1);
    }

    // Each staker to spend 10 STABLCEC (apart from last in our list)
    for (let i = 0; i < stakers.length; i++) {
      if (i !== 0) {
        await PRESALE.connect(stakers[i-1]).mintAndStake(toAtto(10));
        expect(fromAtto((await STAKING_LOCK.locked(await stakers[i-1].getAddress(), 0)).BalanceOGTemple)).eq(500);
      }

      // Shouldn't be able to stake, if the user's allocation epoch hasn't arrived
      const s = stakers[i];
      await shouldThrow(PRESALE.connect(s).mintAndStake(toAtto(10)), /User's allocated epoch is in the future/);
      await mineToEpoch((await STAKING.startTimestamp()).toNumber(), EPOCH_SIZE, i+1);
    }
    // 10 STABLCEC mint and stake for the last staker in the array as well
    await PRESALE.connect(stakers[stakers.length-1]).mintAndStake(toAtto(10));
    expect(fromAtto((await STAKING_LOCK.locked(await stakers[stakers.length-1].getAddress(), 0)).BalanceOGTemple)).eq(500);

    // Each staker to stake the balance they have remaining
    for (let i = 0; i < stakers.length; i++) {
       const s = stakers[i];
       const totalAllocation = fromAtto((await PRESALE_ALLOCATION.allocationOf(await s.getAddress())).amount);
       const allocationRemaining = totalAllocation - fromAtto((await PRESALE.allocationUsed(await s.getAddress())))
         
      let totalLocked = fromAtto((await STAKING_LOCK.locked(await s.getAddress(), 0)).BalanceOGTemple)
      if (allocationRemaining > 0) {
        await PRESALE.connect(s).mintAndStake(toAtto(allocationRemaining));
        totalLocked += fromAtto((await STAKING_LOCK.locked(await s.getAddress(), 1)).BalanceOGTemple)
      }
      expect(totalLocked).eq(totalAllocation * 50);
    }
  });

  it("Single large mint and stake", async () => {
    // Give each staker an increasing allowance, starting at 10, and epoch 0
    const [s] = stakers;
    await STABLCEC.connect(s).approve(PRESALE.address, toAtto(100000))
    await PRESALE_ALLOCATION.setAllocation(await s.getAddress(), toAtto(100000), 0);
    await PRESALE.connect(s).mintAndStake(toAtto(100000));
  });
});