import { ethers } from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai";

import { TempleERC20Token } from "../typechain/TempleERC20Token";
import { LPTokenStaking } from "../typechain/LPTokenStaking";
import { LPTokenStaking__factory } from "../typechain/factories/LPTokenStaking__factory";
import { blockTimestamp, mineNBlocks, shouldThrow } from "./helpers";
import { ExitQueue } from "../typechain/ExitQueue";
import { TempleERC20Token__factory } from "../typechain/factories/TempleERC20Token__factory";
import { ExitQueue__factory } from "../typechain/factories/ExitQueue__factory";
import { FakeERC20__factory } from "../typechain/factories/FakeERC20__factory";
import { FakeERC20 } from "../typechain/FakeERC20";
import { TempleStaking } from "../typechain/TempleStaking";
import { TempleStaking__factory } from "../typechain/factories/TempleStaking__factory";

describe("LP Staking", async () => {
  let LP_TOKEN: FakeERC20;
  let LP_STAKING: LPTokenStaking;
  let STAKING: TempleStaking;
  let TEMPLE: TempleERC20Token;
  let EXIT_QUEUE: ExitQueue;
  let owner: Signer
  let staker_amanda: Signer
  let staker_ben: Signer
 
  beforeEach(async () => {
    [owner, staker_amanda, staker_ben] = await ethers.getSigners();

    TEMPLE = await new TempleERC20Token__factory(owner).deploy()
    EXIT_QUEUE = await new ExitQueue__factory(owner).deploy(
      TEMPLE.address,
      200, /* max per epoch */
      100, /* max per address per epoch */
      5, /* epoch size, in blocks */
    )

    STAKING = await new TempleStaking__factory(owner).deploy(
      TEMPLE.address,
      EXIT_QUEUE.address,
      5, /* epoch size, in seconds */
      (await blockTimestamp()) - 1,
    );
     
    // await STAKING.setStartingBlock(await EXIT_QUEUE.firstBlock());
    await STAKING.setEpy(10,100);

    LP_TOKEN = await new FakeERC20__factory(owner).deploy(
      "TEMPLE_DAI_LP",
      "TEMPLE_DAI_LP"
    );

    LP_STAKING = await new LPTokenStaking__factory(owner).deploy(
      LP_TOKEN.address,
      TEMPLE.address,
      STAKING.address,
      100,
    );

    await TEMPLE.addMinter(await owner.getAddress());
    await Promise.all([
      TEMPLE.mint(LP_STAKING.address, 10000), // simulated harvest for reward balance 
      LP_TOKEN.mint(await staker_amanda.getAddress(), 1000),
      LP_TOKEN.mint(await staker_ben.getAddress(), 1000),
      LP_TOKEN.mint(await owner.getAddress(), 1000),
      LP_TOKEN.connect(staker_amanda).increaseAllowance(LP_STAKING.address, 1000),
      LP_TOKEN.connect(staker_ben).increaseAllowance(LP_STAKING.address, 1000),
      LP_TOKEN.increaseAllowance(LP_STAKING.address, 1000),
    ]);
   })

  it("Only owner can update rewards rate", async () => {
    // owner can pause/unpause
    await LP_STAKING.setRewardPerBlock(200)
    expect(await LP_STAKING.rewardPerBlock()).eq(200);
    await shouldThrow(LP_STAKING.connect(staker_amanda).setRewardPerBlock(1), /Ownable: caller is not the owner/);
  });

  it("staking records are correctly calculated", async () => {
    await LP_STAKING.connect(staker_amanda).stake(100);

    for (let i = 0; i < 5; i++) {
      expect(await LP_STAKING.pendingRewards(await staker_amanda.getAddress())).eq(i * 100);
      await mineNBlocks(1);
    }

    // second staker should accumulate less rewards, and the rewards ber block shoud
    // drop for both stakers.
    await LP_STAKING.connect(staker_ben).stake(100);
    const amandaRewardsPreBenStake =  (await LP_STAKING.pendingRewards(await staker_amanda.getAddress())).toNumber();
    for (let i = 0; i < 5; i++) {
       expect(await LP_STAKING.pendingRewards(await staker_ben.getAddress())).eq(i * 50);
       expect(await LP_STAKING.pendingRewards(await staker_amanda.getAddress())).eq(amandaRewardsPreBenStake + (i * 50));
       await mineNBlocks(1);
    }

    // A Third staker would again change the rewards per staker per block, while
    // maintaining any past rewards
    // drop for both stakers.
    await LP_STAKING.stake(50);
    const amandaRewardsPreOwnerStake =  (await LP_STAKING.pendingRewards(await staker_amanda.getAddress())).toNumber();
    const benRewardsPreOwnerStake =  (await LP_STAKING.pendingRewards(await staker_ben.getAddress())).toNumber();
    for (let i = 0; i < 5; i++) {
       expect(await LP_STAKING.pendingRewards(await owner.getAddress())).eq(i * 20);
       expect(await LP_STAKING.pendingRewards(await staker_amanda.getAddress())).eq(amandaRewardsPreOwnerStake + (i * 40));
       expect(await LP_STAKING.pendingRewards(await staker_ben.getAddress())).eq(benRewardsPreOwnerStake + (i * 40));
       await mineNBlocks(1);
    }
  });

  xit("LP stakers can roll accumulated rewards into main staking contract", async () => {
    // Amanda stakes and rolls rewards to main contract
    await LP_STAKING.connect(staker_amanda).stake(100);
    await mineNBlocks(5);
    await LP_STAKING.connect(staker_amanda).restakeTempleRewards();
    expect(await LP_STAKING.pendingRewards(await staker_amanda.getAddress())).eq(0);
    expect((await STAKING.balance(await staker_amanda.getAddress())).toNumber()).approximately(600,1);

    // Ben stakes and 5 blocks later, they both roll rewards
    await LP_STAKING.connect(staker_ben).stake(100);
    await mineNBlocks(5);

    expect(await LP_STAKING.pendingRewards(await staker_ben.getAddress())).eq(250);
    expect(await LP_STAKING.pendingRewards(await staker_amanda.getAddress())).eq(350);

    // 300 temple rolled for Ben (50 more as restaking mines 1 more block)
    await LP_STAKING.connect(staker_ben).restakeTempleRewards();
    expect(await LP_STAKING.pendingRewards(await staker_ben.getAddress())).eq(0);
    expect((await STAKING.balance(await staker_ben.getAddress())).toNumber()).approximately(300,1);

    // 1110 in total for amanda (an extra 450 temple + EPY from staking contract).
    // 100 more as both Ben and Amanda restaking mines 2 more blocks
    await LP_STAKING.connect(staker_amanda).restakeTempleRewards();
    expect(await LP_STAKING.pendingRewards(await staker_amanda.getAddress())).eq(0);
    expect((await STAKING.balance(await staker_amanda.getAddress())).toNumber()).approximately(1110,1);
  });

  xit("LP stakers unstake via the exit queue", async () => {
    // Amanda and ben stake
    await LP_STAKING.connect(staker_amanda).stake(100);
    await mineNBlocks(5);
    await LP_STAKING.connect(staker_ben).stake(100);
    await mineNBlocks(5);

    // sanity check accumulated rewards
    expect(await LP_STAKING.pendingRewards(await staker_ben.getAddress())).eq(250);
    expect(await LP_STAKING.pendingRewards(await staker_amanda.getAddress())).eq(850);

    // 300 temple in queue when Ben unstakes (50 more as restaking mines 1 more block)
    expect(await LP_TOKEN.balanceOf(await staker_ben.getAddress())).eq(900);
    await LP_STAKING.connect(staker_ben).unstake();
    expect(await LP_TOKEN.balanceOf(await staker_ben.getAddress())).eq(1000);
    expect(await LP_STAKING.pendingRewards(await staker_ben.getAddress())).eq(0);
    expect((await EXIT_QUEUE.userData(await staker_ben.getAddress())).Amount).eq(300);

    // 1000 temple in queue when Ben unstakes 
    //  - 50 more as when ben restakes mines 1 more block
    //  - 100 more as final reward when amanda unstakes (as it also mines 1 more block)
    expect(await LP_TOKEN.balanceOf(await staker_amanda.getAddress())).eq(900);
    await LP_STAKING.connect(staker_amanda).unstake();
    expect(await LP_TOKEN.balanceOf(await staker_amanda.getAddress())).eq(1000);
    expect(await LP_STAKING.pendingRewards(await staker_amanda.getAddress())).eq(0);
    expect((await EXIT_QUEUE.userData(await staker_amanda.getAddress())).Amount).eq(1000);
  });
});