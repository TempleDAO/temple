import { ethers, hardhatArguments } from "hardhat";
import { expect } from "chai";

import { FakeERC20, FakeERC20__factory, TempleERC20Token, TempleERC20Token__factory, TempleFraxAMMRouter, TempleFraxAMMRouter__factory, TempleTreasury, TempleTreasury__factory, TempleUniswapV2Pair, TempleUniswapV2Pair__factory, UniswapV2Factory, UniswapV2Factory__factory, UniswapV2Router02NoEth, UniswapV2Router02NoEth__factory } from "../typechain";

import { BigNumber, Signer } from "ethers";
import { toAtto } from "./helpers";

import { fromAtto } from "../scripts/deploys/helpers";
import { factory } from "typescript";


describe("AMM", async () => {
    let templeToken: TempleERC20Token;
    let fraxToken: FakeERC20;
    let treasury: TempleTreasury;
    let owner: Signer;
    let alan: Signer;
    let ben: Signer
    let pair: TempleUniswapV2Pair;
    let templeRouter: TempleFraxAMMRouter;
    let uniswapRouter: UniswapV2Router02NoEth;
    let expiryDate: number =  Math.floor(Date.now() / 1000) + 900;
   
    beforeEach(async () => {
      [owner, alan, ben] = await ethers.getSigners();

      templeToken = await new TempleERC20Token__factory(owner).deploy();
      fraxToken = await new FakeERC20__factory(owner).deploy("STABLEC", "STABLEC");

      treasury = await new TempleTreasury__factory(owner).deploy(
        templeToken.address,
        fraxToken.address,
      );

      await templeToken.addMinter(await owner.getAddress()),

      await Promise.all([
        fraxToken.mint(await owner.getAddress(), toAtto(100000)),
        templeToken.mint(await owner.getAddress(), toAtto(100000)),
      ]);

      pair = await new TempleUniswapV2Pair__factory(owner).deploy(await owner.getAddress(), templeToken.address, fraxToken.address);
      templeRouter = await new TempleFraxAMMRouter__factory(owner).deploy(
        pair.address,
        templeToken.address,
        fraxToken.address,
        treasury.address,
        {frax: 1000000, temple: 4000000},
        100000, /* threshold decay per block */
        {frax: 1000000, temple: 1000000},
        {frax: 1000000, temple: 12000000},
      );

      await pair.setRouter(templeRouter.address);
      await templeToken.addMinter(templeRouter.address);

      // Create a stock standard uniswap, so we can compare our AMM against the standard constant product AMM
      const uniswapFactory: UniswapV2Factory = await new UniswapV2Factory__factory(owner).deploy(await owner.getAddress())

      uniswapRouter = await new UniswapV2Router02NoEth__factory(owner).deploy(uniswapFactory.address, fraxToken.address);
      console.log("HERE");
    })

    it("Happy path user flows", async() => {
        // await factory.connect(recipient).createPair(TEMPLE.address, STABLEC.address);
        
        it("permission", async() => {
           
        })
    })

    // it("pair contract", async () => {
    //     expect(await pairContract.token0()).to.eq(TEMPLE.address)
    //     expect(await pairContract.token1()).to.eq(STABLEC.address)
    //     expect(await pairContract.owner()).to.eq(await owner.getAddress())
    // })
  
    // it("buy above target price", async () => {

    //     await TEMPLE.approve(templeRouter.address, toAtto(10000))
    //     await STABLEC.approve(templeRouter.address, toAtto(60000))
    //     await templeRouter.addLiquidity(toAtto(10000), toAtto(60000), toAtto(10000), toAtto(60000), await owner.getAddress(), expiryDate);

    //     await STABLEC.approve(templeRouter.address, toAtto(1000))
    //     await templeRouter.buyTemple(toAtto(1000), toAtto(160), await recipient.getAddress(), expiryDate)

    //     console.log(fromAtto(await TEMPLE.balanceOf(await recipient.getAddress())))

    // });

    //   
    // it("buy in range", async () => {

  
    // });

    // it("sell below target", async () => {
  
    // });

})