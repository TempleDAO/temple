import { ethers } from "hardhat";
import { expect } from "chai";
import { blockTimestamp, deployAndAirdropTemple, ERC20Light, expectBalancesChangeBy, fromAtto, mineForwardSeconds, mineToTimestamp, toAtto } from "../helpers";
import { BaseContract, BigNumberish, Signer } from "ethers";
import { 
  Exposure,
  Exposure__factory,
  IERC20,
  JoiningFee,
  JoiningFee__factory,
  TempleERC20Token, 
  Vault, 
  VaultedTemple, 
  VaultedTemple__factory, 
  Vault__factory
} from "../../typechain";
import { mkRebasingERC20TestSuite } from "./rebasing-erc20-testsuite";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("Temple Core Vault", async () => {
  let vault: Vault;
  let templeExposure: Exposure;
  let vaultedTemple: VaultedTemple;
  let templeToken: TempleERC20Token;
  let joiningFee: JoiningFee;

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
    )

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
    )

    await templeExposure.setMinterState(vault.address, true);
    await templeExposure.setMinterState(await owner.getAddress(), true);

    await templeToken.connect(alan).approve(vault.address, toAtto(1000000));
    await templeToken.connect(ben).approve(vault.address, toAtto(1000000));
  });

  it("Single stakers deposit (only in the entry/exit window)", async () => {
    await expect(() => vault.connect(alan).deposit(toAtto(100)))
      .to.changeTokenBalance(vault, alan, toAtto(100));

    // can still deposit during 5 minute buffer period
    await mineForwardSeconds(60);
    await expect(() => vault.connect(alan).deposit(toAtto(100)))
      .to.changeTokenBalance(vault, alan, toAtto(100));

    // Post buffer, can no longer join
    await mineForwardSeconds(60 * 5);
    await expect(vault.connect(alan).deposit(toAtto(100)))
        .to.be.revertedWith("Vault: Cannot join vault when outside of enter/exit window");
  }) 

  it("Single staker withdraw, if in the entry/exit window", async () => {
    await expect(() => vault.connect(alan).deposit(toAtto(100)))
      .to.changeTokenBalance(vault, alan, toAtto(100));

    // cannot withdraw in the first vault cycle
    await expect(vault.connect(alan).withdraw(toAtto(10)))
        .to.be.revertedWith("Vault: Cannot exit vault when outside of enter/exit window");

    // cannot withdraw in the first vault cycle during the buffer period
    await mineForwardSeconds(60*2);
    await expect(vault.connect(alan).withdraw(toAtto(10)))
        .to.be.revertedWith("Vault: Cannot exit vault when outside of enter/exit window");
    
    // can withdraw again with the vault cycles, and every entry/Exit cycle thereafter
    await mineForwardSeconds(60 * 8);
    await expectBalancesChangeBy(
      () => vault.connect(alan).withdraw(toAtto(50)),
      ...vaultTempleTransferBalanceChanges(alan, 50)
    );

    await mineForwardSeconds(60 * 6);
    await expect(vault.connect(alan).withdraw(toAtto(10)))
        .to.be.revertedWith("Vault: Cannot exit vault when outside of enter/exit window");

    await mineForwardSeconds(60 * 4);
    await expectBalancesChangeBy(
      () => vault.connect(alan).withdraw(toAtto(50)),
      ...vaultTempleTransferBalanceChanges(alan, 50)
    );
  })

  it("Multi-staker deposit then withdraw", async () => {
    await vault.connect(alan).deposit(toAtto(100));
    await vault.connect(ben).deposit(toAtto(100));

    expect(fromAtto(await vault.balanceOf(await alan.getAddress()))).eq(100);
    expect(fromAtto(await vault.balanceOf(await ben.getAddress()))).eq(100);

    await mineForwardSeconds(60*10);

    await expectBalancesChangeBy(
      () => vault.connect(alan).withdraw(toAtto(100)),
      ...vaultTempleTransferBalanceChanges(alan, 100)
    )

    await expectBalancesChangeBy(
      () => vault.connect(ben).withdraw(toAtto(100)),
      ...vaultTempleTransferBalanceChanges(ben, 100)
    )
  })

  it("deposit/withdrawals with rebases", async () => {
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

    await mineForwardSeconds(60*10);

    await expectBalancesChangeBy(async () => {
      await vault.connect(alan).withdraw(toAtto(200))
      await vault.connect(ben).withdraw(toAtto(100))
    }, 
      [templeExposure, vault, toAtto(-300)],

      // actual vaulted temple
      [templeToken, vaultedTemple, toAtto(-300)],

      // change in ERC20 allocation for account across
      // vault and actual temple
      [templeToken, alan, toAtto(200)],
      [vault,       alan, toAtto(-200)],

      [templeToken, ben, toAtto(100)],
      [vault,       ben, toAtto(-100)],
    );
  })

  it("Handles InEnterExitWindow when firstPeriodStartTimeStamp is in the future", async () => {
    const futureTimestamp = await blockTimestamp() + 3600; 
    const futureVault = await new Vault__factory(owner).deploy(
      "Temple 1m Vault",
      "TV_1M",
      templeToken.address,
      templeExposure.address,
      vaultedTemple.address,
      60 * 5,
      60,
      { p: 1, q: 1},
      joiningFee.address,
      futureTimestamp
    )

    await futureVault.inEnterExitWindow();
  })

  it("Handles correctly when periodDuration == enterExitPeriodDuration", async () => {
    const futureTimestamp = await blockTimestamp(); 
    const futureVault = await new Vault__factory(owner).deploy(
      "Temple 1m Vault",
      "TV_1M",
      templeToken.address,
      templeExposure.address,
      vaultedTemple.address,
      60 * 5,
      60 * 5,
      { p: 1, q: 1},
      joiningFee.address,
      futureTimestamp
    )

    await futureVault.inEnterExitWindow();
  })

  it("Doesn't attempt to deposit when joining fee is higher that deposit amount", async () => {
      const now = await blockTimestamp();
      await mineToTimestamp((now+2592000)-86400); // with default 1 temple per hour, fee will be around 690

      const pastVault = await new Vault__factory(owner).deploy(
        "Temple 3m Vault",
        "TV_3M",
        templeToken.address,
        templeExposure.address,
        vaultedTemple.address,
        7776000,
        2592000,
        { p: 1, q: 1},
        joiningFee.address,
        now
      );

      await expect(pastVault.connect(alan).deposit(toAtto(600)))
        .to.be.revertedWith("Vault: Cannot join when fee is higher than amount");

      // clean up evm
      await ethers.provider.send("hardhat_reset", []);
  })

  it("Correctly handles withdrawFor", async () => {
    const amount = toAtto(100);
    const deadline = await blockTimestamp() + (60*20);

    const domain = {
      name: await vault.name(),
      version: '1',
      chainId: await alan.getChainId(),
      verifyingContract: vault.address      
    };

    const types = {
      withdrawFor: [
        {name: "owner", type: "address"},
        {name: "sender", type: "address"},
        {name: "amount", type: "uint256"},
        {name: "deadline", type: "uint256"},
        {name: "nonce", type: "uint256"}
      ]
    }

    const msg = {
      owner: await alan.getAddress(),
      sender: await owner.getAddress(),
      amount: amount,
      deadline: deadline,
      nonce: await vault.nonces(await alan.getAddress())
    }

    const sig = await alan._signTypedData(domain, types, msg);
    const splitSig = ethers.utils.splitSignature(sig);
    await vault.connect(alan).deposit(amount);

    const beforeBal = await templeToken.balanceOf(await owner.getAddress());

    await mineForwardSeconds(60 * 10);
    await vault.withdrawFor(await alan.getAddress(), amount, deadline, splitSig.v, splitSig.r, splitSig.s);

    const afterBal = await templeToken.balanceOf(await owner.getAddress());

    expect(beforeBal.add(amount)).equals(afterBal);
  })

  it("only vault owner can redeem an exposure", async () => {
    await expect(vault.connect(alan).redeemExposures([templeExposure.address]))
      .to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount").withArgs(await alan.getAddress());
  });

  it("only owner can withdraw vaulted temple (for DAO leverage)", async () => {
    await expect(vaultedTemple.connect(alan)
      .withdraw(templeToken.address, await alan.getAddress(), 100))
      .to.be.revertedWithCustomError(vaultedTemple, "OwnableUnauthorizedAccount").withArgs(await alan.getAddress());

    await templeToken.mint(vaultedTemple.address, 100);

    await expect(async () => 
      vaultedTemple.withdraw(templeToken.address, await alan.getAddress(), 100)
    ).to.changeTokenBalance(templeToken, alan, 100)
  });

  it("only temple exposure can call toTemple on vaulted temple contract", async () => {
    await expect(vaultedTemple.toTemple(100, alan.getAddress()))
      .to.revertedWith("VaultedTemple: Only TempeExposure can redeem temple on behalf of a vault")
    await templeToken.mint(vaultedTemple.address, 100);
    await templeExposure.mint(alan.getAddress(), 100);
    await expect(async () => templeExposure.connect(alan).redeem({gasLimit:5000000}))
      .to.changeTokenBalance(templeToken, alan, 100);
  });

  it("Provides enough information for FE to determine whether deposit is claimable or not", async () => {
    await vault.connect(alan).deposit(toAtto(100));

    let [, inWindow] = await vault.inEnterExitWindow();
    let canExit = await vault.canExit();

    // We have a deposit, we're in the window and canExit is false
    expect(inWindow).true;
    expect(canExit).false;
    expect(await vault.balanceOf(await alan.getAddress())).equals(toAtto(100));
    await expect(vault.connect(alan).withdraw(toAtto(100))).to.be.revertedWith("Vault: Cannot exit vault when outside of enter/exit window");

    await mineForwardSeconds(60 * 10);

    [, inWindow] = await vault.inEnterExitWindow();
    canExit = await vault.canExit();
    expect(inWindow).true;
    expect(canExit).true;
    expect(await vault.balanceOf(await alan.getAddress())).equals(toAtto(100));
    await vault.connect(alan).withdraw(toAtto(100));
  })

  mkRebasingERC20TestSuite(async () => {
    await vault.connect(alan).deposit(toAtto(300));
    await vault.connect(ben).deposit(toAtto(300));

    return {
      accounts: [[alan, toAtto(300)], [ben, toAtto(300)]],
      token: vault as unknown as IERC20,
      rebaseUp: async () => await templeToken.transfer(vault.address, toAtto(600)),
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      rebaseDown: async () => {} // temple vaults can never loose principal
    }
  })
})