import { ethers } from "hardhat";
import { blockTimestamp, deployAndAirdropTemple, fromAtto, mineForwardSeconds, toAtto } from "../helpers";
import { Signer } from "ethers";
import {
    AcceleratedExitQueue,
    AcceleratedExitQueue__factory,
    ExitQueue,
    ExitQueue__factory,
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
  Faith__factory,
  Faith,
  InstantExitQueue__factory,
  Exposure__factory,
  VaultedTemple__factory
} from "../../typechain";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { _TypedDataEncoder } from "ethers/lib/utils";

describe.only("Vault Proxy", async () => {
  let TEMPLE: TempleERC20Token;
  let EXIT_QUEUE: ExitQueue;
  let STAKING: TempleStaking;
  let ACCEL_EXIT_QUEUE: AcceleratedExitQueue;
  let VAULT_PROXY: VaultProxy;
  let OGTEMPLE: OGTemple;
  let FAITH: Faith;
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

      EXIT_QUEUE = await new ExitQueue__factory(owner).deploy(
        TEMPLE.address,
        toAtto(1000), /* max per epoch */
        toAtto(1000), /* max per address per epoch */
        5, /* epoch size, in blocks */
      )
       
      STAKING = await new TempleStaking__factory(owner).deploy(
        TEMPLE.address,
        EXIT_QUEUE.address,
        20, /* epoch size, in seconds */
        (await blockTimestamp()) - 1,
      );
       
      await STAKING.setEpy(10,100);
      OGTEMPLE = new OGTemple__factory(owner).attach(await STAKING.OG_TEMPLE());

      FAITH = await new Faith__factory(owner).deploy();

      VAULT_PROXY = await new VaultProxy__factory(owner).deploy(
        OGTEMPLE.address,
        TEMPLE.address,
        STAKING.address,
        FAITH.address
      );

      await TEMPLE.mint(STAKING.address, toAtto(100000));

      const INSTANT_EXIT_QUEUE = await new InstantExitQueue__factory(owner).deploy(
        STAKING.address,
        TEMPLE.address
      );

      await STAKING.setExitQueue(INSTANT_EXIT_QUEUE.address);

      await FAITH.addManager(await owner.getAddress());
      await FAITH.addManager(VAULT_PROXY.address);

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

  it("Can deposit using Temple + Faith", async () => {
    const alanAddr = await alan.getAddress();
    await FAITH.gain(alanAddr, toAtto(200));

    const faith = await FAITH.balances(alanAddr);
    const alanTempleDeposit = toAtto(565);
    
    const expectedAmount = await VAULT_PROXY.getFaithMultiplier(faith.usableFaith, alanTempleDeposit);

    await TEMPLE.connect(alan).increaseAllowance(VAULT_PROXY.address, toAtto(10000))
    await VAULT_PROXY.connect(alan).depositTempleWithFaith(alanTempleDeposit, faith.usableFaith,vault.address);
    expect(await vault.balanceOf(alanAddr)).equals(expectedAmount);
    // ensure we've burnt it all
    expect(await (await FAITH.balances(alanAddr)).usableFaith).equals(0);
  })

  const faithData = [
    {temple: 7000, faith: 5000, expected: 9000},
    {temple: 2345, faith: 10000, expected: 3048.5},
    {temple: 2345, faith: 100, expected: 2385},
    {temple: 100, faith: 2345, expected: 130}
  ];

  faithData.forEach(data => {
    it(`Deposits ${data.temple} Temple with ${data.faith} faith correctly`, async () => {
      await TEMPLE.mint(await alan.getAddress(), toAtto(data.temple));
      await FAITH.gain(await alan.getAddress(), toAtto(data.faith));

      await TEMPLE.connect(alan).increaseAllowance(VAULT_PROXY.address, toAtto(10000))
      await VAULT_PROXY.connect(alan).depositTempleWithFaith(toAtto(data.temple), toAtto(data.faith), vault.address);

      expect(fromAtto(await vault.balanceOf(await alan.getAddress()))).approximately(data.expected, 1e-6);
    })
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
});