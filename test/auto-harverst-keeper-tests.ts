import { ethers, hardhatArguments } from "hardhat";
import { expect } from "chai";

import { TempleERC20Token } from "../typechain/TempleERC20Token";
import { FakeERC20 } from "../typechain/FakeERC20";
import { TempleTreasury } from "../typechain/TempleTreasury";
import { AutoHarvestKeeper } from "../typechain/AutoHarvestKeeper"
import { TreasuryManagementProxy } from "../typechain/TreasuryManagementProxy"
import { TempleERC20Token__factory } from "../typechain/factories/TempleERC20Token__factory";
import { FakeERC20__factory } from "../typechain/factories/FakeERC20__factory";
import { TempleTreasury__factory } from "../typechain/factories/TempleTreasury__factory";
import { AutoHarvestKeeper__factory } from "../typechain/factories/AutoHarvestKeeper__factory";
import { TreasuryManagementProxy__factory} from "../typechain/factories/TreasuryManagementProxy__factory"
import { BigNumber, Signer } from "ethers";
import { fromAtto, shouldThrow, toAtto } from "./helpers";
import { TestTreasuryAllocation } from "../typechain/TestTreasuryAllocation";

describe("AutoHarvest Keeper calls", async () => {
  let TEMPLE: TempleERC20Token;
  let STABLEC: FakeERC20;
  let TREASURY: TempleTreasury;
  let TREASURYPROXY: TreasuryManagementProxy;
  let KEEPER: AutoHarvestKeeper;
  let owner: Signer;
  let nonOwner: Signer;
 
  beforeEach(async () => {
    [owner, nonOwner] = await ethers.getSigners();

    TEMPLE = await new TempleERC20Token__factory(owner).deploy()
    STABLEC = await new FakeERC20__factory(owner).deploy("STABLEC", "STABLEC");
    TREASURY = await new TempleTreasury__factory(owner).deploy(
        TEMPLE.address,
        STABLEC.address,
    );

    TREASURYPROXY = await new TreasuryManagementProxy__factory(owner).deploy(
        await owner.getAddress(),
        TREASURY.address,
    )

    KEEPER = await new AutoHarvestKeeper__factory(owner).deploy(
        TREASURY.address,
        TREASURYPROXY.address,
        STABLEC.address
    )

    await TEMPLE.addMinter(TREASURY.address);
    await TEMPLE.addMinter(await owner.getAddress());

    await Promise.all([
      STABLEC.mint(await owner.getAddress(), toAtto(10000)),
      STABLEC.mint(await nonOwner.getAddress(), toAtto(10000)),
      TEMPLE.mint(await owner.getAddress(), toAtto(10000))
    ]);
  })

  it("Harvest only when 2 percent increase in treasury", async () => {

      await STABLEC.increaseAllowance(TREASURY.address, toAtto(100));
      await TREASURY.seedMint(toAtto(100),toAtto(100))
    
      let [upKeepKneeded0, ]  = await KEEPER.checkUpkeep([])
      expect(upKeepKneeded0).to.be.false

      //Increase the treasury by two percent
      await STABLEC.transfer(TREASURY.address, toAtto(2));
      
      let [upKeepKneeded1, ]  = await KEEPER.checkUpkeep([])
      expect(upKeepKneeded1).to.be.true

      await TREASURYPROXY.toggleHarvest()
      let [upKeepKneeded2, ]  = await KEEPER.checkUpkeep([])
      expect(upKeepKneeded2).to.be.false
  });

})