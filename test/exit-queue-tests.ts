import { ethers, network } from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai";

import { mineNBlocks, shouldThrow } from "./helpers";

import { TempleERC20Token } from "../typechain/TempleERC20Token";
import { TempleERC20Token__factory } from "../typechain/factories/TempleERC20Token__factory";
import { ExitQueue__factory } from "../typechain/factories/ExitQueue__factory";
import { ExitQueue } from "../typechain/ExitQueue";

describe("Exit Queue", async () => {
  let TEMPLE: TempleERC20Token;
  let EXIT_QUEUE: ExitQueue;

  let owner: Signer
  let amanda: Signer
  let ben: Signer
  let clint: Signer
 
  beforeEach(async () => {
    [owner, amanda, ben, clint] = await ethers.getSigners();

    TEMPLE = await new TempleERC20Token__factory(owner).deploy()

    await TEMPLE.addMinter(await owner.getAddress());
    await Promise.all([
      TEMPLE.mint(await amanda.getAddress(), 1000),
      TEMPLE.mint(await ben.getAddress(), 1000),
      TEMPLE.mint(await clint.getAddress(), 1000),
    ]);

    EXIT_QUEUE = await new ExitQueue__factory(owner).deploy(
      TEMPLE.address,
      200, /* max per epoch */
      100, /* max per address per epoch */
      10, /* epoch size, in blocks */
    )

    await Promise.all([
      TEMPLE.connect(amanda).increaseAllowance(EXIT_QUEUE.address, 1000),
      TEMPLE.connect(ben).increaseAllowance(EXIT_QUEUE.address, 1000),
      TEMPLE.connect(clint).increaseAllowance(EXIT_QUEUE.address, 1000),
    ]);
  })

  it("Only owner can change settings", async () => {
    // Should work as owner
    await EXIT_QUEUE.setEpochSize(20);
    expect(await EXIT_QUEUE.epochSize()).eq(20);

    await EXIT_QUEUE.setMaxPerAddress(10);
    expect(await EXIT_QUEUE.maxPerAddress()).eq(10);

    await EXIT_QUEUE.setEpochSize(20);
    expect(await EXIT_QUEUE.epochSize()).eq(20);

    await shouldThrow(EXIT_QUEUE.setStartingBlock(1000), /Can only move start block back, not forward/);
    await EXIT_QUEUE.setStartingBlock(1);
    expect(await EXIT_QUEUE.firstBlock()).eq(1);

    const benAddress = await ben.getAddress();
    await EXIT_QUEUE.setOwedTemple([benAddress], [10]);
    expect(await EXIT_QUEUE.owedTemple(benAddress)).eq(10);

    // Should fail as anyone else
    const nonOwner = EXIT_QUEUE.connect(amanda);
    await shouldThrow(nonOwner.setEpochSize(20), /Ownable: caller is not the owner/);
    await shouldThrow(nonOwner.setMaxPerAddress(10), /Ownable: caller is not the owner/);
    await shouldThrow(nonOwner.setEpochSize(20), /Ownable: caller is not the owner/);
    await shouldThrow(nonOwner.setStartingBlock(1), /Ownable: caller is not the owner/);
    await shouldThrow(nonOwner.setOwedTemple([benAddress], [10]), /Ownable: caller is not the owner/);
  });

  it("Correctly calculates EPOCHS", async () => {
    expect(await EXIT_QUEUE.currentEpoch()).eq(0);
    await mineNBlocks((await EXIT_QUEUE.epochSize()).toNumber());
    expect(await EXIT_QUEUE.currentEpoch()).eq(1);
  });

  it("allocates exit epoch appropriately", async () => {
    const users: {[key: string]: Signer} = {
      'amanda': amanda,
      'ben': ben,
      'clint': clint,
    }

    // Helper to add TEMEPLE to exit queue, and check all invariants
    const join = async (who: string, amount: number, expectedEpoch: number,
      ...expected: [number, string, number][]) => {

      const expectedTotalPerEpoch: {[key: number]: number} = {}
      expect(await EXIT_QUEUE.currentEpoch(), "Expected epoch").eq(expectedEpoch);
      await EXIT_QUEUE.connect(users[who]).join(await users[who].getAddress(), amount);

      for (let i = 0; i < expected.length; i++) {
        const [epoch, who, amount] = expected[i];
        expect(await EXIT_QUEUE.currentEpochAllocation(await users[who].getAddress(), epoch), `In epoch: ${expectedEpoch} ${who} allocation in epoch ${epoch}`).eq(amount);

        if (!expectedTotalPerEpoch[epoch]) {
          expectedTotalPerEpoch[epoch] = amount;
        } else {
          expectedTotalPerEpoch[epoch] += amount;
        }
      }

      for (let epoch in expectedTotalPerEpoch) {
        expect(await EXIT_QUEUE.totalPerEpoch(epoch), `In epoch: ${expectedEpoch} totalPerEpoch, ${epoch}`).eq(expectedTotalPerEpoch[epoch]);
        expect(expectedTotalPerEpoch[epoch], `In epoch: ${expectedEpoch} Total per epoch always < max ${epoch}`).lte(200);
      }
    }

    await join('amanda', 100, 0,
      [0, 'amanda', 100]);

    await join('ben', 50, 0,
      [0, 'amanda', 100],
      [0, 'ben', 50]);

    await join('clint', 250, 0,
      [0, 'amanda', 100],
      [0, 'ben', 50],
      [0, 'clint', 50],
      [1, 'clint', 100],
      [2, 'clint', 100],
    );

    await join('clint', 100, 0,
      [0, 'amanda', 100],
      [0, 'ben', 50],
      [0, 'clint', 50],
      [1, 'clint', 100],
      [2, 'clint', 100],
      [3, 'clint', 100],
    );

    await join('ben', 150, 0,
      [0, 'amanda', 100],
      [0, 'ben', 50],
      [0, 'clint', 50],
        [1, 'clint', 100],
        [1, 'ben', 100],
      [2, 'clint', 100],
      [2, 'ben', 50],
        [3, 'clint', 100],
    );

    // Amanda has a few continues small joins to the queue, this should be
    // the same as one big join
    await EXIT_QUEUE.connect(amanda).join(await amanda.getAddress(), 50);
    await EXIT_QUEUE.connect(amanda).join(await amanda.getAddress(), 100);
    await EXIT_QUEUE.connect(amanda).join(await amanda.getAddress(), 50);
    await join('amanda', 50, 1,
      [0, 'amanda', 100],
      [0, 'ben', 50],
      [0, 'clint', 50],
        [1, 'clint', 100],
        [1, 'ben', 100],
      [2, 'clint', 100],
      [2, 'ben', 50],
      [2, 'amanda', 50],
        [3, 'clint', 100],
        [3, 'amanda', 100],
      [4, 'amanda', 100],
    );

    // Ben joins after a long wait, we should never join an epoch in the past
    mineNBlocks(10* 5);
    await join('ben', 50, 6,
      [0, 'amanda', 100],
      [0, 'ben', 50],
      [0, 'clint', 50],
        [1, 'clint', 100],
        [1, 'ben', 100],
      [2, 'clint', 100],
      [2, 'ben', 50],
      [2, 'amanda', 50],
        [3, 'clint', 100],
        [3, 'amanda', 100],
      [4, 'amanda', 100],
        [6, 'ben', 0],
        [7, 'ben', 50],
    );
  });

  it("Detailed happy path join/exit", async () => {
    const join = async (staker: Signer, amount: number) => {
      await EXIT_QUEUE.connect(staker).join(await staker.getAddress(), amount);
    }

    const users: {[key: string]: Signer} = {
      'amanda': amanda,
      'ben': ben,
      'clint': clint,
    }

    const checkExitMultiple = async (expectedEpoch: number, epochs: Array<number>, expected: {[key: string]: number}) => {
      expect(await EXIT_QUEUE.currentEpoch(), "Expected epoch").eq(expectedEpoch);

      for (let epoch of epochs) {
        if (epoch >= expectedEpoch) {
          for (let name in expected) {
            const exiter = users[name]
            await shouldThrow(EXIT_QUEUE.connect(exiter).withdrawEpochs([epoch], 1), /Can only withdraw from past epoch/);
          }
          return
        }
      }

      for (let name in expected) {
        const expectedWithdrawal = expected[name]
        const exiter = users[name]
        const preWithdrawBalance = (await TEMPLE.balanceOf(await exiter.getAddress())).toNumber()
        await EXIT_QUEUE.connect(exiter).withdrawEpochs(epochs, epochs.length)
        expect((await TEMPLE.balanceOf(await exiter.getAddress())).toNumber() - preWithdrawBalance, `${name} expected withdrawal`).eq(expectedWithdrawal)
      }
    }

    // No exit even after a few joins (still in first block)
    await join(amanda, 100);
    await join(ben, 50);
    await shouldThrow(EXIT_QUEUE.connect(amanda).withdrawEpochs([0], 1), /Can only withdraw from past epoch/);

    // Do a bunch of joins, after which users can exit their 0th epoch allocation
     await join(clint, 200);
     await join(clint, 100);
     await join(ben, 150);
     await join(amanda, 50);
     await join(amanda, 100);
     await join(amanda, 50);
     await shouldThrow(EXIT_QUEUE.connect(amanda).withdrawEpochs([1], 1), /Can only withdraw from past epoch/);
     await shouldThrow(EXIT_QUEUE.connect(amanda).withdrawEpochs([2], 1), /Can only withdraw from past epoch/);
     await shouldThrow(EXIT_QUEUE.connect(amanda).withdrawEpochs([3], 1), /Can only withdraw from past epoch/);
     await checkExitMultiple(1, [0], {'amanda': 100, 'ben': 50, 'clint': 50})

     // roll forward an epoch, then everyone can exit epoch 1
     mineNBlocks(10);
     await shouldThrow(EXIT_QUEUE.connect(ben).withdrawEpochs([2], 1), /Can only withdraw from past epoch/);
     await checkExitMultiple(2, [0], {'amanda': 0, 'ben': 0, 'clint': 0})
     await checkExitMultiple(2, [1], {'amanda': 0, 'ben': 100, 'clint': 100})

     // roll forward enough epochs, s.t users can exit all temple
     mineNBlocks(10*3);
     await checkExitMultiple(6, [1], {'amanda': 0, 'ben': 0, 'clint': 0})
     await checkExitMultiple(6, [2], {'amanda': 50, 'ben': 50, 'clint': 100})
     await checkExitMultiple(6, [3], {'amanda': 100, 'ben': 0, 'clint': 50})
     await checkExitMultiple(6, [4], {'amanda': 50, 'ben': 0, 'clint': 0})
     await checkExitMultiple(7, [5], {'amanda': 0, 'ben': 0, 'clint': 0})

     // multiple epoch withdrawals
     await join(amanda, 200);
     await join(amanda, 150);
     await join(clint, 100);
     await join(ben, 50);
     await join(clint, 50);
     await join(amanda, 100);
     await checkExitMultiple(8, [5,6], {'amanda': 0, 'ben': 0, 'clint': 0});
     await checkExitMultiple(8, [6,7], {'amanda': 0, 'ben': 0, 'clint': 0});
     await shouldThrow(EXIT_QUEUE.connect(ben).withdrawEpochs([7,8], 2), /Can only withdraw from past epoch/);
     
     mineNBlocks(10);
     await checkExitMultiple(9, [6,7,8], {'amanda': 100, 'ben': 0, 'clint': 100});
     // shouldn't be able to claim twice from already claimed epoch
     await checkExitMultiple(10, [6,7,8], {'amanda': 0, 'ben': 0, 'clint': 0});
     // mine enough blocks for everyone to exit
     mineNBlocks(10*3);
     await checkExitMultiple(13, [9,10,11,12], {'amanda': 350, 'clint': 50, 'ben': 50});
  });

  it("captures first/last block correctly per exiter", async () => {
    const users: {[key: string]: Signer} = {
      'amanda': amanda,
      'ben': ben,
      'clint': clint,
    }

    // || who | exitAmount | firstExitEpoch | lastExitEpoch | wait ||
    const testCases : [string, number, number, number, number?][] = [
      ['amanda', 100, 0, 0],
      ['ben', 50, 0, 0],
      ['clint', 250, 0, 2],
      ['clint', 100, 0, 3],
      ['ben', 150, 0, 2],

      // Amanda has a few continues small joins to the queue, this should be
      // the same as one big join
      ['amanda', 50, 0, 2],
      ['amanda', 100, 0, 3],
      ['amanda', 50, 0, 4],
      ['amanda', 50, 0, 4],

      // Ben joins after a long wait
      ['ben', 50, 0, 7, 10*5],
    ]

    for (let idx in testCases) {
      const [who, amount, firstExitEpoch, lastExitEpoch, wait] = testCases[idx];

      if (wait !== undefined) {
        await mineNBlocks(wait);
      }

      const exiterAddress = await users[who].getAddress();
      await EXIT_QUEUE.connect(users[who]).join(exiterAddress, amount);
      const exitData = await EXIT_QUEUE.userData(exiterAddress)
      expect(exitData.FirstExitEpoch, `${idx}, ${JSON.stringify(testCases[idx])}`).eq(firstExitEpoch);
      expect(exitData.LastExitEpoch, `${idx}, ${JSON.stringify(testCases[idx])}`).eq(lastExitEpoch);
    }
  });

  it("ensures owed temple is burned and user joins exit queue with new amount", async () => {
    const addressZero = "0x0000000000000000000000000000000000000000";
    const join = async (staker: Signer, amount: number) => {
      await EXIT_QUEUE.connect(staker).join(await staker.getAddress(), amount);
    }

    const users: {[key: string]: Signer} = {
      'amanda': amanda,
      'ben': ben,
      'clint': clint,
    }

    const checkExitMultiple = async (expectedEpoch: number, epochs: Array<number>, expected: {[key: string]: number}) => {
      expect(await EXIT_QUEUE.currentEpoch(), "Expected epoch").eq(expectedEpoch);

      for (let epoch of epochs) {
        if (epoch >= expectedEpoch) {
          for (let name in expected) {
            const exiter = users[name]
            await shouldThrow(EXIT_QUEUE.connect(exiter).withdrawEpochs([epoch], 1), /Can only withdraw from past epoch/);
          }
          return
        }
      }

      for (let name in expected) {
        const expectedWithdrawal = expected[name]
        const exiter = users[name]
        const preWithdrawBalance = (await TEMPLE.balanceOf(await exiter.getAddress())).toNumber()
        await EXIT_QUEUE.connect(exiter).withdrawEpochs(epochs, epochs.length)
        expect((await TEMPLE.balanceOf(await exiter.getAddress())).toNumber() - preWithdrawBalance, `${name} expected withdrawal`).eq(expectedWithdrawal)
      }
    }

    // no join with less than owed amount
    const benAddress = await ben.getAddress();
    await EXIT_QUEUE.setOwedTemple([benAddress], [100]);
    await shouldThrow(EXIT_QUEUE.connect(ben).join(benAddress, 50), /owing more than withdraw amount/);

    // join and receives right amount of temple after withdraw(minus burned temple)
    await expect(EXIT_QUEUE.connect(ben).join(benAddress, 120)).to.emit(TEMPLE, 'Transfer').withArgs(benAddress, addressZero, 100);
    await join(amanda, 100);
    await join(clint, 100);
    // roll over
    mineNBlocks(10);
    //await checkExit(1, 0, {'amanda': 100, 'ben': 20, 'clint': 80});
    await checkExitMultiple(1, [0], {'amanda': 100, 'ben': 20, 'clint': 80});

    // (formerly owing) user can exit again and receive amount without another burn
    await join(amanda, 10);
    await join(ben, 150);
    await join(clint, 60);
    mineNBlocks(10*3);
    await checkExitMultiple(5, [1], {'amanda': 0, 'ben': 0, 'clint': 20});
    await checkExitMultiple(5, [2,3,4], {'amanda': 10, 'ben': 150, 'clint': 60});
  });
});
