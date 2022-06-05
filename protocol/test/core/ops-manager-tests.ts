import { ethers } from "hardhat";
import { blockTimestamp, deployAndAirdropTemple, fromAtto, mineForwardSeconds, NULL_ADDR, toAtto } from "../helpers";
import { BigNumber, ContractTransaction, Event, Signer } from "ethers";
import {
  Exposure__factory,
  FakeERC20,
  FakeERC20__factory,
  JoiningFee,
  JoiningFee__factory,
  OpsManager,
  OpsManager__factory,
  NoopLiquidator__factory,
  TempleERC20Token,
  TempleERC20Token__factory,
  TreasuryFarmingRevenue__factory,
  Vault__factory,
  Vault,
} from "../../typechain";
import { expect } from "chai";
import { fail } from "assert";

describe("Temple Core Ops Manager", async () => {
  let opsManager: OpsManager;
  let templeToken: TempleERC20Token;
  let joiningFee: JoiningFee;

  let fxsToken: FakeERC20;
  let crvToken: FakeERC20;

  let owner: Signer;
  let alan: Signer;
  let ben: Signer;

  async function extractEvent(
      tx: ContractTransaction,
      eventName: string,
      expectedLength: number,
      evtToExtract: number
  ) : Promise<Event> {
    let events = await (await tx.wait()).events?.filter(evt => evt.event === eventName);
    if (events) {
      expect(events.length).equals(expectedLength);
      return events[evtToExtract]
    } else {
      fail(`No events emitted named ${eventName}`)
    }
  }

  beforeEach(async () => {
    [owner, alan, ben] = await ethers.getSigners();

    templeToken = await deployAndAirdropTemple(
      owner,
      [owner, alan, ben],
      toAtto(100000000)
    );

    joiningFee = await new JoiningFee__factory(owner).deploy(
      toAtto(1),
    );

    const opsManagerLib = await (await ethers.getContractFactory("OpsManagerLib")).connect(owner).deploy();
    opsManager = await new OpsManager__factory({ "contracts/core/OpsManagerLib.sol:OpsManagerLib" : opsManagerLib.address }, owner).deploy(
      templeToken.address,
      joiningFee.address
    );

    fxsToken = await new FakeERC20__factory(owner).deploy("FXS", "FXS");
    crvToken = await new FakeERC20__factory(owner).deploy("CRV", "CRV");
  });

  it("Create a new exposure", async () => {
    const createExposureTx1 = await opsManager.createExposure("Temple FXS Exposure", "TE-FXS", fxsToken.address);
    const createExposureTx2 = await opsManager.createExposure("Temple CRV Exposure", "TE-CRV", crvToken.address);

    const evt1 = await extractEvent(createExposureTx1, "CreateExposure", 1, 0);
    const evt2 = await extractEvent(createExposureTx2, "CreateExposure", 1, 0);
    // Check event args are not empty
    expect(evt1.args!!.exposure).not.empty;
    expect(evt1.args!!.primaryRevenue).not.empty;
    // Check OpsManager storage updated correctly
    const exposure1Addr = evt1.args!!.exposure;
    expect(await opsManager.pools(fxsToken.address)).equals(evt1.args!!.primaryRevenue);
    expect(await opsManager.revalTokens(0)).equals(fxsToken.address)

    // Check deployed exposure matches what we expect
    const exposure1 = await new Exposure__factory(owner).attach(exposure1Addr);
    expect (await exposure1.name()).equals("Temple FXS Exposure");
    expect (await exposure1.symbol()).equals("TE-FXS");
    expect (await exposure1.revalToken()).equals(fxsToken.address);

    expect(evt2.args!!.exposure).not.empty;
    expect(evt2.args!!.primaryRevenue).not.empty;
    const exposure2Addr = evt2.args!!.exposure;
    expect(await opsManager.pools(crvToken.address)).equals(evt2.args!!.primaryRevenue);
    expect(await opsManager.revalTokens(1)).equals(crvToken.address)

    const exposure2 = await new Exposure__factory(owner).attach(exposure2Addr);
    expect (await exposure2.name()).equals("Temple CRV Exposure");
    expect (await exposure2.symbol()).equals("TE-CRV");
    expect (await exposure2.revalToken()).equals(crvToken.address);
  })

  it("Create new vaults", async () => {
    const firstVaultstartTime = await blockTimestamp()

    const createVaultTx1 = await opsManager.createVaultInstance(
      "temple-1d-vault",
      "TV-1D-1",
      86400,
      3600,
      {p: 1, q: 1},
      firstVaultstartTime,
    )

    const createVaultTx2 = await opsManager.createVaultInstance(
      "temple-1d-vault",
      "TV-1D-2",
      86400,
      3600,
      {p: 1, q: 1},
      firstVaultstartTime + 3600,
    )

    const evt1 = await extractEvent(createVaultTx1, "CreateVaultInstance", 1, 0);

    // Check event args are not empty
    expect(evt1.args!!.vault).not.empty;

    // Check OpsManager storage updated correctly
    expect(await opsManager.activeVaults(evt1.args!!.vault)).to.be.true;

    // Check deployed contract matches what we would expect
    const vault1 = await new Vault__factory(owner).attach(evt1.args!!.vault);
    expect(await vault1.name()).equals("temple-1d-vault")
    expect(await vault1.symbol()).equals("TV-1D-1");
    expect(await vault1.periodDuration()).equals(86400);
    expect(await vault1.enterExitWindowDuration()).equals(3600);
    expect(await vault1.firstPeriodStartTimestamp()).equals(firstVaultstartTime);

    const evt2 = await extractEvent(createVaultTx2, "CreateVaultInstance", 1, 0);

    expect(evt2.args!!.vault).not.empty;

    expect(await opsManager.activeVaults(evt2.args!!.vault)).to.be.true;

    const vault2 = await new Vault__factory(owner).attach(evt2.args!!.vault);
    expect(await vault2.name()).equals("temple-1d-vault")
    expect(await vault2.symbol()).equals("TV-1D-2");
    expect(await vault2.periodDuration()).equals(86400);
    expect(await vault2.enterExitWindowDuration()).equals(3600);
    expect(await vault2.firstPeriodStartTimestamp()).equals(firstVaultstartTime+3600);
  })

  it("End to end flow, 1 vault", async () => {
    const firstVaultstartTime = await blockTimestamp()

    // create some vaults
    const vault1Addr = (await extractEvent(await opsManager.createVaultInstance(
      "temple-1d-vault",
      "TV-1D-1",
      86400,
      3600,
      {p: 1, q: 1},
      firstVaultstartTime,
    ), "CreateVaultInstance",1,0)).args!!.vault;

    // create two exposures as a result of our farming activities
    const fxsExposureAddr = (await extractEvent(await opsManager.createExposure(
      "Temple FXS Exposure", 
      "TE-FXS", 
      fxsToken.address
    ), "CreateExposure", 1, 0)).args!!.exposure;

    const vault1Alan = await new Vault__factory(alan).attach(vault1Addr);
    const templeTokenAlan = await new TempleERC20Token__factory(alan).attach(templeToken.address);

    const ENTER_EXIT_BUFFER = await (await vault1Alan.ENTER_EXIT_WINDOW_BUFFER()).toNumber();

    const vault1Ben = await new Vault__factory(ben).attach(vault1Addr);
    const templeTokenBen = await new TempleERC20Token__factory(ben).attach(templeToken.address);

    const fxsExposure = await new Exposure__factory(owner).attach(fxsExposureAddr);

    const noopLiquidator = await new NoopLiquidator__factory(owner).deploy(templeToken.address);
    await fxsExposure.setLiqidator(noopLiquidator.address);
    templeToken.addMinter(noopLiquidator.address);

    const alanAddr = await alan.getAddress();
    const benAddr = await ben.getAddress();

    // Deposit temple into the current open vault
    // Phase 1 - start of day 0
    
    await templeTokenAlan.increaseAllowance(vault1Alan.address, toAtto(100000));
    await vault1Alan.deposit(toAtto(75));
    expect(await vault1Alan.balanceOf(alanAddr)).equals(toAtto(75));

    await templeTokenBen.increaseAllowance(vault1Ben.address, toAtto(100000));
    await vault1Ben.deposit(toAtto(25));

    expect(await vault1Ben.balanceOf(benAddr)).equals(toAtto(25));

    // Fast forward to close vault, and rebalance open vault
    // with revenue share. Before callign rebalance, check
    // which vaults require a rebalance

    // Start of Day 8 - auto compounding

    // Start of day 8 pt3 - all vaults share of primary revenue is recalculated
    let needRebal = await opsManager.requiresRebalance([vault1Addr], fxsToken.address);
    expect (needRebal).to.eql([false]);
    await mineForwardSeconds(3600+ENTER_EXIT_BUFFER); // just make sure vault1 is closed
    needRebal = await opsManager.requiresRebalance([vault1Addr], fxsToken.address);
    expect (needRebal).to.eql([true]);
    await opsManager.rebalance([vault1Addr], fxsToken.address);

    // Start of day 8 pt 4 - accounting for how much of each exposure generated by primary revenue is alloc to each vault
    await opsManager.addRevenue([fxsToken.address], [toAtto(10000)]);

    // Start of day 8 pt 5 - call rebalance to keep accounting synced on chain
    await opsManager.rebalance([vault1Addr], fxsToken.address);

    // Start of day 15


    // For brevity, will skip Start of day 22

    // Start of day 28 pt 2 - just before we get to enter exit window, liquidate exposures
    await mineForwardSeconds(23*3600);
    // liquidate a vaults exposure
    await opsManager.liquidateExposures([vault1Addr],[fxsToken.address]);

    // Start of day 28 pt 6
    await opsManager.increaseVaultTemple([vault1Addr],[toAtto(10000)]);
    expect(await vault1Alan.balanceOf(alanAddr)).equals(toAtto(7575));
    expect(await vault1Ben.balanceOf(benAddr)).equals(toAtto(2525));
  })

  xit("End to end flow, 4 vaults", async () => {
    const firstVaultstartTime = await blockTimestamp()
    const enterExitWindowPeriod = 21600;

    // create some vaults
    const vault1Addr = (await extractEvent(await opsManager.createVaultInstance(
      "temple-1d-vault",
      "TV-1D-a",
      86400, // 24 hours
      enterExitWindowPeriod, // 6 hours
      {p: 1, q: 1},
      firstVaultstartTime,
    ), "CreateVaultInstance",1,0)).args!!.vault;
    const vault1 = new Vault__factory(owner).attach(vault1Addr);

    const vault2Addr = (await extractEvent(await opsManager.createVaultInstance(
      "temple-1d-vault",
      "TV-1D-b",
      86400, // 24 hours
      enterExitWindowPeriod, // 6 hours
      {p: 1, q: 1},
      firstVaultstartTime + 3600,
    ), "CreateVaultInstance",1,0)).args!!.vault;
    const vault2 = new Vault__factory(owner).attach(vault2Addr);

    const vault3Addr = (await extractEvent(await opsManager.createVaultInstance(
      "temple-1d-vault",
      "TV-1D-c",
      86400, // 24 hours
      enterExitWindowPeriod, // 6 hours
      {p: 1, q: 1},
      firstVaultstartTime + (3600*2),
    ), "CreateVaultInstance",1,0)).args!!.vault;
    const vault3 = new Vault__factory(owner).attach(vault3Addr);

    const vault4Addr = (await extractEvent(await opsManager.createVaultInstance(
      "temple-1d-vault",
      "TV-1D-d",
      86400, // 24 hours
      enterExitWindowPeriod, // 6 hours
      {p: 1, q: 1},
      firstVaultstartTime + (3600*3),
    ), "CreateVaultInstance",1,0)).args!!.vault;
    const vault4 = new Vault__factory(owner).attach(vault4Addr);

    // create single exposures as a result of our farming activities
    const fxsExposureAddr = (await extractEvent(await opsManager.createExposure(
      "Temple FXS Exposure", 
      "TE-FXS", 
      fxsToken.address
    ), "CreateExposure", 1, 0)).args!!.exposure;

    const templeTokenAlan = await new TempleERC20Token__factory(alan).attach(templeToken.address);
    const ENTER_EXIT_BUFFER = await (await vault1.ENTER_EXIT_WINDOW_BUFFER()).toNumber();

    const templeTokenBen = await new TempleERC20Token__factory(ben).attach(templeToken.address);

    const fxsExposure = await new Exposure__factory(owner).attach(fxsExposureAddr);

    const noopLiquidator = await new NoopLiquidator__factory(owner).deploy(templeToken.address);
    await fxsExposure.setLiqidator(noopLiquidator.address);
    templeToken.addMinter(noopLiquidator.address);

    const alanAddr = await alan.getAddress();
    const benAddr = await ben.getAddress();

    // Deposit temple into the current open vault
    // Phase 1 - start of day 0
    
    addDepositToVaults(vault1, toAtto(75), toAtto(25));
    expect(await vault1.balanceOf(alanAddr)).equals(toAtto(75));
    expect(await vault1.balanceOf(benAddr)).equals(toAtto(25));

    // Fast forward to close vault, and rebalance open vault
    // with revenue share. Before callign rebalance, check
    // which vaults require a rebalance

    // Start of Day 8 - auto compounding

    // Start of day 8 pt3 - all vaults share of primary revenue is recalculated
    let needRebal = await opsManager.requiresRebalance([vault1Addr, vault2Addr, vault3Addr, vault4Addr], fxsToken.address);
    expect (needRebal).to.eql([false, false, false, false]);
    await mineForwardSeconds(enterExitWindowPeriod+ENTER_EXIT_BUFFER); // just make sure vault1 is closed
    needRebal = await opsManager.requiresRebalance([vault1Addr, vault2Addr, vault3Addr, vault4Addr], fxsToken.address);
    expect (needRebal).to.eql([true, false, false, false]);
    await opsManager.rebalance([vault1Addr], fxsToken.address);
    expect(await vault1.inEnterExitWindow()).false;
    expect(await vault2.inEnterExitWindow()).true;

    // Add deposits to vault 2
    addDepositToVaults(vault2, toAtto(75), toAtto(25));
    expect(await vault2.balanceOf(alanAddr)).equals(toAtto(75));
    expect(await vault2.balanceOf(benAddr)).equals(toAtto(25));

    // Start of day 8 pt 4 - accounting for how much of each exposure generated by primary revenue is alloc to each vault
    await opsManager.addRevenue([fxsToken.address], [toAtto(10000)]);

    // Start of day 8 pt 5 - call rebalance to keep accounting synced on chain
    await opsManager.rebalance([vault1Addr], fxsToken.address);

    // For brevity, will skip Start of days 15 & 22

    // Start of day 28 pt 2 - just before we get to enter exit window, liquidate exposures
    await mineForwardSeconds(22*3600);
    // liquidate a vaults exposure
    await opsManager.liquidateExposures([vault1Addr],[fxsToken.address]);

    await mineForwardSeconds(3600); // get back into window
    // Start of day 28 pt 6
    await opsManager.increaseVaultTemple([vault1Addr],[toAtto(10000)]);
    expect(await vault1.balanceOf(alanAddr)).equals(toAtto(7575));
    expect(await vault1.balanceOf(benAddr)).equals(toAtto(2525));
  })

  async function addDepositToVaults(vault: Vault, amountAlan: BigNumber, amountBen: BigNumber) {
    await templeToken.connect(alan).increaseAllowance(vault.address, toAtto(100000));
    await vault.connect(alan).deposit(amountAlan);

    await templeToken.connect(ben).increaseAllowance(vault.address, toAtto(1000000));
    await vault.connect(ben).deposit(amountBen);
  }
})

