import { ethers } from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai";

import { fromAtto, shouldThrow, toAtto } from "./helpers";
import { PresaleAllocation__factory } from "../typechain/factories/PresaleAllocation__factory";
import { PresaleAllocation } from "../typechain/PresaleAllocation";

xdescribe("Test configuration of Presale Allocation whitelist", async () => {
   let PRESALE_ALLOCATION: PresaleAllocation;
   let owner: Signer;
   let nonOwner: Signer;
   const ownableErr = /Ownable: caller is not the owner/

   beforeEach(async () => {
     [owner, nonOwner] = (await ethers.getSigners()) as Signer[];

     PRESALE_ALLOCATION = await new PresaleAllocation__factory(owner).deploy();
  })

  it("Only owner can set allocation", async () => {
    const nonOwnerAddress = await nonOwner.getAddress();
    const ownerAddress = await owner.getAddress();

    await shouldThrow(PRESALE_ALLOCATION.connect(nonOwner).setAllocation(nonOwnerAddress, toAtto(1000), 1), ownableErr);
    await shouldThrow(PRESALE_ALLOCATION.connect(nonOwner).setAllocation(ownerAddress, toAtto(2000), 1), ownableErr);

    await PRESALE_ALLOCATION.setAllocation(nonOwnerAddress, toAtto(1000), 1);
    await PRESALE_ALLOCATION.setAllocation(ownerAddress, toAtto(2000), 2);

    expect(fromAtto((await PRESALE_ALLOCATION.allocationOf(nonOwnerAddress)).amount)).eq(1000);
    expect((await PRESALE_ALLOCATION.allocationOf(nonOwnerAddress)).epoch).eq(1);
    expect(fromAtto((await PRESALE_ALLOCATION.allocationOf(ownerAddress)).amount)).eq(2000);
    expect((await PRESALE_ALLOCATION.allocationOf(ownerAddress)).epoch).eq(2);
  });

  it("Owner can change an address allocation and epoch", async () => {
    const nonOwnerAddress = await nonOwner.getAddress();
    const ownerAddress = await owner.getAddress();

    await PRESALE_ALLOCATION.setAllocation(nonOwnerAddress, toAtto(1000), 1);
    await shouldThrow(PRESALE_ALLOCATION.connect(nonOwner).setAllocation(nonOwnerAddress, toAtto(2000), 1), ownableErr);
    expect(fromAtto((await PRESALE_ALLOCATION.allocationOf(nonOwnerAddress)).amount)).eq(1000);
    expect((await PRESALE_ALLOCATION.allocationOf(nonOwnerAddress)).epoch).eq(1);

    // change allocation amount
    await PRESALE_ALLOCATION.setAllocation(nonOwnerAddress, toAtto(2000), 1);
    expect(fromAtto((await PRESALE_ALLOCATION.allocationOf(nonOwnerAddress)).amount)).eq(2000);
    expect((await PRESALE_ALLOCATION.allocationOf(nonOwnerAddress)).epoch).eq(1);

    // change allocation epoch
    await PRESALE_ALLOCATION.setAllocation(nonOwnerAddress, toAtto(2000), 2);
    expect(fromAtto((await PRESALE_ALLOCATION.allocationOf(nonOwnerAddress)).amount)).eq(2000);
    expect((await PRESALE_ALLOCATION.allocationOf(nonOwnerAddress)).epoch).eq(2);

    // change both at once epoch
    await PRESALE_ALLOCATION.setAllocation(nonOwnerAddress, toAtto(3000), 3);
    expect(fromAtto((await PRESALE_ALLOCATION.allocationOf(nonOwnerAddress)).amount)).eq(3000);
    expect((await PRESALE_ALLOCATION.allocationOf(nonOwnerAddress)).epoch).eq(3);
  });
});