import { ethers } from "hardhat";
import { expect } from "chai";

import { 
  TempleERC20Token, 
  Faith, 
  RedeemFaithManager, 
  LockedTemple, 
  TempleERC20Token__factory,
  Faith__factory,
  RedeemFaithManager__factory,
  LockedTemple__factory
} from "../../typechain";

import { Signer } from "ethers";
import { shouldThrow, blockTimestamp, fromAtto, deployAndAirdropTemple, toAtto } from "../helpers";

describe("RedeemFaith", async () => {
  let templeToken: TempleERC20Token;
  let faith: Faith;
  let redeemFaithManager: RedeemFaithManager;
  let lockedTemple: LockedTemple;

  let owner: Signer;
  let alan: Signer;
  let ben: Signer

  beforeEach(async () => {
    [owner, alan, ben] = await ethers.getSigners();

    templeToken = await deployAndAirdropTemple(
      owner,
      [owner, alan, ben],
      toAtto(100000)
    );

    faith = await new Faith__factory(owner).deploy();
    redeemFaithManager = await new RedeemFaithManager__factory(owner).deploy(
      templeToken.address,
      faith.address
    );
    lockedTemple = await new LockedTemple__factory(owner).deploy(
      templeToken.address,
      faith.address,
    )

    await faith.addManager(lockedTemple.address);
  });
})