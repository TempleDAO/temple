import { ethers } from "hardhat";
import { expect } from "chai";

import {
  FakeERC20,
  FakeERC20__factory,
  TempleERC20Token,
  TempleERC20Token__factory,
  TempleStableAMMRouter,
  TempleStableAMMRouter__factory,
  TempleTreasury,
  TempleTreasury__factory,
  TempleUniswapV2Pair,
  TempleUniswapV2Pair__factory,
  UniswapV2Factory,
  UniswapV2Factory__factory,
  UniswapV2Pair,
  UniswapV2Pair__factory,
  UniswapV2Router02NoEth,
  UniswapV2Router02NoEth__factory,
} from "../typechain";

import { BigNumber, Signer } from "ethers";
import { mineNBlocks, toAtto, shouldThrow, blockTimestamp, fromAtto } from "./helpers";

const fmtPricePair = (pair: [BigNumber, BigNumber, number?]): [number, number] => {
  return [fromAtto(pair[0]), fromAtto(pair[1])]
}

const fmtTemplePrice = (pair: [BigNumber, BigNumber, number?]): number => {
  return fromAtto(pair[1])/fromAtto(pair[0]);
}

describe("AMM", async () => {
    let templeToken: TempleERC20Token;
    let fraxToken: FakeERC20;
    let feiToken: FakeERC20;
    let treasury: TempleTreasury;
    let owner: Signer;
    let alan: Signer;
    let ben: Signer
    let carol: Signer
    let pair: TempleUniswapV2Pair;
    let templeRouter: TempleStableAMMRouter;
    let uniswapFactory: UniswapV2Factory;
    let uniswapRouter: UniswapV2Router02NoEth;
    let uniswapPair: UniswapV2Pair;

    const expiryDate = (): number =>  Math.floor(Date.now() / 1000) + 9000;
   
    beforeEach(async () => {
      [owner, alan, ben, carol] = await ethers.getSigners();

      templeToken = await new TempleERC20Token__factory(owner).deploy();
      fraxToken = await new FakeERC20__factory(owner).deploy("STABLEC", "STABLEC");
      feiToken = await new FakeERC20__factory(owner).deploy("FEI", "FEI"); 

      await templeToken.addMinter(await owner.getAddress()),

      await Promise.all([
        fraxToken.mint(await owner.getAddress(), toAtto(100000000)),
        feiToken.mint(await owner.getAddress(), toAtto(100000000)),
        templeToken.mint(await owner.getAddress(), toAtto(100000000)),
      ]);

      treasury = await new TempleTreasury__factory(owner).deploy(
        templeToken.address,
        fraxToken.address,
      );

      await templeToken.addMinter(treasury.address),
      await fraxToken.increaseAllowance(treasury.address, toAtto(100));
      await treasury.seedMint(toAtto(100), toAtto(50));

      pair = await new TempleUniswapV2Pair__factory(owner).deploy(await owner.getAddress(), templeToken.address, fraxToken.address);
      templeRouter = await new TempleStableAMMRouter__factory(owner).deploy(
        templeToken.address,
        treasury.address,
        fraxToken.address,
      );

      await Promise.all([
        pair.setRouter(templeRouter.address),
        templeToken.addMinter(templeRouter.address),
        templeRouter.addPair(fraxToken.address, pair.address)
      ])


      // Create a stock standard uniswap, so we can compare our AMM against the standard constant product AMM
      uniswapFactory = await new UniswapV2Factory__factory(owner).deploy(await owner.getAddress())
      uniswapRouter = await new UniswapV2Router02NoEth__factory(owner).deploy(uniswapFactory.address, fraxToken.address);

      // Add liquidity to both AMMs
      await templeToken.increaseAllowance(templeRouter.address, toAtto(10000000));
      await fraxToken.increaseAllowance(templeRouter.address, toAtto(10000000));
      await templeRouter.addLiquidity(toAtto(100000), toAtto(1000000), 1, 1, fraxToken.address, await owner.getAddress(), expiryDate());

      await templeToken.increaseAllowance(uniswapRouter.address, toAtto(10000000));
      await fraxToken.increaseAllowance(uniswapRouter.address, toAtto(10000000));
      await uniswapRouter.addLiquidity(templeToken.address, fraxToken.address, toAtto(100000), toAtto(1000000), 1, 1, await owner.getAddress(), expiryDate());
      uniswapPair = new UniswapV2Pair__factory(owner).attach(await uniswapFactory.getPair(templeToken.address, fraxToken.address));


    })

    describe("Buy", async() => {

      it("Invaid stablec throws error", async () => {
            await shouldThrow(templeRouter.swapExactStableForTemple(toAtto(100), 1, await ben.getAddress(), await alan.getAddress(), expiryDate()), /TempleStableAMMRouter: UNSUPPORTED_PAIR/);
      })
      
      it("Buy should be the same as regualar amm buy", async() => {

        // do swaps
        await uniswapRouter.swapExactTokensForTokens(toAtto(100), 1, [fraxToken.address, templeToken.address], await ben.getAddress(), expiryDate());
        await templeRouter.swapExactStableForTemple(toAtto(100), 1, fraxToken.address, await alan.getAddress(), expiryDate());

        // Expect reserves to match
        expect(fmtPricePair(await pair.getReserves()))
          .eql(fmtPricePair(await uniswapRouter.getReserves(templeToken.address, fraxToken.address)));

        // Expect reserves to match
        expect(fmtPricePair(await pair.getReserves()))
            .eql(fmtPricePair(await uniswapRouter.getReserves(templeToken.address, fraxToken.address)));

        // Expect temple balances to match
        expect(fromAtto(await templeToken.balanceOf(await alan.getAddress())))
          .eq(fromAtto(await templeToken.balanceOf(await ben.getAddress())))
      })

    });

    describe("Sell", async() => {

       it("Invalid stablec throws error", async () => {
            await shouldThrow(templeRouter.swapExactTempleForStable(toAtto(100), 1, await ben.getAddress(), await alan.getAddress(), expiryDate()), /TempleStableAMMRouter: UNSUPPORTED_PAIR/);
       })

      it("Fully Above IV sells should be same as on AMM", async() => {
        // do swaps
        await uniswapRouter.swapExactTokensForTokens(toAtto(100), 1, [templeToken.address, fraxToken.address], await ben.getAddress(), expiryDate());
        await templeRouter.swapExactTempleForStable(toAtto(100), 1, fraxToken.address, await alan.getAddress(), expiryDate());

        // Expect reserves to match
        expect(fmtPricePair(await pair.getReserves()))
          .eql(fmtPricePair(await uniswapRouter.getReserves(templeToken.address, fraxToken.address)));

        // Expect temple balances to match
        expect(fromAtto(await templeToken.balanceOf(await alan.getAddress())))
          .eq(fromAtto(await templeToken.balanceOf(await ben.getAddress())))
      })

      it("Sell to bring below IV sells should always be at IV", async() => {
        // fund router with some frax (for use when price is below IV)
        await fraxToken.transfer(templeRouter.address, toAtto(2000000));

        const [rTemple0, rFrax0] = fmtPricePair(await pair.getReserves());

        //sell enough temple to bring price below IV
        await templeRouter.swapExactTempleForStable(toAtto(900000), 1, fraxToken.address,  await alan.getAddress(), expiryDate());
        await uniswapRouter.swapExactTokensForTokens(toAtto(900000), 1, [templeToken.address, fraxToken.address], await ben.getAddress(), expiryDate());

        // // Expect price to be above IV
        const [ivFrax, ivTemple] = fmtPricePair(await treasury.intrinsicValueRatio());
        const [rTemple, rFrax] = fmtPricePair(await pair.getReserves());
        expect(rFrax / rTemple).gte(ivFrax / ivTemple);


        // Expect pair reserve to not change and swap to happen on IV
        expect(rFrax / rTemple).eq(rFrax0 / rTemple0);
        expect(fromAtto(await fraxToken.balanceOf(await alan.getAddress()))).eq(900000 * ivFrax / ivTemple);
        
      })


      it("Sell below IV should use what ever defend token is set to ", async() => {
        // fund router with some frax and fei (for use when price is below IV)
        await Promise.all([
          fraxToken.transfer(templeRouter.address, toAtto(2000000)),
          feiToken.transfer(templeRouter.address, toAtto(2000000)),
          templeRouter.setDefendStable(feiToken.address),
        ])

        //sell enough temple to bring price below IV
        await templeRouter.swapExactTempleForStable(toAtto(900000), 1, fraxToken.address,  await alan.getAddress(), expiryDate());

        const [ivFrax, ivTemple] = fmtPricePair(await treasury.intrinsicValueRatio());
        expect(fromAtto(await fraxToken.balanceOf(await alan.getAddress()))).eq(0);
        expect(fromAtto(await feiToken.balanceOf(await alan.getAddress()))).eq(900000 * ivFrax / ivTemple);
        
      })

    it("AMM sell with deadline in the past should fail", async() => {
        const beforeTS = await blockTimestamp() - 1
        const EXPIRED_ERROR = /TempleStableAMMRouter: EXPIRED/
        await shouldThrow(templeRouter.swapExactTempleForStable(toAtto(1000), 1, fraxToken.address, await alan.getAddress(), beforeTS), EXPIRED_ERROR);
    })
   })

   describe("Liquidity", async() => {

    it("add", async () => {
      // Expect reserves to match before/after adding liquidity
      expect(fmtPricePair(await pair.getReserves()))
        .eql(fmtPricePair(await uniswapRouter.getReserves(templeToken.address, fraxToken.address)));

      await templeRouter.addLiquidity(toAtto(100000), toAtto(1000000), 1, 1, fraxToken.address, await owner.getAddress(), expiryDate());
      await uniswapRouter.addLiquidity(templeToken.address, fraxToken.address, toAtto(100000), toAtto(1000000), 1, 1, await owner.getAddress(), expiryDate())

      expect(fmtPricePair(await pair.getReserves()))
        .eql(fmtPricePair(await uniswapRouter.getReserves(templeToken.address, fraxToken.address)));
    });

    it("reverts if amount desired is less that min", async () => {
        // Expect reserves to match before/after adding liquidity
        expect(fmtPricePair(await pair.getReserves()))
          .eql(fmtPricePair(await uniswapRouter.getReserves(templeToken.address, fraxToken.address)));
  
        await shouldThrow(templeRouter.addLiquidity(toAtto(100000), toAtto(1000000), toAtto(100001), 1, fraxToken.address, await owner.getAddress(), expiryDate()), /TempleStableAMMRouter: MEV_EXTRACTABLE/);
    });

    it("remove", async () => {
      // Expect reserves to match before/after adding liquidity
      expect(fmtPricePair(await pair.getReserves()))
        .eql(fmtPricePair(await uniswapRouter.getReserves(templeToken.address, fraxToken.address)));

      expect(await uniswapPair.balanceOf(await owner.getAddress()))
        .eql(await pair.balanceOf(await owner.getAddress()))

      // remove liquidity
      await pair.approve(templeRouter.address, toAtto(100));
      await templeRouter.removeLiquidity(
        toAtto(100), 1, 1, fraxToken.address, await owner.getAddress(), expiryDate())

      await uniswapPair.approve(uniswapRouter.address, toAtto(100));
      await uniswapRouter.removeLiquidity(
        templeToken.address,
        fraxToken.address,
        toAtto(100), 1, 1, await owner.getAddress(), expiryDate())

      // Compare reserves and LP token balances
      expect(fmtPricePair(await pair.getReserves()))
        .eql(fmtPricePair(await uniswapRouter.getReserves(templeToken.address, fraxToken.address)));

      expect(await uniswapPair.balanceOf(await owner.getAddress()))
        .eql(await pair.balanceOf(await owner.getAddress()))
    });

  });

  describe("Update Treasury", async() => {

    it("non-owner reverts", async () => {
        await shouldThrow(templeRouter.connect(alan).setTreasury(await ben.getAddress()), /Ownable: caller is not the owner/);
    });

    it("updates treasury address properly", async () => {
        await templeRouter.setTreasury(await ben.getAddress());
        expect(await templeRouter.templeTreasury()).to.eq(await ben.getAddress());
    });
      
  })

  describe("Defend stable", async() => {

    it("non-owner reverts", async () => {
        await shouldThrow(templeRouter.connect(alan).setDefendStable(feiToken.address), /Ownable: caller is not the owner/);
    });

    it("sets correctly", async () => {
        await templeRouter.setDefendStable(feiToken.address);
        expect(await templeRouter.defendStable()).to.eq(feiToken.address);
    });
  })

 describe("Add pair ", async() => {

      it("non-owner reverts", async () => {
          await shouldThrow(templeRouter.connect(alan).addPair(feiToken.address, templeRouter.address), /Ownable: caller is not the owner/);
      });

      it("sets correctly", async () => {
          let fakeToken = await new FakeERC20__factory(owner).deploy("STABLEC", "STABLEC");
          await templeRouter.addPair(fakeToken.address, templeRouter.address);
          expect(await templeRouter.tokenPair(fakeToken.address)).to.eq(templeRouter.address);
      });
  })
})