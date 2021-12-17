import { ethers, network } from "hardhat";
import { ContractFactory, Signer } from "ethers";
import { expect } from "chai";

import { FaithERC20Token } from "../typechain/FaithERC20Token";
import { shouldThrow } from "./helpers";
import { FaithERC20Token__factory } from "../typechain/factories/FaithERC20Token__factory";

describe("Temple ERC20 Token", async () => {
  let Faith: FaithERC20Token;
  let owner: Signer
  let minter: Signer
  let amanda: Signer
  let ben: Signer;
  let jill: Signer;
 
  beforeEach(async () => {
    [owner, minter, amanda] = await ethers.getSigners();
    Faith = await new FaithERC20Token__factory(owner).deploy()
  })

  it("Only specified roles can mint", async () => {
    const amandaAddress: string = await amanda.getAddress();
    const minterAddress: string = await minter.getAddress();

    // mint should fail when no minter set.
    await shouldThrow(Faith.mint(amandaAddress, 10), /Caller cannot mint/);

    // Only admin can add a minter
    await shouldThrow(Faith.connect(amanda).addMinter(amandaAddress), /Ownable: caller is not the owner/);
    await Faith.addMinter(minterAddress);

    // Only minter can, well mint
    await Faith.connect(minter).mint(amandaAddress, 10);
    expect(await Faith.balanceOf(amandaAddress)).equals(10);
    await shouldThrow(Faith.mint(amandaAddress, 10), /Caller cannot mint/);

    // Only admin can remove a minter
    await shouldThrow(Faith.connect(amanda).removeMinter(minterAddress), /Ownable: caller is not the owner/);
    await Faith.removeMinter(minterAddress);
  });

})