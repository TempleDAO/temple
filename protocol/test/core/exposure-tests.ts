import { ethers } from "hardhat";
import { expect } from "chai";
import { NULL_ADDR, toAtto } from "../helpers";
import { Signer } from "ethers";
import { 
  Exposure,
  Exposure__factory,
  IERC20,
  NoopLiquidator__factory,
  TempleERC20Token__factory,
} from "../../typechain";
import { mkRebasingERC20TestSuite } from "./rebasing-erc20-testsuite";

describe("Temple Core Exposures", async () => {
  let exposure: Exposure;

  let owner: Signer;
  let alan: Signer;
  let ben: Signer;

  beforeEach(async () => {
    [owner, alan, ben] = await ethers.getSigners();

    exposure = await new Exposure__factory(owner).deploy(
        "Test Exposure",
        "TE_FXS",
        NULL_ADDR);

    await exposure.setMinterState(await owner.getAddress(), true);
  });

  mkRebasingERC20TestSuite(async () => {
    await exposure.mint(await alan.getAddress(), toAtto(300));
    await exposure.mint(await ben.getAddress(), toAtto(300));

    return {
      accounts: [[alan, toAtto(300)], [ben, toAtto(300)]],
      token: exposure as unknown as IERC20,
      rebaseUp: async () => await exposure.increaseReval(toAtto(600)),
      rebaseDown: async () => await exposure.increaseReval(toAtto(200)),
    }
  })

  it("Only owner can set/change liquidator", async () => {
    await expect(exposure.connect(alan).setLiqidator(NULL_ADDR))
      .to.revertedWithCustomError(exposure, "OwnableUnauthorizedAccount").withArgs(await alan.getAddress());
  })

  it("Only owner can set/change minter state", async () => {
    await expect(exposure.connect(alan).setMinterState(await ben.getAddress(), true))
      .to.revertedWithCustomError(exposure, "OwnableUnauthorizedAccount").withArgs(await alan.getAddress());

    expect(await exposure.canMint(await ben.getAddress())).eq(false);
    await exposure.setMinterState(await ben.getAddress(), true)
    expect(await exposure.canMint(await ben.getAddress())).eq(true);
  })

  it("Only exposure balance holders can redeem", async () => {
    await expect(exposure.connect(alan).redeemAmount(1, await alan.getAddress())).
      to.be.revertedWithCustomError(exposure, "ERC20InsufficientBalance");
  })

  it("No liquidator by default (Event fired and tracked/handled manually)", async () => {
    await exposure.mint(await alan.getAddress(), toAtto(300))

     await expect(exposure.connect(alan).redeem())
       .to.emit(exposure, "Redeem")
       .withArgs(NULL_ADDR, await alan.getAddress(), await alan.getAddress(), toAtto(300));
  })

  it("Test liquidator results in temple back to Exposure share holder", async () => {
    const templeToken = await new TempleERC20Token__factory(owner).deploy()
    const noopLiquidator = await new NoopLiquidator__factory(owner)
      .deploy(templeToken.address);
    await templeToken.addMinter(noopLiquidator.address);

    await exposure.mint(await alan.getAddress(), toAtto(300))

    expect(exposure.connect(alan).redeem())
      .to.changeTokenBalance(templeToken, await alan.getAddress(), toAtto(300));
  })
})

