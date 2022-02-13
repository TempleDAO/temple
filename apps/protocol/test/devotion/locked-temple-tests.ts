import { ethers } from "hardhat";
import { expect } from "chai";

import { 
  TempleERC20Token, 
  Faith, 
  LockedTemple, 
  Faith__factory,
  LockedTemple__factory
} from "../../typechain";

import { Signer } from "ethers";
import { shouldThrow, fromAtto, deployAndAirdropTemple, toAtto, mineToTimestamp } from "../helpers";

describe("LockedTemple", async () => {
  let templeToken: TempleERC20Token;
  let faith: Faith;
  let lockedTemple: LockedTemple;

  let owner: Signer;
  let alan: Signer;
  let ben: Signer

  const SECONDS_IN_MONTH = 2629800;

  beforeEach(async () => {
    [owner, alan, ben] = await ethers.getSigners();

    templeToken = await deployAndAirdropTemple(
      owner,
      [owner, alan, ben],
      toAtto(100000)
    );

    faith = await new Faith__factory(owner).deploy();
    lockedTemple = await new LockedTemple__factory(owner).deploy(
      templeToken.address,
      faith.address,
    );

    await faith.addManager(lockedTemple.address);
  });

  it("Calculates faith for various lock durations correctly", async () => {
    for (let lockDuration = 0; lockDuration <= 48; lockDuration++) {
      for (let lockIncrease = 0; lockIncrease <= lockDuration; lockIncrease++) {
        expect(await lockedTemple.calcFaith(toAtto(1), lockIncrease * SECONDS_IN_MONTH, lockDuration * SECONDS_IN_MONTH), `invalid faith calculated for lockIncrease:${lockIncrease} and lockDuration:${lockDuration}`).eq(lockIncrease * lockDuration)
      }
    }
  }) 

  it("Simple lock/unlock checks", async () => {
    const stillLockedErr = /LockedTemple: Still Locked/;
    await templeToken.connect(alan).increaseAllowance(lockedTemple.address, toAtto(100000));

    await lockedTemple.connect(alan).lock(toAtto(100), SECONDS_IN_MONTH);
    const initialLock = (await lockedTemple.wenTemple(await alan.getAddress())).lockedUntilTimestamp;
    await shouldThrow(lockedTemple.connect(alan).unlock(0), stillLockedErr)
    expect(fromAtto((await lockedTemple.wenTemple(await alan.getAddress())).amount)).eq(100);

    await lockedTemple.connect(alan).lock(toAtto(50), SECONDS_IN_MONTH * 2)
    await shouldThrow(lockedTemple.connect(alan).unlock(1), stillLockedErr)

    const refreshedLock = (await lockedTemple.wenTemple(await alan.getAddress())).lockedUntilTimestamp;
    expect(fromAtto((await lockedTemple.wenTemple(await alan.getAddress())).amount)).eq(150);
    expect(initialLock).lt(refreshedLock);

    // mine to lock points and withdraw
    await mineToTimestamp(initialLock.toNumber());
    await shouldThrow(lockedTemple.connect(alan).unlock(toAtto(100)), stillLockedErr)
    await mineToTimestamp(refreshedLock.toNumber() + 1);
    await lockedTemple.connect(alan).unlock(toAtto(100));
    await shouldThrow(lockedTemple.connect(alan).unlock(toAtto(100)), /LockedTemple: can't unlock more than originally locked/);
    expect(fromAtto((await lockedTemple.wenTemple(await alan.getAddress())).amount)).eq(50);
    await lockedTemple.connect(alan).unlock(toAtto(50));

    expect(fromAtto((await lockedTemple.wenTemple(await alan.getAddress())).amount)).eq(0);
  });

  it("Faith calc for locks", async () => {
    await templeToken.connect(alan).increaseAllowance(lockedTemple.address, toAtto(150));
    await templeToken.connect(ben).increaseAllowance(lockedTemple.address, toAtto(150));

    await lockedTemple.connect(alan).lock(toAtto(100), SECONDS_IN_MONTH);
    expect((await faith.balances(await alan.getAddress())).usableFaith).eq(100);

    await lockedTemple.connect(alan).lock(toAtto(50), SECONDS_IN_MONTH * 2)
    expect((await faith.balances(await alan.getAddress())).usableFaith).eq(500);

    await lockedTemple.connect(ben).lock(toAtto(150), SECONDS_IN_MONTH * 2)
    expect((await faith.balances(await ben.getAddress())).usableFaith).eq(600);
  });

  // TODO(butlerji): test lockFor permit
})