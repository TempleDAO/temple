import { ethers } from "hardhat";
import { expect } from "chai";
import { deployAndAirdropTemple, fromAtto, mineForwardSeconds, toAtto } from "../helpers";
import { BigNumber, Signer } from "ethers";
import { 
  JoiningFee,
  JoiningFee__factory,
  TempleERC20Token, 
  Vault, 
  Vault__factory
} from "../../typechain";
import { fail } from "assert";

describe("Temple Core Vault", async () => {
  let vault: Vault;
  let templeToken: TempleERC20Token;
  let joiningFee: JoiningFee;

  let owner: Signer;
  let alan: Signer;
  let ben: Signer;

  beforeEach(async () => {
    [owner, alan, ben] = await ethers.getSigners();

    templeToken = await deployAndAirdropTemple(
      owner,
      [owner, alan, ben],
      toAtto(100000)
    );

    joiningFee = await new JoiningFee__factory(owner).deploy(
        toAtto(1),
    );

    vault = await new Vault__factory(owner).deploy(
        "Temple 1m Vault",
        "TV_1M",
        templeToken.address,
        60 * 5,
        60,
        { p: 1, q: 1},
        joiningFee.address
    )

    await templeToken.connect(alan).increaseAllowance(vault.address, toAtto(1000000));
    await templeToken.connect(ben).increaseAllowance(vault.address, toAtto(1000000));
  });

  it("Single stakers deposit (only in the entry/exit window)", async () => {
    await expect(() => vault.connect(alan).deposit(toAtto(100)))
      .to.changeTokenBalance(vault, alan, toAtto(100));

    await mineForwardSeconds(60);
    await expect(vault.connect(alan).deposit(toAtto(100)))
        .to.be.revertedWith("Vault: Cannot join vault when outside of enter/exit window");
  }) 

  it("Single staker withdraw, if in the entry/exit window", async () => {
    await expect(() => vault.connect(alan).deposit(toAtto(100)))
      .to.changeTokenBalance(vault, alan, toAtto(100));

    await mineForwardSeconds(60);
    await expect(vault.connect(alan).withdraw(toAtto(100)))
        .to.be.revertedWith("Vault: Cannot exit vault when outside of enter/exit window");

    await mineForwardSeconds(60 * 4);
    await expect(() => vault.connect(alan).withdraw(toAtto(100)))
        .to.changeTokenBalance(templeToken, alan, toAtto(100));
  })

  it("Multi-staker deposit then withdraw", async () => {
    await vault.connect(alan).deposit(toAtto(100));
    await vault.connect(ben).deposit(toAtto(100));

    expect(fromAtto(await vault.balanceOf(await alan.getAddress()))).eq(100);
    expect(fromAtto(await vault.balanceOf(await ben.getAddress()))).eq(100);

    await mineForwardSeconds(60*5);

    await expect(() => vault.connect(alan).withdraw(toAtto(100)))
        .to.changeTokenBalance(templeToken, alan, toAtto(100));
    await expect(() => vault.connect(ben).withdraw(toAtto(100)))
        .to.changeTokenBalance(templeToken, ben, toAtto(100));
  })

  it("deposit/withdrawals with rebases", async () => {
    await expect(() => vault.connect(alan).deposit(toAtto(100)))
      .to.changeTokenBalance(vault, alan, toAtto(100));

    await expect(() => templeToken.transfer(vault.address, toAtto(100)))
      .to.changeTokenBalance(vault, alan, toAtto(100));

    await expect(() => vault.connect(ben).deposit(toAtto(100)))
      .to.changeTokenBalance(vault, ben, toAtto(100));

    await mineForwardSeconds(60*5);

    await expect(() => vault.connect(alan).withdraw(toAtto(200)))
      .to.changeTokenBalance(templeToken, alan, toAtto(200));

    await expect(() => vault.connect(ben).withdraw(toAtto(100)))
      .to.changeTokenBalance(templeToken, ben, toAtto(100));
  })


  xit("allows redeeming an exposure back to temple", async () => {
    // TODO(butler): write test
    fail("Unimplemented");
  });

  describe("ERC20 verification", async () => {
    let accounts: [Signer, BigNumber][] = [];

    beforeEach(async () => {
      await vault.connect(alan).deposit(toAtto(300));
      await vault.connect(ben).deposit(toAtto(300));
      accounts = [[alan, toAtto(300)], [ben,  toAtto(300)]]
    })

    it("Has expected initial balances", async () => {
      for (const [user, initialBalance] of accounts) {
        expect(await vault.balanceOf(await user.getAddress())).eql(initialBalance)
      }
    })

    it("Transfer changes balances", async () => {
      const [[alan, _0], [ben, _1]] = accounts;

      await expect(async () => vault.connect(alan).transfer(await ben.getAddress(), 111))
        .to.changeTokenBalances(vault, [alan, ben], [-111, 111])
    })

    it("Transfer works across rebases balances", async () => {
      const [[alan, _0], [ben, _1]] = accounts;

      await expect(async () => vault.connect(alan).transfer(await ben.getAddress(), toAtto(111)))
        .to.changeTokenBalances(vault, [alan, ben], [`-${toAtto(111).toString()}`, toAtto(111)])

      await templeToken.transfer(vault.address, toAtto(600));

      await expect(async () => vault.connect(alan).transfer(await ben.getAddress(), toAtto(111)))
        .to.changeTokenBalances(vault, [alan, ben], [`-${toAtto(111).toString()}`, toAtto(111)])
    })

    it("Transfer emits event", async () => {
      const [[alan, _0], [ben, _1]] = accounts;

      await expect(vault.connect(alan).transfer(await ben.getAddress(), toAtto(100)))
        .to.emit(vault, "Transfer")
        .withArgs(await alan.getAddress(), await ben.getAddress(), toAtto(100))
    })

    it("Can not transfer above the amount", async () => {
      const [[alan, alanBalance], [ben, _]] = accounts;

      await expect(vault.connect(alan).transfer(await ben.getAddress(), alanBalance.add(toAtto(100))))
        .to.be.revertedWith("ERC20: transfer amount exceeds balance")
    })

    it("totalSupply", async () => {
      let expectedTotalSupply = BigNumber.from(0);

      for (const [user, initialBalance] of accounts) {
        expectedTotalSupply = expectedTotalSupply.add(initialBalance);
      }

      expect(await vault.totalSupply()).eql(expectedTotalSupply);
    })

    it("initial balances + totalSupply rebases correctly", async () => {
      await templeToken.transfer(vault.address, toAtto(600));

      let expectedTotalSupply = BigNumber.from(0);
      for (const [user, initialBalance] of accounts) {
        expect(await vault.balanceOf(await user.getAddress())).eql(initialBalance.mul(2))
        expectedTotalSupply = expectedTotalSupply.add(initialBalance);
      }

      expect(await vault.totalSupply()).eql(expectedTotalSupply.mul(2));
    })

    it("allowance", async () => {
      const [[alan, _1], [ben, _2]] = accounts;

      expect(await vault.allowance(await alan.getAddress(), await ben.getAddress())).eq(0);
      await vault.connect(alan).approve(await ben.getAddress(), 111);
      expect(await vault.allowance(await alan.getAddress(), await ben.getAddress())).eq(111);
    })

    it("allowance remains unchanged during rebases", async () => {
      const [[alan, _1], [ben, _2]] = accounts;

      await vault.connect(alan).approve(await ben.getAddress(), toAtto(111));
      expect(fromAtto(await vault.allowance(await alan.getAddress(), await ben.getAddress()))).eq(111);

      await templeToken.transfer(vault.address, toAtto(600));
      expect(fromAtto(await vault.allowance(await alan.getAddress(), await ben.getAddress()))).eq(111);
    })

    it("transferFrom", async () => {
      const [[alan, _1], [ben, _2]] = accounts;

      await expect(vault.transferFrom(await alan.getAddress(), await ben.getAddress(), 111))
        .to.be.revertedWith("ERC20: transfer amount exceeds allowance");

      await vault.connect(alan).approve(await ben.getAddress(), 111);

      await expect(async () => vault.connect(ben).transferFrom(await alan.getAddress(), await ben.getAddress(), 111))
        .to.changeTokenBalances(vault, [alan, ben], [-111, 111]);
    })

    it("transferFrom works across rebases", async () => {
      const [[alan, _1], [ben, _2]] = accounts;

      await vault.connect(alan).approve(await ben.getAddress(), toAtto(1000));

      await expect(async () => vault.connect(ben).transferFrom(await alan.getAddress(), await ben.getAddress(), toAtto(111)))
        .to.changeTokenBalances(vault, [alan, ben], [`-${toAtto(111).toString()}`, toAtto(111)])

      await templeToken.transfer(vault.address, toAtto(600));

      await expect(async () => vault.connect(ben).transferFrom(await alan.getAddress(), await ben.getAddress(), toAtto(111)))
        .to.changeTokenBalances(vault, [alan, ben], [`-${toAtto(111).toString()}`, toAtto(111)])
    })
  });
})