import { ethers } from "hardhat";
import { blockTimestamp, deployAndAirdropTemple, fromAtto, NULL_ADDR, toAtto } from "../helpers";
import { Signer } from "ethers";
import { 
  FakeERC20,
  FakeERC20__factory,
  JoiningFee,
  JoiningFee__factory,
  OpsManager,
  OpsManager__factory,
  TempleERC20Token,
} from "../../typechain";

describe("Temple Core Ops Manager", async () => {
  let opsManager: OpsManager;
  let templeToken: TempleERC20Token;
  let joiningFee: JoiningFee;

  let fxsToken: FakeERC20;
  let crvToken: FakeERC20;

  let owner: Signer;
  let alan: Signer;
  let ben: Signer;

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
    await opsManager.createExposure("Temple FXS Exposure", "TE-FXS", fxsToken.address);
    await opsManager.createExposure("Temple CRV Exposure", "TE-CRV", crvToken.address);

    // TODO... Check it created exposures
  })

  it("Create new vaults", async () => {
    const firstVaultstartTime = await blockTimestamp()

    await opsManager.createVaultInstance(
      "temple-1d-vault",
      "TV-1D-1",
      86400,
      3600,
      {p: 1, q: 1},
      firstVaultstartTime,
    )

    await opsManager.createVaultInstance(
      "temple-1d-vault",
      "TV-1D-1",
      86400,
      3600,
      {p: 1, q: 1},
      firstVaultstartTime + 3600,
    )

    // TODO... Check it created vaults
  })

  it("End to end flow", async () => {
    const firstVaultstartTime = await blockTimestamp()

    // create some vaults
    await opsManager.createVaultInstance(
      "temple-1d-vault",
      "TV-1D-1",
      86400,
      3600,
      {p: 1, q: 1},
      firstVaultstartTime,
    )

    await opsManager.createVaultInstance(
      "temple-1d-vault",
      "TV-1D-1",
      86400,
      3600,
      {p: 1, q: 1},
      firstVaultstartTime + 3600,
    )

    // create two exposures as a result of our farming activities
    await opsManager.createExposure("Temple FXS Exposure", "TE-FXS", fxsToken.address);
    await opsManager.createExposure("Temple CRV Exposure", "TE-CRV", crvToken.address);

    // Deposit temple into the current open vault
    // TODO...

    // Fast forward to close vault, and rebalance open vault
    // with revenue share. Before callign rebalance, check
    // which vaults require a rebalance
    // TODO implement + check shares are as we expect

    // Add revenue to each each exposure
    // TODO implement + check unclaimed revenue is as expected

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

