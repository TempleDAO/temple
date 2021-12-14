import { ethers, hardhatArguments } from "hardhat";
import { expect } from "chai";

import { FakeERC20, FakeERC20__factory, TempleERC20Token, TempleERC20Token__factory, TempleFraxAMMRouter, TempleFraxAMMRouter__factory, TempleTreasury, TempleTreasury__factory, TempleUniswapV2Pair, TempleUniswapV2Pair__factory, UniswapV2Factory, UniswapV2Factory__factory, UniswapV2Pair, UniswapV2Pair__factory, UniswapV2Router02NoEth, UniswapV2Router02NoEth__factory } from "../typechain";

import { BigNumber, Signer } from "ethers";
import { toAtto } from "./helpers";

import { fromAtto } from "../scripts/deploys/helpers";

const fmtPricePair = (pair: [BigNumber, BigNumber, number?]): [number, number] => {
  return [fromAtto(pair[0]), fromAtto(pair[1])]
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
        {frax: 100000, temple: 9000},
        1, /* threshold decay per block */
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
        const [dtpFrax, dtpTemple] = fmtPricePair(await templeRouter.dynamicThresholdPrice());
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
          const [dtpFrax, dtpTemple] = fmtPricePair(await templeRouter.dynamicThresholdPrice());
          const [rTemple, rFrax] = fmtPricePair(await pair.getReserves());
          expect(rFrax / rTemple).lt(dtpFrax / dtpTemple);
        }

        // Until we pass dynamic threshold, buys are on AMM
        await templeRouter.setInterpolateToPrice(1000000, 10000)
        await uniswapRouter.swapExactTokensForTokens(toAtto(100000), 1, [fraxToken.address, templeToken.address], await ben.getAddress(), expiryDate());
        await templeRouter.swapExactFraxForTemple(toAtto(100000), 1, await alan.getAddress(), expiryDate());

        // Expect reserves to match
        expect(fmtPricePair(await pair.getReserves()))
          .eql(fmtPricePair(await uniswapRouter.getReserves(templeToken.address, fraxToken.address)));

        // Expect temple balances to match
        expect(fromAtto(await templeToken.balanceOf(await alan.getAddress())))
          .eq(fromAtto(await templeToken.balanceOf(await ben.getAddress())))

        // Expect price to be above dynamic threshold
        const [dtpFrax, dtpTemple] = fmtPricePair(await templeRouter.dynamicThresholdPrice());
        const [rTemple, rFrax] = fmtPricePair(await pair.getReserves());
        expect(rFrax / rTemple).gte(dtpFrax / dtpTemple);

        // Now, if we mint again, we expect less slippage on AMM, and the dtp price to be the start price of the last buy
        await uniswapRouter.swapExactTokensForTokens(toAtto(1000), 1, [fraxToken.address, templeToken.address], await ben.getAddress(), expiryDate());
        await templeRouter.swapExactFraxForTemple(toAtto(1000), 1, await alan.getAddress(), expiryDate());

        const [dtpFraxNew, dtpTempleNew] = fmtPricePair(await templeRouter.dynamicThresholdPrice());
        const [rTempleCustomAMM, rFraxUniswapAMM] = fmtPricePair(await pair.getReserves());
        const [rTempleUniswapAMM, rfUniswapAMM] = fmtPricePair(await uniswapRouter.getReserves(templeToken.address, fraxToken.address));
        expect(rFrax / rTemple).approximately(dtpFraxNew / dtpTempleNew, 1e-2);
        expect(rTempleCustomAMM).gt(rTempleUniswapAMM);
        expect(rFraxUniswapAMM).lt(rfUniswapAMM);
      })

      it("Above dynamic threshold and toPrice should have 100% of buy minted on protocol", async() => {
        // Price should start below the dynamic threshold
        {
          const [dtpFrax, dtpTemple] = fmtPricePair(await templeRouter.dynamicThresholdPrice());
          const [rTemple, rFrax] = fmtPricePair(await pair.getReserves());
          expect(rFrax / rTemple).lt(dtpFrax / dtpTemple);
        }

        // Until we pass dynamic threshold, buys are on AMM
        await uniswapRouter.swapExactTokensForTokens(toAtto(100000), 1, [fraxToken.address, templeToken.address], await ben.getAddress(), expiryDate());
        await templeRouter.swapExactFraxForTemple(toAtto(100000), 1, await alan.getAddress(), expiryDate());

        // Expect reserves to match
        expect(fmtPricePair(await pair.getReserves()))
          .eql(fmtPricePair(await uniswapRouter.getReserves(templeToken.address, fraxToken.address)));

        // Expect temple balances to match
        expect(fromAtto(await templeToken.balanceOf(await alan.getAddress())))
          .eq(fromAtto(await templeToken.balanceOf(await ben.getAddress())))

        // Expect price to be above dynamic threshold
        const [dtpFrax, dtpTemple] = fmtPricePair(await templeRouter.dynamicThresholdPrice());
        const [rTemple, rFrax] = fmtPricePair(await pair.getReserves());
        expect(rFrax / rTemple).gte(dtpFrax / dtpTemple);

        // Now, if we mint again, we expect less slippage on AMM, and the dtp price to be the start price of the last buy
        await templeRouter.swapExactFraxForTemple(toAtto(1000), 1, await alan.getAddress(), expiryDate());
        expect(fmtPricePair(await pair.getReserves()))
          .eql([rTemple, rFrax]);
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
    });

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
        ["spot just above to price", 1000000, 99999, 1],
        ["spot well above to price", 1000000, 1000, 1],
      ]

      // add cases across the range
      const fromPrice = 1;
      const toPrice = 10;
      for (let i = 0; i < 10; i += 2) {
        const spot = 1+i;
        cases.push([`Ratio at $${spot} for price range (1,10)`, 1+i,1, (spot - fromPrice) / (toPrice - fromPrice)]);
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

    xdescribe("Contract Management / ACL", async() => {
      it("only owner can change dynamic decay per block", async () => {
      });

      it("only owner can change dynamic threshold percentage", async () => {
      });

      it("only owner can set interpolation from/to price", async () => {
      });

      it("only owner can toggle access", async () => {
      });

      it("Need appropriate role to add allowed user", async () => {
      });

      it("Only owner can remove a user from the allowed list", async () => {
      });

      it("UniswapV2Pair has access control enabled s.t only a single router can call swap (permissioned access)", async () => {
      });

      it("Owner can change the active router on the UniswapV2Pair", async () => {
      });

      it("Need to be on allowedlist to call router and swap (before open access is enabled)", async () => {
      });

      it("Once open access is enabled, anyone can swap frax/temple", async () => {
      });
    })
})