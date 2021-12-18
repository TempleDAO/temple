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

  const stillLockedErr = /LockedOGTemple: Still Locked/;

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
    await lockedOGTemple.connect(user).lock(toAtto(100), 10);
    const initialLock = (await lockedOGTemple.ogTempleLocked(await user.getAddress())).lockedUntilTimestamp;
    await shouldThrow(lockedOGTemple.connect(user).unlock(0), stillLockedErr)
    expect(fromAtto((await lockedOGTemple.ogTempleLocked(await user.getAddress())).amount)).eq(100);

    await lockedOGTemple.connect(user).lock(toAtto(50), 20)
    await shouldThrow(lockedOGTemple.connect(user).unlock(1), stillLockedErr)

    const refreshedLock = (await lockedOGTemple.ogTempleLocked(await user.getAddress())).lockedUntilTimestamp;
    expect(fromAtto((await lockedOGTemple.ogTempleLocked(await user.getAddress())).amount)).eq(150);
    expect(initialLock).lt(refreshedLock);

    // mine to lock points and withdraw
    await mineToTimestamp(initialLock.toNumber());
    await shouldThrow(lockedOGTemple.connect(user).unlock(toAtto(100)), stillLockedErr)
    await mineToTimestamp(refreshedLock.toNumber() + 1);
    await lockedOGTemple.connect(user).unlock(toAtto(100));
    await shouldThrow(lockedOGTemple.connect(user).unlock(toAtto(100)), /LockedOGTemple: can't unlock more than originally locked/);
    expect(fromAtto((await lockedOGTemple.ogTempleLocked(await user.getAddress())).amount)).eq(50);
    await lockedOGTemple.connect(user).unlock(toAtto(50));

    expect(fromAtto((await lockedOGTemple.ogTempleLocked(await user.getAddress())).amount)).eq(0);
  });
});