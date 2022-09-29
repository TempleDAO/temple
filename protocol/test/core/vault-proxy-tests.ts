import { ethers } from "hardhat";
import { blockTimestamp, deployAndAirdropTemple, mineForwardSeconds, NULL_ADDR, toAtto } from "../helpers";
import { Signer } from "ethers";
import {
    JoiningFee,
    JoiningFee__factory,
  OGTemple,
  OGTemple__factory,
  VaultProxy,
  VaultProxy__factory,
  TempleERC20Token,
  TempleERC20Token__factory,
  TempleStaking,
  TempleStaking__factory,
  Vault, 
  Vault__factory,
  InstantExitQueue__factory,
  Exposure__factory,
  VaultedTemple__factory,
} from "../../typechain";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { _TypedDataEncoder } from "ethers/lib/utils";

describe.only("Vault Proxy", async () => {
  let TEMPLE: TempleERC20Token;
  let STAKING: TempleStaking;
  let VAULT_PROXY: VaultProxy;
  let OGTEMPLE: OGTemple;
  let vault: Vault;
  let joiningFee: JoiningFee;

  let owner: Signer;
  let alan: SignerWithAddress;
  let ben: Signer;

  beforeEach(async () => {
      [owner, alan, ben] = await ethers.getSigners();

      TEMPLE = await deployAndAirdropTemple(
        owner,
        [owner, alan, ben],
        toAtto(1000)
      );

      STAKING = await new TempleStaking__factory(owner).deploy(
        TEMPLE.address,
        NULL_ADDR,
        20, /* epoch size, in seconds */
        (await blockTimestamp()) - 1,
      );

      const INSTANT_EXIT_QUEUE = await new InstantExitQueue__factory(owner).deploy(
        STAKING.address,
        TEMPLE.address
      );

      await STAKING.setExitQueue(INSTANT_EXIT_QUEUE.address);
       
      await STAKING.setEpy(10,100);
      OGTEMPLE = new OGTemple__factory(owner).attach(await STAKING.OG_TEMPLE());

      VAULT_PROXY = await new VaultProxy__factory(owner).deploy(
        OGTEMPLE.address,
        TEMPLE.address,
        STAKING.address
      );

      await TEMPLE.mint(STAKING.address, toAtto(100000));

      joiningFee = await new JoiningFee__factory(owner).deploy(
          toAtto(0.0001),
      );

      const templeExposure = await new Exposure__factory(owner).deploy(
        "temple exposure",
        "TPL-VAULT-EXPOSURE",
        TEMPLE.address,
      )

      const vaultedTemple = await new VaultedTemple__factory(owner).deploy(
        TEMPLE.address,
        templeExposure.address
      );

      await templeExposure.setLiqidator(vaultedTemple.address);

      vault = await new Vault__factory(owner).deploy(
          "Temple 1m Vault",
          "TV_1M",
          TEMPLE.address,
          templeExposure.address,
          vaultedTemple.address,
          60 * 10,
          60,
          { p: 1, q: 1},
          joiningFee.address,
          await blockTimestamp()
      )

      await templeExposure.setMinterState(vault.address, true);

      await TEMPLE.mint(VAULT_PROXY.address, toAtto(1000000));
  });

  it("Only owner can withdraw from contract", async () => {
    const beforeBal = await TEMPLE.balanceOf(await owner.getAddress());
    const expectedBal = beforeBal.add(toAtto(100));

    await VAULT_PROXY.withdraw(TEMPLE.address, await owner.getAddress(), toAtto(100))

    expect(await TEMPLE.balanceOf(await owner.getAddress())).equals(expectedBal);

    expect(VAULT_PROXY.connect(alan).withdraw(TEMPLE.address, await alan.getAddress(), toAtto(100)))
                .to.be.revertedWith("Ownable: caller is not the owner");
  })

  it("Can unstake and deposit into vault", async () => {
    let alanStake = new TempleStaking__factory(alan).attach(STAKING.address);
    let alanTemple = new TempleERC20Token__factory(alan).attach(TEMPLE.address);
    let alanOgTemple = new OGTemple__factory(alan).attach(OGTEMPLE.address);
    let alanOGTSwap = new VaultProxy__factory(alan).attach(VAULT_PROXY.address);

    await alanTemple.increaseAllowance(STAKING.address, toAtto(100000));
    await alanStake.stake(toAtto(200));
    mineForwardSeconds(40); // 2 epochs
    await alanOgTemple.increaseAllowance(VAULT_PROXY.address, toAtto(10000))
    
    const ogtBal = await OGTEMPLE.balanceOf(await alan.getAddress())
    const amount = await STAKING.balance(ogtBal);

    await alanOGTSwap.unstakeAndDepositIntoVault(ogtBal, vault.address);

    expect(await vault.balanceOf(await alan.getAddress())).equals(amount);
    expect(await TEMPLE.balanceOf(await alan.getAddress())).equals(toAtto(800));
  });

  it("Can proxy deposit for any Vault", async() => {
    await TEMPLE.connect(alan).increaseAllowance(VAULT_PROXY.address, toAtto(1000));
    await VAULT_PROXY.connect(alan).depositTempleFor(toAtto(100), vault.address);

    expect(await vault.balanceOf(await alan.getAddress())).equals(toAtto(100));
  })

});