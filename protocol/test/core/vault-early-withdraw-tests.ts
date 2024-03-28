import { ethers } from "hardhat";
import { expect } from "chai";
import { blockTimestamp, deployAndAirdropTemple, ERC20Light, expectBalancesChangeBy, mineForwardSeconds, toAtto } from "../helpers";
import { BaseContract, BigNumberish, Signer, constants } from "ethers";
import { 
  Exposure,
  Exposure__factory,
  JoiningFee,
  JoiningFee__factory,
  TempleERC20Token, 
  Vault, 
  VaultedTemple, 
  VaultedTemple__factory, 
  Vault__factory,
  VaultEarlyWithdraw,
  VaultEarlyWithdraw__factory,
} from "../../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("Temple Core Vault - Early Withdraw", async () => {
  let vault: Vault;
  let templeExposure: Exposure;
  let vaultedTemple: VaultedTemple;
  let templeToken: TempleERC20Token;
  let joiningFee: JoiningFee;

  let vaultEarlyWithdraw: VaultEarlyWithdraw;

  let owner: Signer;
  let alan: SignerWithAddress;
  let ben: Signer;

  // Helper to generate expected token balance changes for 
  // vault interactions
  function vaultTempleTransferBalanceChanges(
    account: Signer,
    amount: number
  ): [ERC20Light, Signer|BaseContract, BigNumberish][] {
    return [
      // vault temple book keeping
      [templeExposure, vault, toAtto(-amount)],

      // actual vaulted temple
      [templeToken, vaultedTemple, toAtto(-amount)],

      // change in ERC20 allocation for account across
      // vault and actual temple
      [templeToken, account, toAtto(amount)],
      [vault,       account, toAtto(-amount)],
    ]
  }

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

    templeExposure = await new Exposure__factory(owner).deploy(
      "temple exposure",
      "TPL-VAULT-EXPOSURE",
      templeToken.address,
    );

    vaultedTemple = await new VaultedTemple__factory(owner).deploy(
      templeToken.address,
      templeExposure.address
    );

    await templeExposure.setLiqidator(vaultedTemple.address);

    vault = await new Vault__factory(owner).deploy(
        "Temple 1m Vault",
        "TV_1M",
        templeToken.address,
        templeExposure.address,
        vaultedTemple.address,
        60 * 10,
        60,
        { p: 1, q: 1},
        joiningFee.address,
        await blockTimestamp()
    );

    await templeExposure.setMinterState(vault.address, true);
    await templeExposure.setMinterState(await owner.getAddress(), true);

    await templeToken.connect(alan).approve(vault.address, toAtto(1000000));
    await templeToken.connect(ben).approve(vault.address, toAtto(1000000));

    vaultEarlyWithdraw = await new VaultEarlyWithdraw__factory(owner).deploy(
      templeToken.address,
      [
        vault.address,
      ]
    );

    // Approve the early withdraw contract to pull the vault erc20.
    await vault.connect(alan).approve(vaultEarlyWithdraw.address, toAtto(1000000));
    await vault.connect(ben).approve(vaultEarlyWithdraw.address, toAtto(1000000));

    // Fund the vaultEarlyWithdraw with temple
    await templeToken.mint(vaultEarlyWithdraw.address, toAtto(1000000));
  });

  it("only owner can call pause/unpause/recoverToken", async () => {
    await expect(vaultEarlyWithdraw.connect(alan).pause())
      .to.be.revertedWithCustomError(vaultEarlyWithdraw, "OwnableUnauthorizedAccount").withArgs(await alan.getAddress());
    await expect(vaultEarlyWithdraw.connect(alan).unpause())
      .to.be.revertedWithCustomError(vaultEarlyWithdraw, "OwnableUnauthorizedAccount").withArgs(await alan.getAddress());
    await expect(vaultEarlyWithdraw.connect(alan).recoverToken(templeToken.address, await owner.getAddress(), toAtto(100)))
      .to.be.revertedWithCustomError(vaultEarlyWithdraw, "OwnableUnauthorizedAccount").withArgs(await alan.getAddress());

    await expect(vaultEarlyWithdraw.connect(owner).pause())
      .to.not.be.reverted;
    await expect(vaultEarlyWithdraw.connect(owner).unpause())
      .to.not.be.reverted;
    await expect(vaultEarlyWithdraw.connect(owner).recoverToken(templeToken.address, await owner.getAddress(), toAtto(100)))
      .to.not.be.reverted;
  });

  it("constructor", async () => {
    expect(await vaultEarlyWithdraw.templeToken()).eq(templeToken.address);
    expect(await vaultEarlyWithdraw.validVaults(vault.address)).eq(true);
    expect(await vaultEarlyWithdraw.validVaults(await alan.getAddress())).eq(false);
  });
  
  it("cannot withdraw from an invalid vault", async () => {
    await expect(vaultEarlyWithdraw.connect(alan).withdraw(ben.getAddress(), toAtto(200)))
      .to.be.revertedWithCustomError(vaultEarlyWithdraw, "InvalidVault")
      .withArgs(await ben.getAddress());
  });

  it("cannot withdraw below the min amount", async () => {
    await vault.connect(alan).deposit(toAtto(100));

    await expect(vaultEarlyWithdraw.connect(alan).withdraw(vault.address, 999))
      .to.be.revertedWithCustomError(vaultEarlyWithdraw, "MinAmountNotMet");

    // Succeeds for 1000 (the min amount)
    await vaultEarlyWithdraw.connect(alan).withdraw(vault.address, 1000);
  });

  it("owner can update min withdraw amount", async () => {
    await expect(vaultEarlyWithdraw.connect(alan).setMinWithdrawAmount(1))
      .to.be.revertedWithCustomError(vaultEarlyWithdraw, "OwnableUnauthorizedAccount").withArgs(await alan.getAddress());

    await expect(vaultEarlyWithdraw.connect(owner).setMinWithdrawAmount(1))
      .to.emit(vaultEarlyWithdraw, "MinWithdrawAmountSet")
      .withArgs(1);

    expect(await vaultEarlyWithdraw.minWithdrawAmount()).to.eq(1);
  });

  it("cannot withdraw if not enough temple balance", async () => {
    // Remove any temple from the contract first
    await vaultEarlyWithdraw.recoverToken(
      templeToken.address, 
      await owner.getAddress(), 
      await templeToken.balanceOf(vaultEarlyWithdraw.address)
    );

    await vault.connect(alan).deposit(toAtto(100));

    // Fails as there's no $TEMPLE left.
    await expect(vaultEarlyWithdraw.connect(alan).withdraw(vault.address, toAtto(1))).
      to.be.revertedWithCustomError(templeToken, "ERC20InsufficientBalance");
  });

  it("deposit and early withdrawal", async () => {
    await expect(() => vault.connect(alan).deposit(toAtto(100)))
      .to.changeTokenBalance(vault, alan, toAtto(100));

    await expectBalancesChangeBy(async () => { 
      await templeToken.transfer(vaultedTemple.address, toAtto(100))
      await templeExposure.mint(vault.address, toAtto(100))
    },
      [templeExposure, vault, toAtto(100)],
      [vault, alan, toAtto(100)]
    )

    await expectBalancesChangeBy(
      () => vault.connect(ben).deposit(toAtto(100)),
      ...vaultTempleTransferBalanceChanges(ben, -100)
    )

    // Only 2hrs, instead of 10
    await mineForwardSeconds(60*2);

    // Cannot withdraw directly from the vault early
    await expect(vault.connect(alan).withdraw(toAtto(200)))
      .to.be.revertedWith("Vault: Cannot exit vault when outside of enter/exit window");
    
    // But can withdraw using the VaultEarlyWithdraw
    await expectBalancesChangeBy(async () => {
      await expect(vaultEarlyWithdraw.connect(alan).withdraw(vault.address, toAtto(200)))
        .to.emit(vaultEarlyWithdraw, "EarlyWithdraw")
        .withArgs(await alan.getAddress(), toAtto(200));
      await expect(vaultEarlyWithdraw.connect(ben).withdraw(vault.address, toAtto(100)))
        .to.emit(vaultEarlyWithdraw, "EarlyWithdraw")
        .withArgs(await ben.getAddress(), toAtto(100));
    }, 
      // No change to temple exposure, or vaulted temple
      [templeExposure, vault, toAtto(0)],
      [templeToken, vaultedTemple, toAtto(0)],

      // change in ERC20 allocation for alan/ben accounts across
      // vault and actual temple
      [templeToken, alan, toAtto(200)],
      [vault,       alan, toAtto(-200)],

      [templeToken, ben, toAtto(100)],
      [vault,       ben, toAtto(-100)],

      // The vaultEarlyWithdraw has reduced in temple.
      [templeToken, vaultEarlyWithdraw, toAtto(-300)],

      // The vaultEarlyWithdraw owner has received the vault ERC20
      [vault, owner, toAtto(300)],
    );
  })

  it("cannot withdraw early if paused", async () => {
    await expect(vaultEarlyWithdraw.pause())
      .to.emit(vaultEarlyWithdraw, "Paused")
      .withArgs(await owner.getAddress());

    // Cannot withdraw when paused
    await expect(vaultEarlyWithdraw.withdraw(vault.address, toAtto(100)))
      .to.be.revertedWithCustomError(vaultEarlyWithdraw, "EnforcedPause");

    await expect(vaultEarlyWithdraw.unpause())
      .to.emit(vaultEarlyWithdraw, "Unpaused")
      .withArgs(await owner.getAddress());

    // Can withdraw when unpaused (and as expected, fails from lack of vaulted balance as no deposits)
    await expect(vaultEarlyWithdraw.connect(alan).withdraw(vault.address, toAtto(100)))
      .to.be.revertedWithCustomError(templeToken, "ERC20InsufficientBalance");
  });

  it("owner can recover token", async () => {
    // zero to address reverts
    await expect(vaultEarlyWithdraw.recoverToken(templeToken.address, constants.AddressZero, toAtto(100)))
      .to.be.reverted;

    await expectBalancesChangeBy(async () => {
      await expect(vaultEarlyWithdraw.recoverToken(templeToken.address, await alan.getAddress(), toAtto(100)))
        .to.emit(vaultEarlyWithdraw, "TokenRecovered")
        .withArgs(templeToken.address, await alan.getAddress(), toAtto(100));
    }, 
      // Temple gets pulled from the vaultEarlyWithdraw
      [templeToken, vaultEarlyWithdraw, toAtto(-100)],
      // And is sent to alan
      [templeToken, alan, toAtto(100)],
    );
  });

  it("cannot send eth to vaultEarlyWithdraw", async () => {
    await expect(owner.sendTransaction(
      {
        to: vaultEarlyWithdraw.address,
        value: toAtto(1)
      }
    )).to.be.reverted;
  });
})