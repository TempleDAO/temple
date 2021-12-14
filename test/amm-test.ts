import { ethers, hardhatArguments } from "hardhat";
import { expect } from "chai";

import { FakeERC20, FakeERC20__factory, TempleERC20Token, TempleERC20Token__factory, TempleFraxAMMRouter, TempleFraxAMMRouter__factory, TempleTreasury, TempleTreasury__factory, TempleUniswapV2Pair, TempleUniswapV2Pair__factory, UniswapV2Factory, UniswapV2Factory__factory, UniswapV2Pair, UniswapV2Pair__factory, UniswapV2Router02NoEth, UniswapV2Router02NoEth__factory } from "../typechain";

import { BigNumber, Signer } from "ethers";
import { toAtto } from "./helpers";

import { fromAtto } from "../scripts/deploys/helpers";
import { factory } from "typescript";

const fmtReserves = (reserves: [BigNumber, BigNumber, number?]): [number, number] => {
  return [fromAtto(reserves[0]), fromAtto(reserves[1])]
}

describe("AMM", async () => {
    let templeToken: TempleERC20Token;
    let fraxToken: FakeERC20;
    let treasury: TempleTreasury;
    let owner: Signer;
    let alan: Signer;
    let ben: Signer
    let pair: TempleUniswapV2Pair;
    let templeRouter: TempleFraxAMMRouter;
    let uniswapFactory: UniswapV2Factory;
    let uniswapRouter: UniswapV2Router02NoEth;
    let uniswapPair: UniswapV2Pair;

    const expiryDate = (): number =>  Math.floor(Date.now() / 1000) + 900;
   
    beforeEach(async () => {
      [owner, alan, ben] = await ethers.getSigners();

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
        {frax: 1000000, temple: 4000000},
        100000, /* threshold decay per block */
        {frax: 1000000, temple: 1000000},
        {frax: 1000000, temple: 12000000},
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
        // do swaps
        await uniswapRouter.swapExactTokensForTokens(toAtto(100), 1, [fraxToken.address, templeToken.address], await ben.getAddress(), expiryDate());
        await templeRouter.swapExactFraxForTemple(toAtto(100), 1, await alan.getAddress(), expiryDate());

        // Expect reserves to match
        expect(fmtReserves(await pair.getReserves()))
          .eql(fmtReserves(await uniswapRouter.getReserves(templeToken.address, fraxToken.address)));

        // Expect temple balances to match
        expect(fromAtto(await templeToken.balanceOf(await alan.getAddress())))
          .eq(fromAtto(await templeToken.balanceOf(await ben.getAddress())))
      })

      xit("Above dynamic threshold should have some portion of buy minted on protocol", async() => {
        // do swaps
        await uniswapRouter.swapExactTokensForTokens(toAtto(100), 1, [fraxToken.address, templeToken.address], await ben.getAddress(), expiryDate());
        await templeRouter.swapExactFraxForTemple(toAtto(100), 1, await alan.getAddress(), expiryDate());

        // Expect reserves to match
        expect(fmtReserves(await pair.getReserves()))
          .eql(fmtReserves(await uniswapRouter.getReserves(templeToken.address, fraxToken.address)));

        // Expect temple balances to match
        expect(fromAtto(await templeToken.balanceOf(await alan.getAddress())))
          .eq(fromAtto(await templeToken.balanceOf(await ben.getAddress())))
      })
    });

    describe("Sell", async() => {
      it.only("Above IV sells should be same as on AMM", async() => {
        // do swaps
        await uniswapRouter.swapExactTokensForTokens(toAtto(100), 1, [templeToken.address, fraxToken.address], await ben.getAddress(), expiryDate());
        await templeRouter.swapExactTempleForFrax(toAtto(100), 1, await alan.getAddress(), expiryDate());

        // Expect reserves to match
        expect(fmtReserves(await pair.getReserves()))
          .eql(fmtReserves(await uniswapRouter.getReserves(templeToken.address, fraxToken.address)));

        // Expect temple balances to match
        expect(fromAtto(await templeToken.balanceOf(await alan.getAddress())))
          .eq(fromAtto(await templeToken.balanceOf(await ben.getAddress())))
      })

      xit("Below IV sells should always be exactly at IV", async() => {
        // do swaps
        await uniswapRouter.swapExactTokensForTokens(toAtto(100), 1, [fraxToken.address, templeToken.address], await ben.getAddress(), expiryDate());
        await templeRouter.swapExactFraxForTemple(toAtto(100), 1, await alan.getAddress(), expiryDate());

        // Expect reserves to match
        expect(fmtReserves(await pair.getReserves()))
          .eql(fmtReserves(await uniswapRouter.getReserves(templeToken.address, fraxToken.address)));

        // Expect temple balances to match
        expect(fromAtto(await templeToken.balanceOf(await alan.getAddress())))
          .eq(fromAtto(await templeToken.balanceOf(await ben.getAddress())))
      })
    });

    describe("Liquidity", async() => {
      it("add", async () => {
        // Expect reserves to match before/after adding liquidity
        expect(fmtReserves(await pair.getReserves()))
          .eql(fmtReserves(await uniswapRouter.getReserves(templeToken.address, fraxToken.address)));

        await templeRouter.addLiquidity(toAtto(100000), toAtto(1000000), 1, 1, await owner.getAddress(), expiryDate());
        await uniswapRouter.addLiquidity(templeToken.address, fraxToken.address, toAtto(100000), toAtto(1000000), 1, 1, await owner.getAddress(), expiryDate())

        expect(fmtReserves(await pair.getReserves()))
          .eql(fmtReserves(await uniswapRouter.getReserves(templeToken.address, fraxToken.address)));
      });

      it("remove", async () => {
        // Expect reserves to match before/after adding liquidity
        expect(fmtReserves(await pair.getReserves()))
          .eql(fmtReserves(await uniswapRouter.getReserves(templeToken.address, fraxToken.address)));

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
        expect(fmtReserves(await pair.getReserves()))
          .eql(fmtReserves(await uniswapRouter.getReserves(templeToken.address, fraxToken.address)));

        expect(await uniswapPair.balanceOf(await owner.getAddress()))
          .eql(await pair.balanceOf(await owner.getAddress()))
      });
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