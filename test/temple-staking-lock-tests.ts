import { expect } from "chai";
import { Signer } from "ethers";
import { ethers } from "hardhat";
import { LockedOGTemple__factory } from "../typechain/factories/LockedOGTemple__factory";
import { OGTemple__factory } from "../typechain/factories/OGTemple__factory";
import { LockedOGTemple } from "../typechain/LockedOGTemple";
import { OGTemple } from "../typechain/OGTemple";
import { blockTimestamp, fromAtto, mineToTimestamp, shouldThrow, toAtto } from "./helpers";

describe("Temple Staked Lock Mechanics", async () => {
  let ogTempleToken: OGTemple;
  let lockedOGTemple: LockedOGTemple;
  let owner: Signer;
  let user: Signer;

  const noLockErr = /No lock entry at the specified index/;
  const stillLockedErr = /Specified entry is still locked/;

  beforeEach(async () => {
    [owner,user] = await ethers.getSigners();

    ogTempleToken = await new OGTemple__factory(owner).deploy()
    lockedOGTemple = await new LockedOGTemple__factory(owner).deploy(ogTempleToken.address);

    await ogTempleToken.mint(await user.getAddress(), toAtto(100000));
    await ogTempleToken.mint(await owner.getAddress(), toAtto(100000));
    await ogTempleToken.connect(user).increaseAllowance(lockedOGTemple.address, toAtto(100000));
    await ogTempleToken.connect(owner).increaseAllowance(lockedOGTemple.address, toAtto(100000));
  })

  it.only("Simple lock/unlock checks", async () => {
    const lockedUntil = (await blockTimestamp()) + 10;
    await lockedOGTemple.connect(user).lock(toAtto(100), 10);
    const initialLock = await (await lockedOGTemple.ogTempleLocked(await user.getAddress())).lockedUntilTimestamp;
    await shouldThrow(lockedOGTemple.connect(user).unlock(0), stillLockedErr)
    expect(fromAtto((await lockedOGTemple.ogTempleLocked(await user.getAddress())).amount)).eq(100);

    await lockedOGTemple.connect(user).lock(toAtto(50), 20)
    await shouldThrow(lockedOGTemple.connect(user).unlock(1), stillLockedErr)

    const refreshedLock = await (await lockedOGTemple.ogTempleLocked(await user.getAddress())).lockedUntilTimestamp;
    expect(fromAtto((await lockedOGTemple.ogTempleLocked(await user.getAddress())).amount)).eq(150);
    expect(initialLock).lt(refreshedLock);

    // expect(fromAtto((await lockedOGTemple.locked(await user.getAddress(), 1)).BalanceOGTemple)).eq(50);
    
    // // mine to lock points and withdraw
    // await mineToTimestamp(lockedUntil);
    // await lockedOGTemple.connect(user).withdraw(0);
    // await shouldThrow(lockedOGTemple.connect(user).withdraw(0), stillLockedErr);
    // expect(fromAtto((await lockedOGTemple.locked(await user.getAddress(), 0)).BalanceOGTemple)).eq(50);
    // await mineToTimestamp(lockedUntil + 10);
    // await lockedOGTemple.connect(user).withdraw(0);

    // expect(fromAtto(await ogTempleToken.balanceOf(await user.getAddress()))).eq(100000);
  });

  // interface unlock {kind: 'unlock', idx: number, when: number} 
  // interface lock {kind: 'lock', amount: number, until: number};

  // const ul = (idx: number, when: number): unlock => { return {kind: 'unlock', idx, when} }
  // const l = (amount: number, until: number): lock => { return {kind: 'lock', amount, until} }

  // const cases: [string, (lock | unlock)[], number, RegExp?][] = [
  //   ["Unlock without lock (idx 0)", [ ul(0, 0) ], 0, noLockErr],
  //   ["Unlock without lock (idx 1)", [ ul(1, 0) ], 0, noLockErr],
  //   ["Lock then attempt to unlock early", [ l(100, 10), ul(0, 5) ], 100, stillLockedErr],
  //   ["Three locks, unlock first early", [ l(100, 10), l(100, 20), l(100, 30), ul(0,9) ], 300, stillLockedErr],
  //   ["Three locks, unlock second early", [ l(100, 10), l(100, 20), l(100, 30), ul(1,19) ], 300, stillLockedErr],
  //   ["Three locks, unlock third early", [ l(100, 10), l(100, 20), l(100, 30), ul(2,29) ], 300, stillLockedErr],
  //   ["Lock then withdraw", [ l(100, 10), ul(0, 11) ], 0 ],
  //   ["Three locks, unlock first only", [ l(100, 10), l(200, 20), l(300, 30), ul(0,11) ], 500],
  //   ["Three locks, unlock second only", [ l(100, 10), l(200, 20), l(300, 30), ul(1,21) ], 400],
  //   ["Three locks, unlock third only", [ l(100, 10), l(200, 20), l(300, 30), ul(2,31) ], 300],
  //   ["Three locks, with the first period starting out the longest", [ l(100, 30), l(200, 20), l(300, 10), ul(1,11), ul(2,11) ], 300, stillLockedErr ],
  // ];

  // // Use lock/withdraw directly as the user
  // describe("Use lock/withdraw tests directly as the user", async () => {
  //   cases.forEach(c => {
  //     const [description, actions, nLockedOgTemple, expectedErr] = c;

  //     it(description, async () => {
  //       const startTimestamp = await blockTimestamp();

  //       let thrownErr: Error|undefined = undefined;
  //       for (const a of actions) {
  //         try {
  //           if (a.kind == 'lock') {
  //             await lockedOGTemple.connect(user).lock(toAtto(a.amount), startTimestamp + a.until);
  //           } else if (a.kind == 'unlock') {
  //             await mineToTimestamp(startTimestamp + a.when);
  //             await lockedOGTemple.connect(user).withdraw(a.idx);
  //           }
  //         } catch (err) {
  //           thrownErr = err as Error;
  //         }
  //       }

  //       if (expectedErr !== undefined) {
  //         expect(thrownErr, "No error thrown. Expected error matching: " + expectedErr.source).not.undefined
  //         // expect(() => { throw thrownErr } ).throws(expectedErr);
  //       } else {
  //         expect(thrownErr, "Expected no error to be thrown, got error: " + thrownErr).undefined
  //       }
  //       expect(fromAtto(await ogTempleToken.balanceOf(lockedOGTemple.address)), "Unexpected value for OG Temple locked").eq(nLockedOgTemple);
  //     })
  //   });
  // });

  // describe("Use lockFor/withdrawFor (using the owner as a stand in for a contract proxy)", async () => {
  //   cases.forEach(c => {
  //     const [description, actions, nLockedOgTemple, expectedErr] = c;

  //     it(description, async () => {
  //       const startTimestamp = await blockTimestamp();
  //       const staker = await user.getAddress();

  //       let thrownErr: Error|undefined = undefined;
  //       for (const a of actions) {
  //         try {
  //           if (a.kind == 'lock') {
  //             await lockedOGTemple.lockFor(staker, toAtto(a.amount), startTimestamp + a.until);
  //           } else if (a.kind == 'unlock') {
  //             await mineToTimestamp(startTimestamp + a.when);
  //             await lockedOGTemple.withdrawFor(staker, a.idx);
  //           }
  //         } catch (err) {
  //           thrownErr = err as Error;
  //         }
  //       }

  //       if (expectedErr !== undefined) {
  //         expect(thrownErr, "No error thrown. Expected error matching: " + expectedErr.source).not.undefined
  //         // expect(() => { throw thrownErr } ).throws(expectedErr);
  //       } else {
  //         expect(thrownErr, "Expected no error to be thrown, got error: " + thrownErr).undefined
  //       }
  //       expect(fromAtto(await ogTempleToken.balanceOf(lockedOGTemple.address)), "Unexpected value for OG Temple locked").eq(nLockedOgTemple);
  //     })
  //   });
  // });
});