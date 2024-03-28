import { ethers } from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai";

import { TempleERC20Token, TempleERC20Token__factory } from "../typechain";
import { shouldThrow } from "./helpers";

describe("Temple ERC20 Token", async () => {
  let TEMPLE: TempleERC20Token;
  let owner: Signer;
  let minter: Signer;
  let amanda: Signer;
 
  beforeEach(async () => {
    [owner, minter, amanda] = await ethers.getSigners();
    TEMPLE = await new TempleERC20Token__factory(owner).deploy()
  })

  it("Only specified roles can mint", async () => {
    const amandaAddress: string = await amanda.getAddress();
    const minterAddress: string = await minter.getAddress();

    // mint should fail when no minter set.
    await shouldThrow(TEMPLE.mint(amandaAddress, 10), /Caller cannot mint/);

    // Only admin can add a minter
    await expect(TEMPLE.connect(amanda).addMinter(amandaAddress))
      .to.be.revertedWithCustomError(TEMPLE, "OwnableUnauthorizedAccount").withArgs(await amanda.getAddress());
    await TEMPLE.addMinter(minterAddress);

    // Only minter can, well mint
    await TEMPLE.connect(minter).mint(amandaAddress, 10);
    expect(await TEMPLE.balanceOf(amandaAddress)).equals(10);
    await shouldThrow(TEMPLE.mint(amandaAddress, 10), /Caller cannot mint/);

    // Only admin can remove a minter
    await expect(TEMPLE.connect(amanda).removeMinter(minterAddress))
      .to.be.revertedWithCustomError(TEMPLE, "OwnableUnauthorizedAccount").withArgs(await amanda.getAddress());
    await TEMPLE.removeMinter(minterAddress);
  });
});