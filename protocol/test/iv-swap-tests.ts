import { ethers } from "hardhat";
import { expect } from "chai";

import {
  FakeERC20,
  FakeERC20__factory,
  TempleERC20Token,
  TempleERC20Token__factory,
  TempleIVSwap,
  TempleIVSwap__factory,
} from "../typechain";

import { BigNumber, Signer } from "ethers";
import { toAtto, shouldThrow, blockTimestamp, fromAtto } from "./helpers";

const fmtPricePair = (pair: [BigNumber, BigNumber, number?]): [number, number] => {
  return [fromAtto(pair[0]), fromAtto(pair[1])]
}
const fmtTemplePrice = (pair: [BigNumber, BigNumber, number?]): number => {
  return fromAtto(pair[1])/fromAtto(pair[0]);
}

describe("AMM", async () => {
    let templeToken: TempleERC20Token;
    let fraxToken: FakeERC20;
    let ivSwap: TempleIVSwap;
    let owner: Signer;
    let alan: Signer;
    let bret: Signer;

    const expiryDate = (): number =>  Math.floor(Date.now() / 1000) + 9000;
    
    before(async () => {
        await ethers.provider.send("hardhat_reset", []);
    })

    beforeEach(async () => {
      [owner, alan, bret] = await ethers.getSigners();

      templeToken = await new TempleERC20Token__factory(owner).deploy();
      fraxToken = await new FakeERC20__factory(owner).deploy("FRAX", "FRAX");
      ivSwap = await new TempleIVSwap__factory(owner).deploy(
        templeToken.address, 
        fraxToken.address, 
        {temple: 100, frax: 65}
      )

      await templeToken.addMinter(await owner.getAddress()),

      await Promise.all([
        fraxToken.mint(await owner.getAddress(), toAtto(100000000)),
        templeToken.mint(await owner.getAddress(), toAtto(100000000)),
        templeToken.mint(await alan.getAddress(), toAtto(100000000)),
      ]);
    })

    it("Swap when no frax should crash", async() => {
      await shouldThrow(ivSwap.connect(alan).swapTempleForIV(toAtto(100), await alan.getAddress(), expiryDate()), /ERC20: transfer amount exceeds allowance/);
    })

    it("Swap after deadline should fail", async() => {
      await shouldThrow(ivSwap.connect(alan).swapTempleForIV(toAtto(100), await alan.getAddress(), Math.floor(Date.now() / 1000) - 1000), /TempleIVSwap: EXPIRED/);
    })

    it("Swap with no temple should fail", async() => {
      await templeToken.connect(bret).approve(ivSwap.address, toAtto(200));
      await shouldThrow(ivSwap.connect(bret).swapTempleForIV(toAtto(100), await alan.getAddress(), expiryDate()), /ERC20: transfer amount exceeds balance/);
    })

    it("Swap with insufficient allowance should fail", async() => {
      await templeToken.connect(alan).approve(ivSwap.address, toAtto(200));
      await shouldThrow(ivSwap.connect(alan).swapTempleForIV(toAtto(1000), await alan.getAddress(), expiryDate()), /ERC20: transfer amount exceeds allowance/);
    })

    it("Swap when funded, expect frax @ IV", async() => {
      // do swaps
      await fraxToken.transfer(ivSwap.address, toAtto(10000));
      await templeToken.connect(alan).approve(ivSwap.address, toAtto(200));
      await ivSwap.connect(alan).swapTempleForIV(toAtto(200), await alan.getAddress(), expiryDate());
      expect(fromAtto(await templeToken.balanceOf(ivSwap.address))).eq(200);
      expect(fromAtto(await fraxToken.balanceOf(await alan.getAddress()))).eq(130);
    })

    it("Only owner can burn, withdraw and setIV", async() => {
      await shouldThrow(ivSwap.connect(alan).burnTemple(toAtto(100)), /Ownable: caller is not the owner/);
      await shouldThrow(ivSwap.connect(alan).setIV(30, 100), /Ownable: caller is not the owner/);
      await shouldThrow(ivSwap.connect(alan).withdraw(fraxToken.address, await owner.getAddress(), toAtto(100)), /Ownable: caller is not the owner/);
    })

    it("check burn, withdraw and setIV", async() => {
      await fraxToken.transfer(ivSwap.address, toAtto(1000));
      await templeToken.transfer(ivSwap.address, toAtto(1000));

      // burn
      await ivSwap.burnTemple(toAtto(100));
      expect(fromAtto(await templeToken.balanceOf(ivSwap.address))).eq(900);

      // transfer
      await ivSwap.withdraw(templeToken.address, await bret.getAddress(), toAtto(100));
      expect(fromAtto(await templeToken.balanceOf(ivSwap.address))).eq(800);
      expect(fromAtto(await templeToken.balanceOf(await bret.getAddress()))).eq(100);

      await ivSwap.withdraw(fraxToken.address, await bret.getAddress(), toAtto(100));
      expect(fromAtto(await fraxToken.balanceOf(ivSwap.address))).eq(900);
      expect(fromAtto(await fraxToken.balanceOf(await bret.getAddress()))).eq(100);

      // set IV
      await ivSwap.setIV(30, 90);
      expect((await ivSwap.iv()).frax).eq(30);
      expect((await ivSwap.iv()).temple).eq(90);
    })
  })
