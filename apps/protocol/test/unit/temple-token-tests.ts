import { ethers, network } from "hardhat";
import { ContractFactory, Signer } from "ethers";
import { expect } from "chai";

import { TempleERC20Token } from "../../typechain/TempleERC20Token";
import { shouldThrow } from "./helpers";
import { TempleERC20Token__factory } from "../../typechain/factories/TempleERC20Token__factory";

describe("Temple ERC20 Token", async () => {
  let TEMPLE: TempleERC20Token;
  let owner: Signer
  let minter: Signer
  let amanda: Signer
  let ben: Signer;
 
  beforeEach(async () => {
    [owner, minter, amanda, ben] = await ethers.getSigners();
    TEMPLE = await new TempleERC20Token__factory(owner).deploy()
  })

  it("Only specified roles can mint", async () => {
    const amandaAddress: string = await amanda.getAddress();
    const minterAddress: string = await minter.getAddress();

    // mint should fail when no minter set.
    await shouldThrow(TEMPLE.mint(amandaAddress, 10), /Caller cannot mint/);

    // Only admin can add a minter
    await shouldThrow(TEMPLE.connect(amanda).addMinter(amandaAddress), /Ownable: caller is not the owner/);
    await TEMPLE.addMinter(minterAddress);

    // Only minter can, well mint
    await TEMPLE.connect(minter).mint(amandaAddress, 10);
    expect(await TEMPLE.balanceOf(amandaAddress)).equals(10);
    await shouldThrow(TEMPLE.mint(amandaAddress, 10), /Caller cannot mint/);

    // Only admin can remove a minter
    await shouldThrow(TEMPLE.connect(amanda).removeMinter(minterAddress), /Ownable: caller is not the owner/);
    await TEMPLE.removeMinter(minterAddress);
  });
});