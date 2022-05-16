import { ethers } from "hardhat";
import { blockTimestamp, deployAndAirdropTemple, fromAtto, mineForwardSeconds, NULL_ADDR, toAtto } from "../helpers";
import { ContractTransaction, Event, Signer } from "ethers";
import {
  Exposure__factory,
  FakeERC20,
  FakeERC20__factory,
  JoiningFee,
  JoiningFee__factory,
  OpsManager,
  OpsManager__factory,
  TempleERC20Token,
  TempleERC20Token__factory,
  Vault__factory,
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
    expect(await opsManager.activeExposures(0)).equals(exposure1Addr)

    // Check deployed exposure matches what we expect
    const exposure1 = await new Exposure__factory(owner).attach(exposure1Addr);
    expect (await exposure1.name()).equals("Temple FXS Exposure");
    expect (await exposure1.symbol()).equals("TE-FXS");
    expect (await exposure1.revalToken()).equals(fxsToken.address);

    expect(evt2.args!!.exposure).not.empty;
    expect(evt2.args!!.primaryRevenue).not.empty;
    const exposure2Addr = evt2.args!!.exposure;
    expect(await opsManager.pools(crvToken.address)).equals(evt2.args!!.primaryRevenue);
    expect(await opsManager.activeExposures(1)).equals(exposure2Addr)

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

  it("End to end flow", async () => {
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

    const vault2Addr = (await extractEvent(await opsManager.createVaultInstance(
      "temple-1d-vault",
      "TV-1D-1",
      86400,
      3600,
      {p: 1, q: 1},
      firstVaultstartTime + 3600,
    ), "CreateVaultInstance",1,0)).args!!.vault;

    // create two exposures as a result of our farming activities
    const fxsExposureAddr = (await extractEvent(await opsManager.createExposure(
      "Temple FXS Exposure",
      "TE-FXS",
      fxsToken.address
    ), "CreateExposure", 1, 0)).args!!.exposure;

    const crvExposureAddr = (await extractEvent(await opsManager.createExposure(
      "Temple CRV Exposure",
      "TE-CRV",
      crvToken.address
    ), "CreateExposure", 1, 0)).args!!.exposure;

    const vault1Alan = await new Vault__factory(alan).attach(vault1Addr);
    const vault2Alan = await new Vault__factory(alan).attach(vault2Addr);
    const templeTokenAlan = await new TempleERC20Token__factory(alan).attach(templeToken.address);

    const vault1Ben = await new Vault__factory(ben).attach(vault1Addr);
    const vault2Ben = await new Vault__factory(ben).attach(vault2Addr);
    const templeTokenBen = await new TempleERC20Token__factory(ben).attach(templeToken.address);

    const fxsExposure = await new Exposure__factory(owner).attach(fxsExposureAddr);
    const crvExposure = await new Exposure__factory(owner).attach(crvExposureAddr);

    const alanAddr = await alan.getAddress();
    const benAddr = await ben.getAddress();

    // Deposit temple into the current open vault

    await templeTokenAlan.increaseAllowance(vault1Alan.address, toAtto(100000));
    await vault1Alan.deposit(toAtto(10000));

    await templeTokenBen.increaseAllowance(vault1Ben.address, toAtto(100000));
    await vault1Ben.deposit(toAtto(50000));

    // Fast forward to close vault, and rebalance open vault
    // with revenue share. Before callign rebalance, check
    // which vaults require a rebalance
    // TODO implement + check shares are as we expect

    let needRebal = await opsManager.requiresRebalance([vault1Addr, vault2Addr], fxsToken.address);
    await mineForwardSeconds(3601 + 300); // just make sure vault1 is closed [account for buffer (300s)]
    needRebal = await opsManager.requiresRebalance([vault1Addr, vault2Addr], fxsToken.address);
    expect (needRebal).to.eql([true, false]);

    opsManager.rebalance([vault1Addr], fxsToken.address);

    // TODO: Scoop finish
    // Add revenue to each each exposure
    // TODO implement + check unclaimed revenue is as expected
    //opsManager.addRevenue([fxsToken.address], [toAtto(10000)]);

    // where do we check shares?


    // Claim a vaults share of primary revenue, via the
    // rebalance method
    // TODO implement + check unclaimed revenue is as expected

    // Claim a vaults share of primary revenue, via the
    // rebalance method
    // TODO implement + check unclaimed revenue is as expected

    // liquidate a vaults exposure
    // TODO implement - for now just confirm the necessary
    // events fire so we can do this process manually
  })
})

