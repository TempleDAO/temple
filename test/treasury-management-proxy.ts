import { ethers, hardhatArguments } from "hardhat";
import { expect } from "chai";

import { TempleERC20Token } from "../typechain/TempleERC20Token";
import { FakeERC20 } from "../typechain/FakeERC20";
import { TempleTreasury } from "../typechain/TempleTreasury";
import { TreasuryManagementProxy } from "../typechain/TreasuryManagementProxy"
import { TempleERC20Token__factory } from "../typechain/factories/TempleERC20Token__factory";
import { FakeERC20__factory } from "../typechain/factories/FakeERC20__factory";
import { TempleTreasury__factory } from "../typechain/factories/TempleTreasury__factory";
import { TreasuryManagementProxy__factory} from "../typechain/factories/TreasuryManagementProxy__factory"
import { BigNumber, Signer } from "ethers";
import { fromAtto, shouldThrow, toAtto } from "./helpers";


describe("TreasuryManagementProxy calls", async () => {
  let TEMPLE: TempleERC20Token;
  let STABLEC: FakeERC20;
  let TREASURY: TempleTreasury;
  let TREASURYPROXY: TreasuryManagementProxy;
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

    TREASURY.transferOwnership(TREASURYPROXY.address)

    await TEMPLE.addMinter(TREASURY.address);
    await TEMPLE.addMinter(await owner.getAddress());

    await Promise.all([
      STABLEC.mint(await owner.getAddress(), toAtto(10000)),
      STABLEC.mint(await nonOwner.getAddress(), toAtto(10000)),
    ]);
  })

  it("only owner can call functions", async () => {
    const expectedErr = /caller is not the owner/;

    await shouldThrow(TREASURYPROXY.connect(nonOwner).resetIV(), expectedErr);
    await shouldThrow(TREASURYPROXY.connect(nonOwner).setHarvestDistributionPercentage(100), expectedErr);
    await shouldThrow(TREASURYPROXY.connect(nonOwner).distributeHarvest(), expectedErr);
    await shouldThrow(TREASURYPROXY.connect(nonOwner).mintAndAllocateTemple(await owner.getAddress(), 420), expectedErr);
    await shouldThrow(TREASURYPROXY.connect(nonOwner).unallocateAndBurnUnusedMintedTemple(await owner.getAddress()), expectedErr);
    await shouldThrow(TREASURYPROXY.connect(nonOwner).updateMarkToMarket(await owner.getAddress()), expectedErr);
    await shouldThrow(TREASURYPROXY.connect(nonOwner).withdraw(await owner.getAddress()), expectedErr);
    await shouldThrow(TREASURYPROXY.connect(nonOwner).ejectTreasuryAllocation(await owner.getAddress()), expectedErr);
    await shouldThrow(TREASURYPROXY.connect(nonOwner).upsertPool(await owner.getAddress(), 20), expectedErr);
    await shouldThrow(TREASURYPROXY.connect(nonOwner).removePool(0, await owner.getAddress()), expectedErr);
    await shouldThrow(TREASURYPROXY.connect(nonOwner).transferOwnership(await nonOwner.getAddress()), expectedErr);
  });


  it("treasuryMangementProxy is owner of treasury", async() => {
    expect(await TREASURY.owner()).to.eq(TREASURYPROXY.address)
    await shouldThrow(TREASURY.resetIV(), /Ownable: caller is not the owner/);
    await shouldThrow(TREASURY.distributeHarvest(), /Ownable: caller is not the owner/);
    await shouldThrow(TREASURY.mintAndAllocateTemple(await owner.getAddress(), 420), /Ownable: caller is not the owner/);
    await shouldThrow(TREASURY.unallocateAndBurnUnusedMintedTemple(await owner.getAddress()), /Ownable: caller is not the owner/);
    await shouldThrow(TREASURY.updateMarkToMarket(await owner.getAddress()), /Ownable: caller is not the owner/);
    await shouldThrow(TREASURY.withdraw(await owner.getAddress()), /Ownable: caller is not the owner/);
    await shouldThrow(TREASURY.ejectTreasuryAllocation(await owner.getAddress()), /Ownable: caller is not the owner/);
    await shouldThrow(TREASURY.upsertPool(await owner.getAddress(), 20), /Ownable: caller is not the owner/);
    await shouldThrow(TREASURY.removePool(0, await owner.getAddress()), /Ownable: caller is not the owner/);
    await shouldThrow(TREASURY.transferOwnership(await nonOwner.getAddress()), /Ownable: caller is not the owner/);
  })

  it("Owner of TreasurManagementProxy can call treasury", async () => {
    expect(await TREASURYPROXY.resetIV()).to.not.Throw
    expect(await TREASURYPROXY.distributeHarvest()).to.not.Throw
    //Transfer ownership from TreasuryProxy to someone else
    expect(await TREASURYPROXY.transferOwnership(await nonOwner.getAddress())).to.not.Throw
    expect(await TREASURY.owner()).to.eq(await nonOwner.getAddress())
    expect(await TREASURY.connect(nonOwner).resetIV()).to.not.Throw
  });

  it("toggle harvest", async() => {
      expect(await TREASURYPROXY.harvestEnabled()).to.be.true;
      await TREASURYPROXY.toggleHarvest();
      expect(await TREASURYPROXY.harvestEnabled()).to.be.false;
  })

  it("update harvest amount", async() => {
    expect(await TREASURYPROXY.harvestDistributionPercentage()).to.eq(80);
    await TREASURYPROXY.setHarvestDistributionPercentage(100);
    expect(await TREASURYPROXY.harvestDistributionPercentage()).to.eq(100);
  })


})