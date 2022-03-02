import { ethers, network } from "hardhat";
import { ContractFactory, Signer } from "ethers";
import { expect } from "chai";

import { TempleERC20Token } from "../../typechain/TempleERC20Token";
import { TempleStaking } from "../../typechain/TempleStaking";
import { shouldThrow } from "./helpers";

describe("Defend", async () => {
  // let templeToken: TempleERC20Token;
  // let owner: Signer
  // let minter: Signer
  // let amanda: Signer
  // let ben: Signer;
 
  // beforeEach(async () => {
  //   templeToken = await deploy(ethers.getContractFactory("TempleERC20Token")) as TempleERC20Token;
  //   [owner, minter, amanda, ben] = await ethers.getSigners();
  // })

  // it("Should only be pausable/unpausable by the owner", async () => {
  //   // owner can pause/unpause
  //   await templeToken.pause();
  //   await templeToken.unpause();

  //   // Non-admin can't pause or unpause
  //   await shouldThrow(templeToken.connect(amanda).pause(), /Ownable: caller is not the owner/);
  //   await templeToken.pause();
  //   await shouldThrow(templeToken.connect(amanda).unpause(), /Ownable: caller is not the owner/);
  // });

  // it("Only specified roles can mint", async () => {
  //   const amandaAddress: string = await amanda.getAddress();
  //   const minterAddress: string = await minter.getAddress();

  //   // mint should fail when no minter set.
  //   await shouldThrow(templeToken.mint(amandaAddress, 10), /Caller cannot mint/);

  //   // Only admin can add a minter
  //   await shouldThrow(templeToken.connect(amanda).addMinter(amandaAddress), /Ownable: caller is not the owner/);
  //   await templeToken.addMinter(minterAddress);

  //   // Only minter can, well mint
  //   await templeToken.connect(minter).mint(amandaAddress, 10);
  //   expect(await templeToken.balanceOf(amandaAddress)).equals(10);
  //   await shouldThrow(templeToken.mint(amandaAddress, 10), /Caller cannot mint/);

  //   // Only admin can remove a minter
  //   await shouldThrow(templeToken.connect(amanda).removeMinter(minterAddress), /Ownable: caller is not the owner/);
  //   await templeToken.removeMinter(minterAddress);
  // });
});