import { ethers, hardhatArguments } from "hardhat";
import { expect } from "chai";

import { FakeERC20, FakeERC20__factory, TempleERC20Token, TempleERC20Token__factory, TempleFraxAMMRouter, TempleFraxAMMRouter__factory, TempleTreasury, TempleTreasury__factory, TempleUniswapV2Pair, TempleUniswapV2Pair__factory, UniswapV2Factory, UniswapV2Factory__factory, UniswapV2Pair, UniswapV2Pair__factory, UniswapV2Router02NoEth, UniswapV2Router02NoEth__factory, AmmIncentivisor, AmmIncentivisor__factory, Faith, Faith__factory, TempleStaking, TempleStaking__factory, ISwapRouter, LockedOGTemple, LockedOGTemple__factory } from "../typechain";

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
    let treasury: TempleTreasury;
    let owner: Signer;
    let alan: Signer;
    let ben: Signer
    let carol: Signer
    let pair: TempleUniswapV2Pair;
    let templeRouter: TempleFraxAMMRouter;
    let uniswapFactory: UniswapV2Factory;
    let uniswapRouter: UniswapV2Router02NoEth;
    let uniswapPair: UniswapV2Pair;
    let ammIncentivisor: AmmIncentivisor;

    const expiryDate = (): number =>  Math.floor(Date.now() / 1000) + 900;
   
    beforeEach(async () => {
      [owner, alan, ben, carol] = await ethers.getSigners();

      templeToken = await new TempleERC20Token__factory(owner).deploy();
      fraxToken = await new FakeERC20__factory(owner).deploy("STABLEC", "STABLEC");

      await templeToken.addMinter(await owner.getAddress()),

      await Promise.all([
        fraxToken.mint(await owner.getAddress(), toAtto(100000000)),
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
      templeRouter = await new TempleFraxAMMRouter__factory(owner).deploy(
        pair.address,
        templeToken.address,
        fraxToken.address,
        treasury.address,
        treasury.address, // for testing, make the earning account treasury
        {frax: 100000, temple: 9000},
        5, /* threshold decay per block */
        {frax: 1000000, temple: 1000000},
        {frax: 1000000, temple: 100000},
      );

      await pair.setRouter(templeRouter.address);
      await templeToken.addMinter(templeRouter.address);

      // Create a stock standard uniswap, so we can compare our AMM against the standard constant product AMM
      uniswapFactory = await new UniswapV2Factory__factory(owner).deploy(await owner.getAddress())
      uniswapRouter = await new UniswapV2Router02NoEth__factory(owner).deploy(uniswapFactory.address, fraxToken.address);

      // Add liquidity to both AMMs
      await templeToken.increaseAllowance(templeRouter.address, toAtto(10000000));
      await fraxToken.increaseAllowance(templeRouter.address, toAtto(10000000));
      await templeRouter.addLiquidity(toAtto(100000), toAtto(1000000), 1, 1, await owner.getAddress(), expiryDate());

      await templeToken.increaseAllowance(uniswapRouter.address, toAtto(10000000));
      await fraxToken.increaseAllowance(uniswapRouter.address, toAtto(10000000));
      await uniswapRouter.addLiquidity(templeToken.address, fraxToken.address, toAtto(100000), toAtto(1000000), 1, 1, await owner.getAddress(), expiryDate());
      uniswapPair = new UniswapV2Pair__factory(owner).attach(await uniswapFactory.getPair(templeToken.address, fraxToken.address));

      // Make temple router open access (useful state for most tests)
      await templeRouter.toggleOpenAccess();
    })

    describe("Buy", async() => {
      
      it("Below dynamic threshold should be same as AMM buy", async() => {
        // confirm price is below dynamic threshold (test case pre-condition)
        const [dtpFrax, dtpTemple] = fmtPricePair(await templeRouter.dynamicThresholdPriceWithDecay());
        const [rTemple, rFrax] = fmtPricePair(await pair.getReserves());
        expect(rFrax / rTemple).lt(dtpFrax / dtpTemple);

        // do swaps
        await uniswapRouter.swapExactTokensForTokens(toAtto(100), 1, [fraxToken.address, templeToken.address], await ben.getAddress(), expiryDate());
        await templeRouter.swapExactFraxForTemple(toAtto(100), 1, await alan.getAddress(), expiryDate());

        // Expect reserves to match
        expect(fmtPricePair(await pair.getReserves()))
          .eql(fmtPricePair(await uniswapRouter.getReserves(templeToken.address, fraxToken.address)));

        // Expect temple balances to match
        expect(fromAtto(await templeToken.balanceOf(await alan.getAddress())))
          .eq(fromAtto(await templeToken.balanceOf(await ben.getAddress())))
      })

      it("Above dynamic threshold should have some portion of buy minted on protocol", async() => {
        // Price should start below the dynamic threshold
        {
          const [dtpFrax, dtpTemple] = fmtPricePair(await templeRouter.dynamicThresholdPriceWithDecay());
          const [rTemple, rFrax] = fmtPricePair(await pair.getReserves());
          expect(rFrax / rTemple).lt(dtpFrax / dtpTemple);
        }

        // Until we pass dynamic threshold, buys are on AMM
        await templeRouter.setInterpolateToPrice(1000000, 10000)
        await templeRouter.setDynamicThresholdIncreasePct(9000)
        await uniswapRouter.swapExactTokensForTokens(toAtto(100000), 1, [fraxToken.address, templeToken.address], await ben.getAddress(), expiryDate());
        await templeRouter.swapExactFraxForTemple(toAtto(100000), 1, await alan.getAddress(), expiryDate());

        // Expect reserves to match
        expect(fmtPricePair(await pair.getReserves()))
          .eql(fmtPricePair(await uniswapRouter.getReserves(templeToken.address, fraxToken.address)));

        // Expect temple balances to match
        expect(fromAtto(await templeToken.balanceOf(await alan.getAddress())))
          .eq(fromAtto(await templeToken.balanceOf(await ben.getAddress())))

        // Expect price to be above dynamic threshold
        const [dtpFrax, dtpTemple] = fmtPricePair(await templeRouter.dynamicThresholdPriceWithDecay());
        const [rTemple, rFrax] = fmtPricePair(await pair.getReserves());
        expect(rFrax / rTemple).gte(dtpFrax / dtpTemple);

        // Now, if we mint again, we expect less slippage on AMM.
        {
        await uniswapRouter.swapExactTokensForTokens(toAtto(10000), 1, [fraxToken.address, templeToken.address], await ben.getAddress(), expiryDate());
        await templeRouter.swapExactFraxForTemple(toAtto(10000), 1, await alan.getAddress(), expiryDate());

        const [dtpFraxNew, dtpTempleNew] = fmtPricePair(await templeRouter.dynamicThresholdPriceWithDecay());
        const [rTempleCustomAMM, rFraxCustomAMM] = fmtPricePair(await pair.getReserves());
        const [rTempleUniswapAMM, rFraxUniswapAMM] = fmtPricePair(await uniswapRouter.getReserves(templeToken.address, fraxToken.address));

        // No change to the DTP Price, as the buy didn't go far enough in front
        expect(dtpFrax/ dtpTemple).approximately(dtpFraxNew / dtpTempleNew, 1e-5);
        expect(rFrax / rTemple).gt(dtpFraxNew / dtpTempleNew);
        expect(rTempleCustomAMM).gt(rTempleUniswapAMM);
        expect(rFraxCustomAMM).lt(rFraxUniswapAMM);
        }

        // Buy again, this time we expect the DTP price to move up
        {
        await templeRouter.swapExactFraxForTemple(toAtto(10000), 1, await alan.getAddress(), expiryDate());
        const [rTemple, rFrax] = fmtPricePair(await pair.getReserves());
        const [dtpFraxNew, dtpTempleNew] = fmtPricePair(await templeRouter.dynamicThresholdPriceWithDecay());

        // The DTP Price only moves up
        expect(rFrax / rTemple).gt(dtpFraxNew / dtpTempleNew);
        expect(dtpFrax/ dtpTemple).lt(dtpFraxNew / dtpTempleNew);
        expect(rFrax / rTemple).gt(dtpFraxNew / dtpTempleNew);
        expect(rFrax / rTemple * 0.9).approximately(dtpFraxNew / dtpTempleNew, 1e-2);
        }

        // Confirm values line up for what's printed on protocol vs bought on AMM
        {
        const quote = await templeRouter.swapExactFraxForTempleQuote(toAtto(100));
        const [rTemple0, rFrax0] = fmtPricePair(await pair.getReserves());
        const balanceFrax = fromAtto(await fraxToken.balanceOf(await owner.getAddress()));
        await templeRouter.swapExactFraxForTemple(toAtto(100), 1, await carol.getAddress(), expiryDate());
        const [rTemple1, rFrax1] = fmtPricePair(await pair.getReserves());
        
        // Check values minted on protocol and bought on AMM vs quoted values
        expect(rFrax1 / rTemple1).approximately((rFrax0 + fromAtto(quote.amountInAMM))/(rTemple0 - fromAtto(quote.amountOutAMM)), 1e-3);
        expect(fromAtto(await templeToken.balanceOf(await carol.getAddress()))).eq(fromAtto(quote.amountOutProtocol.add(quote.amountOutAMM)));
        expect(fromAtto(await fraxToken.balanceOf(await owner.getAddress()))).eq(balanceFrax - fromAtto(quote.amountInProtocol.add(quote.amountInAMM)));
        }
      })

      it("Above dynamic threshold and toPrice should have 80% of buy minted on protocol", async() => {
        // Price should start below the dynamic threshold
        {
          const [dtpFrax, dtpTemple] = fmtPricePair(await templeRouter.dynamicThresholdPriceWithDecay());
          const [rTemple, rFrax] = fmtPricePair(await pair.getReserves());
          expect(rFrax / rTemple).lt(dtpFrax / dtpTemple);
        }

        // Until we pass dynamic threshold, buys are on AMM
        await uniswapRouter.swapExactTokensForTokens(toAtto(1000000), 1, [fraxToken.address, templeToken.address], await ben.getAddress(), expiryDate());
        await templeRouter.swapExactFraxForTemple(toAtto(1000000), 1, await alan.getAddress(), expiryDate());

        // Expect reserves to match
        expect(fmtPricePair(await pair.getReserves()))
          .eql(fmtPricePair(await uniswapRouter.getReserves(templeToken.address, fraxToken.address)));

        // Expect temple balances to match
        expect(fromAtto(await templeToken.balanceOf(await alan.getAddress())))
          .eq(fromAtto(await templeToken.balanceOf(await ben.getAddress())))

        // Expect price to be above dynamic threshold
        const [dtpFrax, dtpTemple] = fmtPricePair(await templeRouter.dynamicThresholdPriceWithDecay());
        const [rTemple, rFrax] = fmtPricePair(await pair.getReserves());
        expect(rFrax / rTemple).gte(dtpFrax / dtpTemple);

        // Now, if we mint again, we expect less slippage on AMM, and the dtp price to be the start price of the last buy
        const quote = await templeRouter.swapExactFraxForTempleQuote(toAtto(1000000));
        await templeRouter.swapExactFraxForTemple(toAtto(1000000), 1, await carol.getAddress(), expiryDate());
        expect(fmtPricePair(await pair.getReserves())[1]).eq(rFrax + (1000000 * 0.2));
        expect(fromAtto(await templeToken.balanceOf(await carol.getAddress()))).eq(fromAtto(quote.amountOutProtocol.add(quote.amountOutAMM)));
      })

      it("AMM buy with deadline in the past should fail", async() => {
        const beforeTS = await blockTimestamp() - 1
        const EXPIRED_ERROR = /.*TempleFraxAMMRouter: EXPIRED/
        await shouldThrow(templeRouter.swapExactFraxForTemple(toAtto(1000), 1, await alan.getAddress(), beforeTS), EXPIRED_ERROR);
      })
    });

    describe("Sell", async() => {
      it("Above IV sells should be same as on AMM", async() => {
        // do swaps
        await uniswapRouter.swapExactTokensForTokens(toAtto(100), 1, [templeToken.address, fraxToken.address], await ben.getAddress(), expiryDate());
        await templeRouter.swapExactTempleForFrax(toAtto(100), 1, await alan.getAddress(), expiryDate());

        // Expect reserves to match
        expect(fmtPricePair(await pair.getReserves()))
          .eql(fmtPricePair(await uniswapRouter.getReserves(templeToken.address, fraxToken.address)));

        // Expect temple balances to match
        expect(fromAtto(await templeToken.balanceOf(await alan.getAddress())))
          .eq(fromAtto(await templeToken.balanceOf(await ben.getAddress())))
      })

      it("Below IV sells should always be exactly at IV", async() => {
        // fund router with some frax (for use when price is below IV)
        await fraxToken.transfer(templeRouter.address, toAtto(1000));

        // First, sell enough temple to bring price below IV
        await templeRouter.swapExactTempleForFrax(toAtto(900000), 1, await alan.getAddress(), expiryDate());
        await uniswapRouter.swapExactTokensForTokens(toAtto(900000), 1, [templeToken.address, fraxToken.address], await alan.getAddress(), expiryDate());
        expect(fmtPricePair(await pair.getReserves()))
          .eql(fmtPricePair(await uniswapRouter.getReserves(templeToken.address, fraxToken.address)));

        // Expect price to be below IV
        const [ivFrax, ivTemple] = fmtPricePair(await treasury.intrinsicValueRatio());
        const [rTemple, rFrax] = fmtPricePair(await pair.getReserves());
        expect(rFrax / rTemple).lte(ivFrax / ivTemple);

        // From this point on, any sell should be at the IV Price (not reserve price)
        await templeRouter.swapExactTempleForFrax(toAtto(100), 1, await ben.getAddress(), expiryDate());
        expect(fromAtto(await fraxToken.balanceOf(await ben.getAddress()))).eq(100 * ivFrax / ivTemple);

        await templeRouter.swapExactTempleForFrax(toAtto(100), 1, await ben.getAddress(), expiryDate());
        expect(fromAtto(await fraxToken.balanceOf(await ben.getAddress()))).eq(200 * ivFrax / ivTemple);

        // Buys should be on the constant product AMM
        await uniswapRouter.swapExactTokensForTokens(toAtto(100), 1, [fraxToken.address, templeToken.address], await alan.getAddress(), expiryDate());
        await templeRouter.swapExactFraxForTemple(toAtto(100), 1, await alan.getAddress(), expiryDate());
        expect(fmtPricePair(await pair.getReserves()))
          .eql(fmtPricePair(await uniswapRouter.getReserves(templeToken.address, fraxToken.address)));
      })

      it("AMM sell with deadline in the past should fail", async() => {
        const beforeTS = await blockTimestamp() - 1
        const EXPIRED_ERROR = /.*TempleFraxAMMRouter: EXPIRED/
        await shouldThrow(templeRouter.swapExactTempleForFrax(toAtto(1000), 1, await alan.getAddress(), beforeTS), EXPIRED_ERROR);
      })
    });

    describe("Dynamic Threshold Price", async() => {
      // pre-conditions
      beforeEach(async () => {
        const [dtpFrax, dtpTemple] = fmtPricePair(await templeRouter.dynamicThresholdPriceWithDecay());
        const [rTemple, rFrax] = fmtPricePair(await pair.getReserves());
        expect(rFrax / rTemple).lt(dtpFrax / dtpTemple);

        await templeRouter.setDynamicThresholdIncreasePct(9800)
        await templeRouter.setInterpolateToPrice(1000000, 10000)
      })
      
      it("Crossing DTP should kick of DTP decay", async() => {
        // move price above DTP. Shouldn't change DTP yet
        const [dtpFrax0, dtpTemple0] = fmtPricePair(await templeRouter.dynamicThresholdPriceWithDecay());
        await templeRouter.swapExactFraxForTemple(toAtto(100000), 1, await alan.getAddress(), expiryDate());
        const [dtpFrax1, dtpTemple1] = fmtPricePair(await templeRouter.dynamicThresholdPriceWithDecay());
        const [rTemple1, rFrax1] = fmtPricePair(await pair.getReserves());
        expect(rFrax1 / rTemple1).gte(dtpFrax1 / dtpTemple1);
        expect(dtpFrax0 / dtpTemple0).eq(dtpFrax1 / dtpTemple1);

        // Now, buy a bit - should move DTP price up 
        await templeRouter.swapExactFraxForTemple(toAtto(100), 1, await alan.getAddress(), expiryDate());
        const [dtpFrax2, dtpTemple2] = fmtPricePair(await templeRouter.dynamicThresholdPriceWithDecay());
        expect(dtpFrax2 / dtpTemple2).gte(dtpFrax1 / dtpTemple1);

        // Now sell below dtp, should kick off price decay
        expect(await templeRouter.priceCrossedBelowDynamicThresholdBlock()).eq(0);
        const [_1,_2, amountFrax]: [boolean, boolean, BigNumber] = await templeRouter.swapExactTempleForFraxQuote(toAtto(1000));
        await templeRouter.swapExactTempleForFrax(toAtto(1000), 1, await alan.getAddress(), expiryDate());
        expect((await templeRouter.priceCrossedBelowDynamicThresholdBlock()).toNumber()).gt(0);
        const [dtpFrax3, dtpTemple3] = fmtPricePair(await templeRouter.dynamicThresholdPriceWithDecay());

        // mine N blocks, price should decay further
        await mineNBlocks(10);
        const [dtpFrax4, dtpTemple4] = fmtPricePair(await templeRouter.dynamicThresholdPriceWithDecay());
        expect(dtpFrax4 / dtpTemple4).lt(dtpFrax3 / dtpTemple3);

        // finally, buying back above DTP should stop decay and set new DTP price
        await templeRouter.swapExactFraxForTemple(amountFrax, 1, await alan.getAddress(), expiryDate());
        const [dtpFrax5, dtpTemple5] = fmtPricePair(await templeRouter.dynamicThresholdPriceWithDecay());
        expect(await templeRouter.priceCrossedBelowDynamicThresholdBlock()).eq(0);
        expect(dtpFrax5 / dtpTemple5).gt(dtpFrax4 / dtpTemple4);
        expect(dtpFrax5 / dtpTemple5).lt(dtpFrax2 / dtpTemple2);
      })
    })

    describe("Liquidity", async() => {
      it("add", async () => {
        // Expect reserves to match before/after adding liquidity
        expect(fmtPricePair(await pair.getReserves()))
          .eql(fmtPricePair(await uniswapRouter.getReserves(templeToken.address, fraxToken.address)));

        await templeRouter.addLiquidity(toAtto(100000), toAtto(1000000), 1, 1, await owner.getAddress(), expiryDate());
        await uniswapRouter.addLiquidity(templeToken.address, fraxToken.address, toAtto(100000), toAtto(1000000), 1, 1, await owner.getAddress(), expiryDate())

        expect(fmtPricePair(await pair.getReserves()))
          .eql(fmtPricePair(await uniswapRouter.getReserves(templeToken.address, fraxToken.address)));
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
          toAtto(100), 1, 1, await owner.getAddress(), expiryDate())

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
    })

    describe("Mint Ratio", async() => {
      const cases: [string, number, number, number][] = [
        ["spot just below from price", 1000000, 1000001, 0],
        ["spot well below from price", 1000000, 2000000, 0],
        ["spot just above to price", 1000000, 99999, 0.8],
        ["spot well above to price", 1000000, 1000, 0.8],
      ]

      // add cases across the range
      const fromPrice = 1;
      const toPrice = 10;
      for (let i = 0; i < 10; i += 2) {
        const spot = 1+i;
        cases.push([`Ratio at $${spot} for price range (1,10)`, 1+i,1, Math.min((spot - fromPrice) / (toPrice - fromPrice), 0.8)]);
      }

      for (const [name, frax, temple, expectedRatio] of cases) {
        it(name, async () => {
          const [n,d] = await templeRouter.mintRatioAt(temple, frax)
          let mintRatio = 0;
          if (n.eq(0)) {
            mintRatio = 0;
          } else if (n.eq(1) && d.eq(1)) {
            mintRatio = 1;
          } else {
            mintRatio = fromAtto(n) / fromAtto(d);
          }

          expect(mintRatio).approximately(expectedRatio, 1e-2);
        })
      }
    })

    describe("Dynamic Threshold", async () => {
      beforeEach(async () => {
        // setup temple router so dtp is < price for DTP checks
        templeRouter = await new TempleFraxAMMRouter__factory(owner).deploy(
          pair.address,
          templeToken.address,
          fraxToken.address,
          treasury.address,
          treasury.address, // for testing, make the earning account treasury
          {frax: 100000, temple: 100010},
          1, /* threshold decay per block */
          {frax: 1000000, temple: 1000000},
          {frax: 1000000, temple: 100000},
        );

        await pair.setRouter(templeRouter.address);
        await templeToken.addMinter(templeRouter.address);

        await templeToken.increaseAllowance(templeRouter.address, toAtto(10000000));
        await fraxToken.increaseAllowance(templeRouter.address, toAtto(10000000))

        await templeRouter.toggleOpenAccess();
      });

      it("Threshold only decays when price is above dynamic threshold", async() => {
        const [dtpFraxOld, dtpTempleOld] = fmtPricePair(await templeRouter.dynamicThresholdPriceWithDecay());
        const [rTemple, rFrax] = fmtPricePair(await pair.getReserves());

        // preconditions
        expect(await templeRouter.priceCrossedBelowDynamicThresholdBlock()).eq(0);
        expect(dtpFraxOld/dtpTempleOld).lt(rFrax/rTemple);

        await mineNBlocks(2);
        const [dtpFraxNew, dtpTempleNew] = fmtPricePair(await templeRouter.dynamicThresholdPriceWithDecay());

        // new threshold should be the same as the old threshold while the price hasn't crossed.
        expect(dtpFraxNew/dtpTempleNew).approximately(dtpFraxOld/dtpTempleOld, 1e-5);
      })

      it("Threshold starts decaying as soon as price drops below the dynamic threshold", async() => {
        await templeRouter.setDynamicThresholdDecayPerBlock(toAtto(100));

        const [dtpFraxOld, dtpTempleOld] = fmtPricePair(await templeRouter.dynamicThresholdPriceWithDecay());
        const [rTemple, rFrax] = fmtPricePair(await pair.getReserves());

        // preconditions
        expect(dtpFraxOld/dtpTempleOld).lt(rFrax/rTemple);
        expect(await templeRouter.priceCrossedBelowDynamicThresholdBlock()).eq(0);

        // sell some temple
        await templeRouter.swapExactTempleForFrax(toAtto(1000000), 1, await alan.getAddress(), expiryDate());

        // Watch dynamic threshold drop
        expect(await templeRouter.priceCrossedBelowDynamicThresholdBlock()).gt(0);
        await mineNBlocks(1);
        const [dtpFraxNew1, dtpTempleNew1] = fmtPricePair(await templeRouter.dynamicThresholdPriceWithDecay());
        expect(dtpFraxNew1/dtpTempleNew1).lt(dtpFraxOld/dtpTempleOld);

        await mineNBlocks(2);
        const [dtpFraxNew2, dtpTempleNew2] = fmtPricePair(await templeRouter.dynamicThresholdPriceWithDecay());
        expect(dtpFraxNew2/dtpTempleNew2).lt(dtpFraxNew1/dtpTempleNew1);
      });

      it("Threshold stops decaying when prices crosses above dynamic threshold", async() => {
        await templeRouter.setDynamicThresholdDecayPerBlock(toAtto(100));

        const [dtpFraxOld, dtpTempleOld] = fmtPricePair(await templeRouter.dynamicThresholdPriceWithDecay());
        const [rTemple, rFrax] = fmtPricePair(await pair.getReserves());

        // preconditions
        expect(dtpFraxOld/dtpTempleOld).lt(rFrax/rTemple);
        expect(await templeRouter.priceCrossedBelowDynamicThresholdBlock()).eq(0);

        // sell some temple
        await templeRouter.swapExactTempleForFrax(toAtto(1000000), 1, await alan.getAddress(), expiryDate());

        // Watch dynamic threshold drop
        expect(await templeRouter.priceCrossedBelowDynamicThresholdBlock()).gt(0);
        await mineNBlocks(1);
        const [dtpFraxNew1, dtpTempleNew1] = fmtPricePair(await templeRouter.dynamicThresholdPriceWithDecay());
        expect(dtpFraxNew1/dtpTempleNew1).lt(dtpFraxOld/dtpTempleOld);

        await mineNBlocks(2);
        const [dtpFraxNew2, dtpTempleNew2] = fmtPricePair(await templeRouter.dynamicThresholdPriceWithDecay());
        expect(dtpFraxNew2/dtpTempleNew2).lt(dtpFraxNew1/dtpTempleNew1);

        // Buy back up dyanmic threshold should stay steady
        await templeRouter.swapExactFraxForTemple(toAtto(1100000), 1, await alan.getAddress(), expiryDate());
        const [dtpFraxNew3, dtpTempleNew3] = fmtPricePair(await templeRouter.dynamicThresholdPriceWithDecay());

        await mineNBlocks(3);
        const [dtpFraxNew4, dtpTempleNew4] = fmtPricePair(await templeRouter.dynamicThresholdPriceWithDecay());
        expect(dtpFraxNew3/dtpTempleNew3).approximately(dtpFraxNew4/dtpTempleNew4, 1e-5);
      });
    })

    describe('Contract Management / ACL', async () => {
      const ONLY_OWNER_ERROR = /Ownable: caller is not the owner/;

      let ownerConnectTR: TempleFraxAMMRouter;
      let alanConnectTR: TempleFraxAMMRouter;
      let benConnectTR: TempleFraxAMMRouter;
      let ownerConnectPair: TempleUniswapV2Pair;
      let alanConnectPair: TempleUniswapV2Pair;

      beforeEach(async () => {
        ownerConnectTR = templeRouter.connect(owner);
        alanConnectTR = templeRouter.connect(alan);
        benConnectTR = templeRouter.connect(ben);

        ownerConnectPair = pair.connect(owner);
        alanConnectPair = pair.connect(alan);
      });

      it('only owner can change dynamic decay per block', async () => {
        await shouldThrow(alanConnectTR.setDynamicThresholdDecayPerBlock(100000), ONLY_OWNER_ERROR);
        await ownerConnectTR.setDynamicThresholdDecayPerBlock(100000);
        expect(await ownerConnectTR.dynamicThresholdDecayPerBlock()).to.eq(100000);
      });

      it('only owner can change dynamic threshold percentage', async () => {
        await shouldThrow(alanConnectTR.setDynamicThresholdIncreasePct(5000), ONLY_OWNER_ERROR);
        await ownerConnectTR.setDynamicThresholdIncreasePct(5000);
        expect(await ownerConnectTR.dynamicThresholdIncreasePct()).to.eq(5000);
      });

      it('only owner can set interpolation from/to price', async () => {
        await shouldThrow(alanConnectTR.setInterpolateFromPrice(100000, 100000), ONLY_OWNER_ERROR);
        await shouldThrow(alanConnectTR.setInterpolateToPrice(200000, 200000), ONLY_OWNER_ERROR);

        await ownerConnectTR.setInterpolateFromPrice(100000, 100000);
        await ownerConnectTR.setInterpolateToPrice(200000, 200000);

        const { frax: fraxFrom, temple: templeFrom } = await ownerConnectTR.interpolateFromPrice();
        const { frax: fraxTo, temple: templeTo } = await ownerConnectTR.interpolateToPrice();

        expect(fraxFrom).to.eq(100000);
        expect(templeFrom).to.eq(100000);
        expect(fraxTo).to.eq(200000);
        expect(templeTo).to.eq(200000);
      });

      it('only owner can toggle access', async () => {
        await shouldThrow(alanConnectTR.toggleOpenAccess(), ONLY_OWNER_ERROR);

        expect(await ownerConnectTR.openAccessEnabled()).to.eq(true);
        await ownerConnectTR.toggleOpenAccess();
        expect(await ownerConnectTR.openAccessEnabled()).to.eq(false);
      });

      it('Need appropriate role to add allowed user', async () => {
        const ACCESS_CONTROL_ERROR = /AccessControl:.* is missing role/;
        const alanAddress = await alan.getAddress();
        const benAddress = await ben.getAddress();
        const role = await templeRouter.CAN_ADD_ALLOWED_USER();

        await shouldThrow(alanConnectTR.addAllowedUser(benAddress), ACCESS_CONTROL_ERROR);
        await templeRouter.grantRole(role, alanAddress);
        await alanConnectTR.addAllowedUser(benAddress);
      });

      it('Only owner can remove a user from the allowed list', async () => {
        const alanAddress = await alan.getAddress();
        const benAddress = await ben.getAddress();
        const role = await templeRouter.CAN_ADD_ALLOWED_USER();

        await templeRouter.grantRole(role, alanAddress);
        await alanConnectTR.addAllowedUser(benAddress);

        await shouldThrow(alanConnectTR.removeAllowedUser(benAddress), ONLY_OWNER_ERROR); // non-owner with access role
        await shouldThrow(benConnectTR.removeAllowedUser(benAddress), ONLY_OWNER_ERROR); // non-owner without access role
        await ownerConnectTR.removeAllowedUser(benAddress);
      });

      it('UniswapV2Pair has access control enabled s.t only a single router can call swap (permissioned access)', async () => {
        const FORBIDDEN_ERROR = 'UniswapV2: FORBIDDEN';

        const alanAddress = await alan.getAddress();
        const routerConnectPair = pair.connect(templeRouter.address);

        await shouldThrow(alanConnectPair.swap(1000, 1000, alanAddress, '0x'), new RegExp(FORBIDDEN_ERROR));
        await expect(routerConnectPair.swap(1000, 1000, alanAddress, '0x')).not.revertedWith(FORBIDDEN_ERROR);
      });

      it('Owner can change the active router on the UniswapV2Pair', async () => {
        const benAddress = await ben.getAddress();

        await shouldThrow(alanConnectPair.setRouter(benAddress), /UniswapV2: FORBIDDEN/);

        await ownerConnectPair.setRouter(benAddress);
        expect(await pair.router()).to.eq(benAddress);
      });

      it('Need to be on allowedlist to call router and swap (before open access is enabled)', async () => {
        const NOT_ALLOWED_ERROR = "Router isn't open access and caller isn't in the allowed list";

        const alanAddress = await alan.getAddress();

        // await fraxToken.connect(alan).increaseAllowance(templeRouter.address, 100000);
        // await templeToken.connect(alan).increaseAllowance(templeRouter.address, 100000);

        await Promise.all([
          fraxToken.mint(alanAddress, toAtto(100000000)),
          templeToken.mint(alanAddress, toAtto(100000000)),
        ]);

        // Set open access to false
        await templeRouter.toggleOpenAccess();
        expect(await templeRouter.openAccessEnabled()).to.eq(false);
        await shouldThrow(
          alanConnectTR.swapExactFraxForTemple(toAtto(100), 1, alanAddress, expiryDate()),
          new RegExp(NOT_ALLOWED_ERROR)
        );
        await shouldThrow(
          alanConnectTR.swapExactTempleForFrax(toAtto(100), 1, alanAddress, expiryDate()),
          new RegExp(NOT_ALLOWED_ERROR)
        );

        // Let Alan add himself to allowed list and attempt swap
        const role = await templeRouter.CAN_ADD_ALLOWED_USER();
        await templeRouter.grantRole(role, alanAddress);
        await alanConnectTR.addAllowedUser(alanAddress);

        await expect(alanConnectTR.swapExactFraxForTemple(toAtto(100), 1, alanAddress, expiryDate())).not.revertedWith(
          NOT_ALLOWED_ERROR
        );
        await expect(alanConnectTR.swapExactTempleForFrax(toAtto(100), 1, alanAddress, expiryDate())).not.revertedWith(
          NOT_ALLOWED_ERROR
        );

        // await alanConnectTR.swapExactFraxForTemple(toAtto(100), 1, alanAddress, expiryDate());
        // await alanConnectTR.swapExactTempleForFrax(toAtto(100), 1, alanAddress, expiryDate());
      });

      it('Once open access is enabled, anyone can swap frax/temple', async () => {
        const NOT_ALLOWED_ERROR_STR = "Router isn't open access and caller isn't in the allowed list";

        const alanAddress = await alan.getAddress();
        const benAddress = await ben.getAddress();

        await Promise.all([
          fraxToken.mint(alanAddress, toAtto(100000000)),
          templeToken.mint(alanAddress, toAtto(100000000)),
          fraxToken.mint(benAddress, toAtto(100000000)),
          templeToken.mint(benAddress, toAtto(100000000)),
        ]);

        expect(await templeRouter.openAccessEnabled()).to.eq(true);
        // non-allowed user should be able to swap
        await expect(benConnectTR.swapExactFraxForTemple(toAtto(100), 1, benAddress, expiryDate())).not.revertedWith(
          NOT_ALLOWED_ERROR_STR
        );
        await expect(benConnectTR.swapExactTempleForFrax(toAtto(100), 1, benAddress, expiryDate())).not.revertedWith(
          NOT_ALLOWED_ERROR_STR
        );

        // allowed user should be able to swap
        const role = await templeRouter.CAN_ADD_ALLOWED_USER();
        await templeRouter.grantRole(role, alanAddress);
        await alanConnectTR.addAllowedUser(alanAddress);
        await expect(alanConnectTR.swapExactFraxForTemple(toAtto(100), 1, alanAddress, expiryDate())).not.revertedWith(
          NOT_ALLOWED_ERROR_STR
        );
        await expect(alanConnectTR.swapExactTempleForFrax(toAtto(100), 1, alanAddress, expiryDate())).not.revertedWith(
          NOT_ALLOWED_ERROR_STR
        );
      });
    })

    describe("AMM Incenstivisor", async() => {
      let faith: Faith;
      let staking: TempleStaking;
      let lockedOGTemple: LockedOGTemple;

      beforeEach(async () => {
        faith = await new Faith__factory(owner).deploy();
        staking = await new TempleStaking__factory(owner).deploy(
            templeToken.address,
            fraxToken.address,
            86400, /* epoch size, in seconds */
           (await blockTimestamp()) - 1,
         );

        await staking.setEpy(7000, 1000000);

        lockedOGTemple = await new LockedOGTemple__factory(owner).deploy(await staking.OG_TEMPLE());

        ammIncentivisor = await new AmmIncentivisor__factory(owner).deploy(
          fraxToken.address,
          faith.address,
          templeToken.address,
          staking.address,
          templeRouter.address,
          uniswapPair.address,
          lockedOGTemple.address,
          treasury.address,
        )
        await ammIncentivisor.SetStakeAndLockMultiplier(1500) // 1.5 multplier
        await ammIncentivisor.setBuyTheDipMultiplier(1200) // 1.2 multiplier
        await ammIncentivisor.setNumBlocksForUnlockIncentive(5)

        // Set scalling factory to adjust for the high inbalance in circulating supply and faith total supply
        await ammIncentivisor.setScalingFactor(1, 70000);

        await faith.addManager(ammIncentivisor.address)
        await templeToken.mint(ammIncentivisor.address, toAtto(1000000)); // seed contract with bonus temple
    })

    describe("Incentive active", async() => {
      beforeEach(async () => {

        // Price should start below the dynamic threshold
        {
          const [dtpFrax, dtpTemple] = fmtPricePair(await templeRouter.dynamicThresholdPriceWithDecay());
          const [rTemple, rFrax] = fmtPricePair(await pair.getReserves());
          expect(rFrax / rTemple).lt(dtpFrax / dtpTemple);
        }

        // Until we pass dynamic threshold, buys are on AMM
        await templeRouter.setInterpolateToPrice(1000000, 10000)
        await templeRouter.setDynamicThresholdIncreasePct(9000)
        await templeRouter.swapExactFraxForTemple(toAtto(100000), 1, await alan.getAddress(), expiryDate());

        // Expect price to be above dynamic threshold
        const [dtpFrax, dtpTemple] = fmtPricePair(await templeRouter.dynamicThresholdPriceWithDecay());
        const [rTemple, rFrax] = fmtPricePair(await pair.getReserves());
        expect(rFrax / rTemple).gte(dtpFrax / dtpTemple);

        expect(await templeRouter.priceCrossedBelowDynamicThresholdBlock()).to.eq(0)

          // First, sell enough temple to bring price below threshold
        await templeRouter.swapExactTempleForFrax(toAtto(9000), 1, await owner.getAddress(), expiryDate());
          {
          const [dtpFrax, dtpTemple] = fmtPricePair(await templeRouter.dynamicThresholdPriceWithDecay());
          const [rTemple, rFrax] = fmtPricePair(await pair.getReserves());
            expect(rFrax / rTemple).lte(dtpFrax / dtpTemple);
          }
          expect(await templeRouter.priceCrossedBelowDynamicThresholdBlock()).to.eq(await ethers.provider.getBlockNumber())
      })

      it("buy the dip stack", async() => {

        let amountIn = toAtto(10000)
        let quoted = await templeRouter.swapExactFraxForTempleQuote(amountIn)
        let templeAmoutOut = fromAtto(quoted[2]) + fromAtto(quoted[3])
        await fraxToken.connect(owner).increaseAllowance(ammIncentivisor.address, amountIn);

        await shouldThrow(ammIncentivisor.connect(owner).buyTheDip(amountIn, 1, expiryDate()), /AMM Incentivizor: Not Active/);

        await mineNBlocks(6);
        await ammIncentivisor.connect(owner).buyTheDip(amountIn, 1, expiryDate());

        const event = await ammIncentivisor.queryFilter(ammIncentivisor.filters.BuyTheDipComplete())
        const stakeEvent = await staking.queryFilter(staking.filters.StakeCompleted())
        
        let computedBonusTemple = 21.71
        expect(fromAtto(event[0].args.bonusTemple)).approximately(computedBonusTemple, 1) // Computed off-chain
        expect(fromAtto(event[0].args.faithGranted)).approximately(templeAmoutOut * 1.5, 1);
        let amountOgLocked = await lockedOGTemple.ogTempleLocked(await owner.getAddress());
        expect(event[0].args.mintedOGTemple).eq(amountOgLocked.amount)
        expect(event[0].args.staker).eq(await owner.getAddress())
        expect(fromAtto(stakeEvent[0].args._amount)).approximately( templeAmoutOut+ computedBonusTemple, 1)
        
      })
    })
  })
})