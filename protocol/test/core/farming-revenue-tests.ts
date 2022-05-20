import { ethers } from "hardhat";
import { expect } from "chai";
import { fromAtto, NULL_ADDR, toAtto } from "../helpers";
import { BigNumber, Signer } from "ethers";
import { 
  Exposure,
  Exposure__factory,
  TreasuryFarmingRevenue,
  TreasuryFarmingRevenue__factory,
} from "../../typechain";
import { mkRebasingERC20TestSuite } from "./rebasing-erc20-testsuite";

describe("Temple Core Farming Revenue Allocation", async () => {
  let exposure: Exposure;
  let farmingRevenue: TreasuryFarmingRevenue;

  let owner: Signer;
  let alan: Signer;
  let ben: Signer;
  let minterManager: Signer;

  beforeEach(async () => {
    [owner, alan, ben, minterManager] = await ethers.getSigners();

    exposure = await new Exposure__factory(owner).deploy(
        "Test Exposure",
        "TE_FXS",
        NULL_ADDR,
        await minterManager.getAddress(),
    );

    farmingRevenue = await new TreasuryFarmingRevenue__factory(owner).deploy(
      exposure.address
    )

    await exposure.setMinterState(farmingRevenue.address, true);
  });

  it("Only owner can add revenue", async () => {
    await expect(farmingRevenue.connect(alan).addRevenue(toAtto(100)))
      .to.revertedWith("Ownable: caller is not the owner");
  })

  it("Only owner can change an accounts share of farming revenue", async () => {
    await expect(farmingRevenue.connect(alan).increaseShares(await alan.getAddress(), toAtto(100)))
      .to.revertedWith("Ownable: caller is not the owner");

    await expect(farmingRevenue.connect(alan).decreaseShares(await alan.getAddress(), toAtto(100)))
      .to.revertedWith("Ownable: caller is not the owner");
  })

  describe("Revenue is distributed to various accounts by increasing their exposure", async () => {
    it("Claiming for an account with no shares should be a noop", async () => {
      await expect(async () => farmingRevenue.claimFor(await alan.getAddress()))
        .to.changeTokenBalance(exposure, alan, 0)
    })

    it("Single shareholder gets all added revenue", async () => {
      await farmingRevenue.increaseShares(await alan.getAddress(), toAtto(100));
      await farmingRevenue.addRevenue(toAtto(50));

      await expect(async () => farmingRevenue.claimFor(await alan.getAddress()))
        .to.changeTokenBalance(exposure, alan, toAtto(50));
    })

    it("Two shareholders should split revenue as per their % allocation", async () => {
      await farmingRevenue.increaseShares(await alan.getAddress(), toAtto(150));
      await farmingRevenue.increaseShares(await ben.getAddress(), toAtto(50));
      await farmingRevenue.addRevenue(toAtto(100));

      await expect(async () => {
        await farmingRevenue.claimFor(await alan.getAddress())
        await farmingRevenue.claimFor(await ben.getAddress())
      }).to.changeTokenBalances(exposure, [alan, ben], [toAtto(75), toAtto(25)]);
    })

    it("A change in shareholding should trigger a call to claim", async () => {
      await farmingRevenue.increaseShares(await alan.getAddress(), toAtto(50));
      await farmingRevenue.increaseShares(await ben.getAddress(), toAtto(50));
      await farmingRevenue.addRevenue(toAtto(100));

      await expect(async () => {
        await farmingRevenue.increaseShares(await ben.getAddress(), toAtto(150));
        await farmingRevenue.decreaseShares(await alan.getAddress(), toAtto(50));
      }).to.changeTokenBalances(exposure, [alan, ben], [toAtto(50), toAtto(50)]);
    })

    it("Revenue is immediately allocated to active shareholders", async () => {
      await farmingRevenue.increaseShares(await alan.getAddress(), toAtto(150));
      await farmingRevenue.increaseShares(await ben.getAddress(), toAtto(50));
      await farmingRevenue.addRevenue(toAtto(100));

      await expect(async () => {
        await farmingRevenue.increaseShares(await ben.getAddress(), toAtto(150));
        await farmingRevenue.claimFor(await alan.getAddress())
      }).to.changeTokenBalances(exposure, [alan, ben], [toAtto(75), toAtto(25)]);
    })

    it("Decreasing shares after revenue allocation shouldn't change claim", async () => {
      await farmingRevenue.increaseShares(await alan.getAddress(), toAtto(150));
      await farmingRevenue.increaseShares(await ben.getAddress(), toAtto(50));
      await farmingRevenue.addRevenue(toAtto(100));

      await expect(async () => {
        await farmingRevenue.decreaseShares(await alan.getAddress(), toAtto(100));
        await farmingRevenue.claimFor(await ben.getAddress())
      }).to.changeTokenBalances(exposure, [alan, ben], [toAtto(75), toAtto(25)]);
    })

    it("Any change in shares post revenue claim/before next revenue increase should be 0", async () => {
      await farmingRevenue.increaseShares(await alan.getAddress(), toAtto(100));
      await farmingRevenue.increaseShares(await ben.getAddress(), toAtto(100));
      await farmingRevenue.addRevenue(toAtto(100));

      await expect(async () => {
        await farmingRevenue.decreaseShares(await alan.getAddress(), toAtto(50));
        await farmingRevenue.increaseShares(await ben.getAddress(), toAtto(50))
      }).to.changeTokenBalances(exposure, [alan, ben], [toAtto(50), toAtto(50)]);

      await expect(async () => {
        await farmingRevenue.claimFor(await alan.getAddress())
        await farmingRevenue.claimFor(await ben.getAddress())
      }).to.changeTokenBalances(exposure, [alan, ben], [0, 0]);
    })

    it("Repeated share changes and claims are accounted for", async () => {
      await farmingRevenue.increaseShares(await alan.getAddress(), toAtto(150));
      await farmingRevenue.increaseShares(await ben.getAddress(), toAtto(50));

      await expect(async () => {
        await farmingRevenue.addRevenue(toAtto(100));
        await farmingRevenue.decreaseShares(await alan.getAddress(), toAtto(50));
        await farmingRevenue.increaseShares(await ben.getAddress(), toAtto(50));
      }).to.changeTokenBalances(exposure, [alan, ben], [toAtto(75), toAtto(25)]);


      await expect(async () => {
        await farmingRevenue.addRevenue(toAtto(100))
        await farmingRevenue.claimFor(await alan.getAddress());
        await farmingRevenue.claimFor(await ben.getAddress());
      }).to.changeTokenBalances(exposure, [alan, ben], [toAtto(50), toAtto(50)]);
    })
  })
})

