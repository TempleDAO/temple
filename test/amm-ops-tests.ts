import { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumber, Signer } from "ethers";
import { FakeERC20, FakeERC20__factory, 
  TempleERC20Token, TempleERC20Token__factory, 
  TempleFraxAMMRouter, TempleFraxAMMRouter__factory, 
  TempleTreasury, TempleTreasury__factory, 
  TempleUniswapV2Pair, TempleUniswapV2Pair__factory,
  TempleFraxAMMOps, TempleFraxAMMOps__factory,
  TreasuryManagementProxy, TreasuryManagementProxy__factory } from "../typechain";
import { toAtto, shouldThrow } from "./helpers";

describe("AMM Ops", async () => {
  let templeToken: TempleERC20Token;
  let fraxToken: FakeERC20;
  let treasury: TempleTreasury;
  let owner: Signer;
  let manager: Signer;
  let alan: Signer;
  let pair: TempleUniswapV2Pair;
  let templeRouter: TempleFraxAMMRouter;
  let ammOps: TempleFraxAMMOps;
  let treasuryManagementProxy: TreasuryManagementProxy;

  const expiryDate = (): number =>  Math.floor(Date.now() / 1000) + 900;

  beforeEach(async () => {
    [owner, manager, alan] = await ethers.getSigners();

    templeToken = await new TempleERC20Token__factory(owner).deploy();
    fraxToken = await new FakeERC20__factory(owner).deploy("STABLEC", "STABLEC");

    await templeToken.addMinter(await owner.getAddress()),

    await Promise.all([
      fraxToken.mint(await owner.getAddress(), toAtto(10000)),
      templeToken.mint(await owner.getAddress(), toAtto(100)),
    ]);

    treasury = await new TempleTreasury__factory(owner).deploy(
      templeToken.address,
      fraxToken.address,
    );

    await templeToken.addMinter(treasury.address);
    await fraxToken.increaseAllowance(treasury.address, toAtto(1000));
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

    // Add liquidity to both AMMs
    await templeToken.increaseAllowance(templeRouter.address, toAtto(10000000));
    await fraxToken.increaseAllowance(templeRouter.address, toAtto(10000000));
    await templeRouter.addLiquidity(toAtto(10), toAtto(1), 1, 1, await owner.getAddress(), expiryDate());

    // Make temple router open access (useful state for most tests)
    await templeRouter.toggleOpenAccess();

    treasuryManagementProxy = await new TreasuryManagementProxy__factory(owner).deploy(
      await owner.getAddress(), 
      treasury.address
    );
    await treasury.transferOwnership(treasuryManagementProxy.address);

    // deploy amm ops
    ammOps = await new TempleFraxAMMOps__factory(owner).deploy(
      templeToken.address,
      templeRouter.address,
      treasuryManagementProxy.address,
      fraxToken.address,
      treasury.address,
      pair.address
    );

    // mint some temple and frax to ammOps
    await Promise.all([
      fraxToken.mint(ammOps.address, toAtto(100000)),
      templeToken.mint(ammOps.address, toAtto(10)),
      fraxToken.mint(treasury.address, toAtto(100000)),
    ]);
  });

  it("owner tests", async() => {
    // should set manager as owner
    await ammOps.connect(owner).setManager(await manager.getAddress());
    expect(await ammOps.manager()).to.equal(await manager.getAddress());

    // should withdraw as owner
    const templeBalanceBefore = await templeToken.balanceOf(ammOps.address);
    const managerTempleBalanceBefore = await templeToken.balanceOf(await manager.getAddress());
    await ammOps.connect(owner).withdraw(templeToken.address, await manager.getAddress(), 100);
    expect(await templeToken.balanceOf(ammOps.address)).to.equal(templeBalanceBefore.sub(100));
    expect(await templeToken.balanceOf(await manager.getAddress())).to.equal(managerTempleBalanceBefore.add(100));

    // expected fails
    await shouldThrow(ammOps.connect(alan).setManager(await alan.getAddress()), /Ownable: caller is not the owner/);
    await shouldThrow(ammOps.connect(manager).withdraw(templeToken.address, await alan.getAddress(), 100), /Ownable: caller is not the owner/);
  });

  it("withdraws right tokens and amounts", async () => {
    const oneEther = ethers.utils.parseEther("1");
    // address zero
    await shouldThrow(ammOps.withdraw(templeToken.address, "0x0000000000000000000000000000000000000000", 5), /to address zero/);

    // eth sent (by mistake)
    await owner.sendTransaction({to: ammOps.address, value: oneEther});
    const alanBalanceEth = await alan.getBalance();
    await ammOps.withdraw("0x0000000000000000000000000000000000000000", await alan.getAddress(), oneEther);
    expect(await alan.getBalance()).to.equal(alanBalanceEth.add(oneEther));

    // temple and frax
    const alanBalanceFrax = await fraxToken.balanceOf(await alan.getAddress());
    await ammOps.withdraw(fraxToken.address, await alan.getAddress(), 5);
    expect(await fraxToken.balanceOf(await alan.getAddress())).to.equal(alanBalanceFrax.add(5));
    

    const managerTempleBalance = await templeToken.balanceOf(await manager.getAddress());
    await ammOps.connect(owner).withdraw(templeToken.address, await manager.getAddress(), 100);
    expect(await templeToken.balanceOf(await manager.getAddress())).to.equal(managerTempleBalance.add(100));
  });

  it("can add/remove liquidity", async () => {
    // owner or manager can add liquidity
    const balanceBefore = await pair.balanceOf(ammOps.address);
    await ammOps.deepenLiquidity(toAtto(10), toAtto(10), 1, 1);
    expect(await pair.balanceOf(ammOps.address)).to.gt(balanceBefore);

    await ammOps.setManager(await manager.getAddress());
    const liquidityBefore = await pair.balanceOf(ammOps.address);
    await ammOps.connect(manager).removeLiquidity(liquidityBefore, 1, 1);
    expect(await pair.balanceOf(ammOps.address)).to.equal(0);


    // failed attempts by non-owner/manager
    await shouldThrow(ammOps.connect(alan).deepenLiquidity(toAtto(100), toAtto(100), 1, 1), /only owner or manager/);
    await shouldThrow(ammOps.connect(alan).removeLiquidity(toAtto(100), toAtto(100), 1), /only owner or manager/);
  });

  it("can raise treasury intrinsic value", async () => {
    const treasuryFraxBalance = await fraxToken.balanceOf(treasury.address);
    const ammOpsFraxBalance = await fraxToken.balanceOf(ammOps.address);

    await ammOps.connect(owner).raiseIV(100);
    expect(await fraxToken.balanceOf(treasury.address)).to.gt(treasuryFraxBalance);
    expect(await fraxToken.balanceOf(ammOps.address)).to.equal(ammOpsFraxBalance.sub(100));
  });

});