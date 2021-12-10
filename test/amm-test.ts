import { ethers, hardhatArguments } from "hardhat";
import { expect } from "chai";

import { FakeERC20, FakeERC20__factory, TempleAMMFactory, TempleAMMFactory__factory, TempleERC20Token, TempleERC20Token__factory, TempleRouter, TempleRouter__factory, TempleTreasury, TempleTreasury__factory } from "../typechain";

import {UniswapV2Pair} from "../typechain/UniswapV2Pair";
import {UniswapV2Pair__factory} from "../typechain/factories/UniswapV2Pair__factory"

import { Signer } from "ethers";
import { toAtto } from "./helpers";

import { fromAtto } from "../scripts/deploys/helpers";


describe("AMM", async () => {
    let TEMPLE: TempleERC20Token;
    let STABLEC: FakeERC20;
    let templeRouter: TempleRouter;
    let TREASURY: TempleTreasury;
    let owner: Signer;
    let recipient: Signer;
    let nonOwner: Signer
    let factory: TempleAMMFactory;
    let pairContract: UniswapV2Pair;
    let expiryDate: number =  Math.floor(Date.now() / 1000) + 900;
   
    beforeEach(async () => {
      [owner, recipient, nonOwner] = await ethers.getSigners();

      TEMPLE = await new TempleERC20Token__factory(owner).deploy();
      STABLEC = await new FakeERC20__factory(owner).deploy("STABLEC", "STABLEC");

      TREASURY = await new TempleTreasury__factory(owner).deploy(
        TEMPLE.address,
        STABLEC.address,
      );

      await TEMPLE.addMinter(await owner.getAddress()),
      await Promise.all([
        STABLEC.mint(await owner.getAddress(), toAtto(100000)),
        TEMPLE.mint(await owner.getAddress(), toAtto(100000)),
      ]);

      factory = await new TempleAMMFactory__factory(owner).deploy(await owner.getAddress(), TEMPLE.address);
      await factory.createPair(TEMPLE.address, STABLEC.address);
      let pairAddress = await factory.getPair(TEMPLE.address, STABLEC.address);
      pairContract = UniswapV2Pair__factory.connect(pairAddress, owner)
      templeRouter = await new TempleRouter__factory(owner).deploy(pairAddress, TREASURY.address, {numerator: 6, denominator: 1}, 80)
      await pairContract.setManager(templeRouter.address);
      await TEMPLE.addMinter(templeRouter.address);
    })

    it("Factory", async() => {
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