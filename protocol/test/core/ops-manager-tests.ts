import { ethers } from "hardhat";
import { blockTimestamp, deployAndAirdropTemple, fromAtto, mineForwardSeconds, toAtto } from "../helpers";
import { BigNumber, ContractTransaction, Event, Signer } from "ethers";
import {
  Exposure__factory,
  FakeERC20,
  FakeERC20__factory,
  JoiningFee,
  JoiningFee__factory,
  OpsManager,
  OpsManager__factory,
  NoopVaultedTempleLiquidator__factory,
  TempleERC20Token,
  TempleERC20Token__factory,
  Vault__factory,
  Vault,
  OpsManagerLib,
  OpsManagerLib__factory,
  VaultedTemple__factory,
} from "../../typechain";
import { expect } from "chai";
import { fail } from "assert";
import { zeroAddress } from "ethereumjs-util";

describe("Temple Core Ops Manager", async () => {
  let opsManager: OpsManager;
  let templeToken: TempleERC20Token;
  let joiningFee: JoiningFee;
  let opsManagerLib: OpsManagerLib;

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
    const events = (await tx.wait()).events?.filter(evt => evt.event === eventName);
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
      toAtto(0.0001),
    );

    opsManagerLib = await new OpsManagerLib__factory(owner).deploy();
    opsManager = await new OpsManager__factory({ "contracts/core/OpsManagerLib.sol:OpsManagerLib" : opsManagerLib.address }, owner).deploy(
      templeToken.address,
      joiningFee.address
    );

    fxsToken = await new FakeERC20__factory(owner).deploy("FXS", "FXS", zeroAddress(), 0);
    crvToken = await new FakeERC20__factory(owner).deploy("CRV", "CRV", zeroAddress(), 0);
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
    const exposure1 = new Exposure__factory(owner).attach(exposure1Addr);
    expect (await exposure1.name()).equals("Temple FXS Exposure");
    expect (await exposure1.symbol()).equals("TE-FXS");
    expect (await exposure1.revalToken()).equals(fxsToken.address);

    expect(evt2.args!!.exposure).not.empty;
    expect(evt2.args!!.primaryRevenue).not.empty;
    const exposure2Addr = evt2.args!!.exposure;
    expect(await opsManager.pools(crvToken.address)).equals(evt2.args!!.primaryRevenue);
    expect(await opsManager.revalTokens(1)).equals(crvToken.address)

    const exposure2 = new Exposure__factory(owner).attach(exposure2Addr);
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
    const vault1 = new Vault__factory(owner).attach(evt1.args!!.vault);
    expect(await vault1.name()).equals("temple-1d-vault")
    expect(await vault1.symbol()).equals("TV-1D-1");
    expect(await vault1.periodDuration()).equals(86400);
    expect(await vault1.enterExitWindowDuration()).equals(3600);
    expect(await vault1.firstPeriodStartTimestamp()).equals(firstVaultstartTime);

    const evt2 = await extractEvent(createVaultTx2, "CreateVaultInstance", 1, 0);

    expect(evt2.args!!.vault).not.empty;

    expect(await opsManager.activeVaults(evt2.args!!.vault)).to.be.true;

    const vault2 = new Vault__factory(owner).attach(evt2.args!!.vault);
    expect(await vault2.name()).equals("temple-1d-vault")
    expect(await vault2.symbol()).equals("TV-1D-2");
    expect(await vault2.periodDuration()).equals(86400);
    expect(await vault2.enterExitWindowDuration()).equals(3600);
    expect(await vault2.firstPeriodStartTimestamp()).equals(firstVaultstartTime+3600);
  })

  it("Can successfully call updateExposureReval", async () => {
    const firstVaultstartTime = await blockTimestamp()

    // create two exposures as a result of our farming activities
    const fxsExposureAddr = (await extractEvent(await opsManager.createExposure(
      "Temple FXS Exposure", 
      "TE-FXS", 
      fxsToken.address
    ), "CreateExposure", 1, 0)).args!!.exposure;

    // create some vaults
    const vault1Addr = (await extractEvent(await opsManager.createVaultInstance(
      "temple-1d-vault",
      "TV-1D-1",
      86400,
      3600,
      {p: 1, q: 1},
      firstVaultstartTime,
    ), "CreateVaultInstance",1,0)).args!!.vault;

    const exposure = new Exposure__factory(owner).attach(fxsExposureAddr)
    expect(await exposure.owner()).equals(opsManager.address);
    
    const vault = new Vault__factory(owner).attach(vault1Addr);
    await templeToken.approve(vault.address, toAtto(10000));
    await vault.deposit(toAtto(1000));
    const ENTER_EXIT_BUFFER = (await vault.ENTER_EXIT_WINDOW_BUFFER()).toNumber();
    await mineForwardSeconds(3600+ENTER_EXIT_BUFFER) 
    // claims initial balance - needed otherwise reverted with panic code 0x12 (Division or modulo division by zero)
    await opsManager.rebalance([vault1Addr], fxsToken.address);
    await opsManager.addRevenue([fxsToken.address], [toAtto(1000)])
    expect(await exposure.balanceOf(vault1Addr)).equals(toAtto(0));

    // claim new share of rev
    await opsManager.rebalance([vault1Addr], fxsToken.address);
    expect(await exposure.balanceOf(vault1Addr)).equals(toAtto(1000));

    await opsManager.updateExposureReval([fxsToken.address], [toAtto(2000)])
    expect(await exposure.reval()).equals(toAtto(2000));
    expect(await exposure.balanceOf(vault1Addr)).equals(toAtto(2000));
  })

  it("Can update liquidator for an exposure", async () => {
    // create two exposures as a result of our farming activities
    const fxsExposureAddr = (await extractEvent(await opsManager.createExposure(
      "Temple FXS Exposure", 
      "TE-FXS", 
      fxsToken.address
    ), "CreateExposure", 1, 0)).args!!.exposure;

    const noopLiquidator = await new NoopVaultedTempleLiquidator__factory(owner).deploy(templeToken.address, await opsManager.vaultedTemple());
    const exposure = new Exposure__factory(owner).attach(fxsExposureAddr);
    expect(exposure.setLiqidator(noopLiquidator.address))
      .to.be.revertedWithCustomError(exposure, "OwnableUnauthorizedAccount").withArgs(await owner.getAddress());
    await opsManager.setExposureLiquidator(fxsToken.address, noopLiquidator.address);
    expect(await exposure.liquidator()).equals(noopLiquidator.address);
  })

  it("Can withdraw temple from shared vault", async () => {
    const vaultedTemple = new VaultedTemple__factory(owner).attach(await opsManager.vaultedTemple());

    templeToken.mint(vaultedTemple.address, toAtto(100));
    await expect(vaultedTemple.connect(alan).withdraw(templeToken.address, await alan.getAddress(), toAtto(100)))
      .to.be.revertedWithCustomError(vaultedTemple, "OwnableUnauthorizedAccount").withArgs(await alan.getAddress());

    await expect(async () => vaultedTemple.withdraw(templeToken.address, await owner.getAddress(), toAtto(100)))
      .to.changeTokenBalance(templeToken, owner, toAtto(100))
  })

  it("Can successfully set minter state for an exposure", async () => {
    // create two exposures as a result of our farming activities
    const fxsExposureAddr = (await extractEvent(await opsManager.createExposure(
      "Temple FXS Exposure", 
      "TE-FXS", 
      fxsToken.address
    ), "CreateExposure", 1, 0)).args!!.exposure;

    const exposure = new Exposure__factory(owner).attach(fxsExposureAddr);
    expect(exposure.setMinterState(await alan.getAddress(), true)).to.be.revertedWith("Owner: Caller is not the owner");
    await opsManager.setExposureMinterState(fxsToken.address, await alan.getAddress(), true);
    expect(await exposure.canMint(await alan.getAddress())).true;
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

    const vault1Alan = new Vault__factory(alan).attach(vault1Addr);
    const templeTokenAlan = new TempleERC20Token__factory(alan).attach(templeToken.address);

    const ENTER_EXIT_BUFFER = (await vault1Alan.ENTER_EXIT_WINDOW_BUFFER()).toNumber();

    const vault1Ben = new Vault__factory(ben).attach(vault1Addr);
    const templeTokenBen = new TempleERC20Token__factory(ben).attach(templeToken.address);

    const fxsExposure = new Exposure__factory(owner).attach(fxsExposureAddr);

    const noopLiquidator = await new NoopVaultedTempleLiquidator__factory(owner).deploy(templeToken.address, await opsManager.vaultedTemple());
    await opsManager.setExposureLiquidator(fxsToken.address, noopLiquidator.address);
    templeToken.addMinter(noopLiquidator.address);

    const alanAddr = await alan.getAddress();
    const benAddr = await ben.getAddress();

    // Deposit temple into the current open vault
    // Phase 1 - start of day 0
    
    await templeTokenAlan.approve(vault1Alan.address, toAtto(100000));
    await vault1Alan.deposit(toAtto(75));
    expect(await vault1Alan.balanceOf(alanAddr)).equals(toAtto(75));

    await templeTokenBen.approve(vault1Ben.address, toAtto(100000));
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

    expect(await fxsExposure.balanceOf(vault1Addr)).equals(toAtto(10000));

    // Start of day 15 pt 3 - update exposure balance, in this case assuming 1 $TEMPLE = 1 $FXS 
    // Skip until decision on Q3 is decided

    // Start of day 22 
    await opsManager.addRevenue([fxsToken.address], [toAtto(10000)])
    await opsManager.rebalance([vault1Addr], fxsToken.address);

    // Start of day 28 pt 2 - just before we get to enter exit window, liquidate exposures
    await mineForwardSeconds(23*3600);
    // liquidate a vaults exposure
    await opsManager.liquidateExposures([vault1Addr],[fxsToken.address]);

    // Start of day 28 pt 6
    // Assuming 
    await opsManager.increaseVaultTemple([vault1Addr],[toAtto(10000)]);
    expect(await vault1Alan.balanceOf(alanAddr)).equals(toAtto(7575));
    expect(await vault1Ben.balanceOf(benAddr)).equals(toAtto(2525));
  })

  it("End to end flow, 4 vaults", async () => {
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
      firstVaultstartTime + enterExitWindowPeriod,
    ), "CreateVaultInstance",1,0)).args!!.vault;
    const vault2 = new Vault__factory(owner).attach(vault2Addr);

    const vault3Addr = (await extractEvent(await opsManager.createVaultInstance(
      "temple-1d-vault",
      "TV-1D-c",
      86400, // 24 hours
      enterExitWindowPeriod, // 6 hours
      {p: 1, q: 1},
      firstVaultstartTime + (enterExitWindowPeriod*2),
    ), "CreateVaultInstance",1,0)).args!!.vault;
    const vault3 = new Vault__factory(owner).attach(vault3Addr);

    const vault4Addr = (await extractEvent(await opsManager.createVaultInstance(
      "temple-1d-vault",
      "TV-1D-d",
      86400, // 24 hours
      enterExitWindowPeriod, // 6 hours
      {p: 1, q: 1},
      firstVaultstartTime + (enterExitWindowPeriod*3),
    ), "CreateVaultInstance",1,0)).args!!.vault;
    const vault4 = new Vault__factory(owner).attach(vault4Addr);

    // create single exposures as a result of our farming activities
    const fxsExposureAddr = (await extractEvent(await opsManager.createExposure(
      "Temple FXS Exposure", 
      "TE-FXS", 
      fxsToken.address
    ), "CreateExposure", 1, 0)).args!!.exposure;

    const ENTER_EXIT_BUFFER =  (await vault1.ENTER_EXIT_WINDOW_BUFFER()).toNumber();

    const fxsExposure = new Exposure__factory(owner).attach(fxsExposureAddr);

    const noopLiquidator = await new NoopVaultedTempleLiquidator__factory(owner).deploy(templeToken.address, await opsManager.vaultedTemple());
    await opsManager.setExposureLiquidator(fxsToken.address, noopLiquidator.address);
    templeToken.addMinter(noopLiquidator.address);

    const alanAddr = await alan.getAddress();
    const benAddr = await ben.getAddress();

    // Deposit temple into the current open vault
    // Phase 1 - start of day 0
    
    await addDepositToVaults(vault1, toAtto(75), toAtto(25));
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
    expect((await vault1.inEnterExitWindow()).inWindow).false;
    expect((await vault2.inEnterExitWindow()).inWindow).true;

    // Add deposits to vault 2
    await addDepositToVaults(vault2, toAtto(75), toAtto(25));
    expect(await vault1.balanceOf(alanAddr)).equals(toAtto(75));
    expect(await vault1.balanceOf(benAddr)).equals(toAtto(25));

    // Start of day 8 pt 4 - accounting for how much of each exposure generated by primary revenue is alloc to each vault
    await opsManager.addRevenue([fxsToken.address], [toAtto(10000)]);
    await opsManager.rebalance([vault1Addr, vault3Addr, vault4Addr], fxsToken.address);
    expect(await fxsExposure.balanceOf(vault1Addr)).equals(toAtto(10000)); // 10000/1
    expect(await fxsExposure.balanceOf(vault2Addr)).equals(toAtto(0));
    expect(await fxsExposure.balanceOf(vault3Addr)).equals(toAtto(0));
    expect(await fxsExposure.balanceOf(vault4Addr)).equals(toAtto(0));

    // Start of day 8 pt 5 - call rebalance to keep accounting synced on chain
    //await opsManager.rebalance([vault1Addr], fxsToken.address);

    // For brevity, will skip Start of days 15 & 22
    await mineForwardSeconds(enterExitWindowPeriod+ENTER_EXIT_BUFFER);

    await opsManager.rebalance([vault1Addr, vault2Addr, vault4Addr], fxsToken.address);
    await opsManager.addRevenue([fxsToken.address], [toAtto(10000)]);
    await opsManager.rebalance([vault1Addr, vault2Addr, vault4Addr], fxsToken.address);
    expect(await fxsExposure.balanceOf(vault1Addr)).equals(toAtto(15000)); //10000+(10000/2)
    expect(await fxsExposure.balanceOf(vault2Addr)).equals(toAtto(5000)); // 10000/2
    expect(await fxsExposure.balanceOf(vault3Addr)).equals(toAtto(0)); // no deposits
    expect(await fxsExposure.balanceOf(vault4Addr)).equals(toAtto(0)); // no deposits


    await addDepositToVaults(vault3, toAtto(75), toAtto(25));
    expect(await vault3.balanceOf(alanAddr)).equals(toAtto(75));
    expect(await vault3.balanceOf(benAddr)).equals(toAtto(25));
    await mineForwardSeconds(enterExitWindowPeriod+ENTER_EXIT_BUFFER);

    await opsManager.rebalance([vault1Addr, vault2Addr, vault3Addr], fxsToken.address);
    await opsManager.addRevenue([fxsToken.address], [toAtto(10000)]);
    await opsManager.rebalance([vault1Addr, vault2Addr, vault3Addr], fxsToken.address);
    expect(fromAtto(await fxsExposure.balanceOf(vault1Addr))).approximately(18333.3, 1e-1); // 15000 + 10000/3
    expect(fromAtto(await fxsExposure.balanceOf(vault2Addr))).approximately(8333.3, 1e-1); // 5000 + 10000/3
    expect(fromAtto(await fxsExposure.balanceOf(vault3Addr))).approximately(3333.3, 1e-1); // 10000/3
    expect(await fxsExposure.balanceOf(vault4Addr)).equals(toAtto(0)); // no deposits

    await addDepositToVaults(vault4, toAtto(300), toAtto(100));
    expect(await vault4.balanceOf(alanAddr)).equals(toAtto(300));
    expect(await vault4.balanceOf(benAddr)).equals(toAtto(100));

    // Start of day 28 pt 2 - just before we get to enter exit window, liquidate exposures
    await mineForwardSeconds(enterExitWindowPeriod+ENTER_EXIT_BUFFER);

    await opsManager.rebalance([vault2Addr, vault3Addr, vault4Addr], fxsToken.address);
    await opsManager.addRevenue([fxsToken.address], [toAtto(10000)]);
    await opsManager.rebalance([vault2Addr, vault3Addr, vault4Addr], fxsToken.address);
    expect(fromAtto(await fxsExposure.balanceOf(vault1Addr))).approximately(18333.3, 1e-1); // 18333 - no rev share this time, as in window //
    expect(fromAtto(await fxsExposure.balanceOf(vault2Addr))).approximately(9761.9, 1e-1); // 
    expect(fromAtto(await fxsExposure.balanceOf(vault3Addr))).approximately(4761.9, 1e-1); 
    expect(fromAtto(await fxsExposure.balanceOf(vault4Addr))).approximately(5714.2, 1e-1); 

    const vaultedTempleAddr = await opsManager.vaultedTemple();
    let templeAmount = await fxsExposure.balanceOf(vault1Addr)
    // liquidate a vaults exposure
    await opsManager.liquidateExposures([vault1Addr],[fxsToken.address]);
    expect(fromAtto(await templeToken.balanceOf(vaultedTempleAddr))).approximately(19033.3, 1e-1) // 18333+400+100+100+100

    // Start of day 28 pt 6
    await opsManager.increaseVaultTemple([vault1Addr],[templeAmount]);
    
    expect(fromAtto(await vault1.balanceOf(alanAddr))).approximately(13825, 1e-1); //((18333/4)*3)+75
    expect(fromAtto(await vault1.balanceOf(benAddr))).approximately(4608.3, 1e-1); //(18333/4)+25
    expect(await vault2.balanceOf(alanAddr)).equals(toAtto(75));
    expect(await vault2.balanceOf(benAddr)).equals(toAtto(25));
    expect(await vault3.balanceOf(alanAddr)).equals(toAtto(75));
    expect(await vault3.balanceOf(benAddr)).equals(toAtto(25));
    expect(await vault4.balanceOf(alanAddr)).equals(toAtto(300));
    expect(await vault4.balanceOf(benAddr)).equals(toAtto(100));

    // For brevity, just skip to day 8 of week 2
    // Start of day 28 pt 2 - just before we get to enter exit window, liquidate exposures
    await mineForwardSeconds(enterExitWindowPeriod+ENTER_EXIT_BUFFER);

    templeAmount = await fxsExposure.balanceOf(vault2Addr)
    // liquidate a vaults exposure
    await opsManager.liquidateExposures([vault2Addr],[fxsToken.address]);
    expect(fromAtto(await templeToken.balanceOf(vaultedTempleAddr))).approximately(28795.2, 1e-1) // 19033+9761

    // Start of day 28 pt 6
    await opsManager.increaseVaultTemple([vault2Addr],[templeAmount]);
    
    expect(fromAtto(await vault1.balanceOf(alanAddr))).approximately(13825, 1e-1); //((18333/4)*3)+75
    expect(fromAtto(await vault1.balanceOf(benAddr))).approximately(4608.3, 1e-1); //(18333/4)+25
    expect(fromAtto(await vault2.balanceOf(alanAddr))).approximately(7396.4, 1e-1); //((9761/4)*3)+25 
    expect(fromAtto(await vault2.balanceOf(benAddr))).approximately(2465.4, 1e-1); //((9761/4))+25
    expect(await vault3.balanceOf(alanAddr)).equals(toAtto(75));
    expect(await vault3.balanceOf(benAddr)).equals(toAtto(25));
    expect(await vault4.balanceOf(alanAddr)).equals(toAtto(300));
    expect(await vault4.balanceOf(benAddr)).equals(toAtto(100));

    // vault 3
    // For brevity, just skip to day 8 of week 2
    // Start of day 28 pt 2 - just before we get to enter exit window, liquidate exposures
    await mineForwardSeconds(enterExitWindowPeriod+ENTER_EXIT_BUFFER);

    templeAmount = await fxsExposure.balanceOf(vault3Addr)
    // liquidate a vaults exposure
    await opsManager.liquidateExposures([vault3Addr],[fxsToken.address]);
    expect(fromAtto(await templeToken.balanceOf(vaultedTempleAddr))).approximately(33557.1, 1e-1) // 28795.2+4761.9

    // Start of day 28 pt 6
    await opsManager.increaseVaultTemple([vault3Addr],[templeAmount]);
    
    expect(fromAtto(await vault1.balanceOf(alanAddr))).approximately(13825, 1e-1); //((18333/4)*3)+75
    expect(fromAtto(await vault1.balanceOf(benAddr))).approximately(4608.3, 1e-1); //(18333/4)+25
    expect(fromAtto(await vault2.balanceOf(alanAddr))).approximately(7396.4, 1e-1); //((9761/4)*3)+75 
    expect(fromAtto(await vault2.balanceOf(benAddr))).approximately(2465.4, 1e-1); //((9761/4))+25
    expect(fromAtto(await vault3.balanceOf(alanAddr))).approximately(3646.4, 1e-1); //((4761/4)*3)+75
    expect(fromAtto(await vault3.balanceOf(benAddr))).approximately(1215.4, 1e-1); //((4761/4))+75
    expect(await vault4.balanceOf(alanAddr)).equals(toAtto(300));
    expect(await vault4.balanceOf(benAddr)).equals(toAtto(100));

    // vault 4
    // For brevity, just skip to day 8 of week 2
    // Start of day 28 pt 2 - just before we get to enter exit window, liquidate exposures
    await mineForwardSeconds(enterExitWindowPeriod+ENTER_EXIT_BUFFER);

    templeAmount = await fxsExposure.balanceOf(vault4Addr)
    // liquidate a vaults exposure
    await opsManager.liquidateExposures([vault4Addr],[fxsToken.address]);
    expect(fromAtto(await templeToken.balanceOf(vaultedTempleAddr))).approximately(39271.4, 1e-1) // 33557.2+5714.2

    // Start of day 28 pt 6
    await opsManager.increaseVaultTemple([vault4Addr],[templeAmount]);
    
    expect(fromAtto(await vault1.balanceOf(alanAddr))).approximately(13825, 1e-1); //((18333/4)*3)+75
    expect(fromAtto(await vault1.balanceOf(benAddr))).approximately(4608.3, 1e-1); //(18333/4)+25
    expect(fromAtto(await vault2.balanceOf(alanAddr))).approximately(7396.4, 1e-1); //((9761/4)*3)+75 
    expect(fromAtto(await vault2.balanceOf(benAddr))).approximately(2465.4, 1e-1); //((9761/4))+25
    expect(fromAtto(await vault3.balanceOf(alanAddr))).approximately(3646.4, 1e-1); //((4761/4)*3)+75
    expect(fromAtto(await vault3.balanceOf(benAddr))).approximately(1215.4, 1e-1); //((4761/4))+75
    expect(fromAtto(await vault4.balanceOf(alanAddr))).approximately(4585.7, 1e-1);//((5714/4)*3)+300
    expect(fromAtto(await vault4.balanceOf(benAddr))).approximately(1528.5, 1e-1); //((5714/4)*1)+100
  })

  async function addDepositToVaults(vault: Vault, amountAlan: BigNumber, amountBen: BigNumber) {
    await templeToken.connect(alan).approve(vault.address, toAtto(100000));
    await vault.connect(alan).deposit(amountAlan);

    await templeToken.connect(ben).approve(vault.address, toAtto(1000000));
    await vault.connect(ben).deposit(amountBen);
  }
})

