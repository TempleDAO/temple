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
import { fail } from "assert";
import { mkRebasingERC20TestSuite } from "./rebasing-erc20-testsuite";

describe("Temple Core Vault", async () => {
  let vault: Vault;
  let templeExposure: Exposure;
  let vaultedTemple: VaultedTemple;
  let templeToken: TempleERC20Token;
  let joiningFee: JoiningFee;

  let owner: Signer;
  let alan: Signer;
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
      await owner.getAddress(),
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

    await templeToken.connect(alan).increaseAllowance(vault.address, toAtto(1000000));
    await templeToken.connect(ben).increaseAllowance(vault.address, toAtto(1000000));
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

    // can still withdraw during 5 minute buffer period
    await mineForwardSeconds(60);
    
    await expectBalancesChangeBy(
      () => vault.connect(alan).withdraw(toAtto(50)),
      ...vaultTempleTransferBalanceChanges(alan, 50)
    )

    // post buffer, can no longer withdraw
    await mineForwardSeconds(60 * 5);
    await expect(vault.connect(alan).withdraw(toAtto(10)))
        .to.be.revertedWith("Vault: Cannot exit vault when outside of enter/exit window");

    // can withdraw again with the vault cycles
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

    await mineForwardSeconds(60*5);

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

    await mineForwardSeconds(60*5);

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

  xit("cannot redeem exposures when outside of the entry/exit window", async () => {
    // TODO(butler): write test
    fail("Unimplemented");
  });

  xit("allows redeeming an exposure back to temple", async () => {
    // TODO(butler): write test
    fail("Unimplemented");
  });

  mkRebasingERC20TestSuite(async () => {
    await vault.connect(alan).deposit(toAtto(300));
    await vault.connect(ben).deposit(toAtto(300));

    return {
      accounts: [[alan, toAtto(300)], [ben, toAtto(300)]],
      token: vault as unknown as IERC20,
      rebaseUp: async () => await templeToken.transfer(vault.address, toAtto(600)),
      rebaseDown: async () => {} // temple vaults can never loose principal
    }
  })
})