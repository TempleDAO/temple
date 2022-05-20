import { ethers } from "hardhat";
import { blockTimestamp, deployAndAirdropTemple, toAtto } from "../helpers";
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
  VaultActions,
  VaultActions__factory,
  TempleERC20Token,
  TempleERC20Token__factory,
  TempleStaking,
  TempleStaking__factory,
  Vault, 
  Vault__factory,
  Faith__factory,
  Faith
} from "../../typechain";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { _TypedDataEncoder } from "ethers/lib/utils";

describe("Vault Actions", async () => {
  let TEMPLE: TempleERC20Token;
  let EXIT_QUEUE: ExitQueue;
  let STAKING: TempleStaking;
  let ACCEL_EXIT_QUEUE: AcceleratedExitQueue;
  let VAULT_ACTIONS: VaultActions;
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

       ACCEL_EXIT_QUEUE = await new AcceleratedExitQueue__factory(owner).deploy(
        TEMPLE.address,
        EXIT_QUEUE.address,
        STAKING.address
      );

      await EXIT_QUEUE.transferOwnership(ACCEL_EXIT_QUEUE.address);

      FAITH = await new Faith__factory(owner).deploy();

      VAULT_ACTIONS = await new VaultActions__factory(owner).deploy(
        OGTEMPLE.address,
        TEMPLE.address,
        STAKING.address,
        FAITH.address
      );

      await TEMPLE.mint(STAKING.address, toAtto(100000));
      await STAKING.setExitQueue(VAULT_ACTIONS.address);

      await FAITH.addManager(await owner.getAddress());
      await FAITH.addManager(VAULT_ACTIONS.address);

      joiningFee = await new JoiningFee__factory(owner).deploy(
          toAtto(0.0001),
      );

      vault = await new Vault__factory(owner).deploy(
          "Temple 1m Vault",
          "TV_1M",
          TEMPLE.address,
          60 * 10,
          60,
          { p: 1, q: 1},
          joiningFee.address,
          await blockTimestamp()
      )

      await TEMPLE.mint(VAULT_ACTIONS.address, toAtto(1000000));
      //await VAULT_ACTIONS.allowSpendingForVault(vault.address);
  });

  it("Can deposit using Temple + Faith", async () => {
    const alanAddr = await alan.getAddress();
    await FAITH.gain(alanAddr, toAtto(200));

    const nonce = await vault.nonces(alanAddr);
    const deadline = await blockTimestamp() + (60*20);
    
    const faith = await FAITH.balances(alanAddr);
    const alanTempleDeposit = toAtto(565);
    
    const expectedAmount = await VAULT_ACTIONS.getFaithMultiplier(faith.usableFaith, alanTempleDeposit);

    const domain = {
      name: await vault.name(),
      version: '1',
      chainId: await alan.getChainId(),
      verifyingContract: vault.address
    };

    const types = {
        depositFor : [
            { name: "owner", type: "address"},
            { name: "maxAmount", type: "uint256"},
            { name: "deadline", type: "uint256"},
            { name: "nonce", type: "uint256"}
        ]
    };

    const msg = {
        owner: await alan.getAddress(),
        maxAmount: expectedAmount,
        deadline: deadline,
        nonce: nonce
    }

    let signature = await alan._signTypedData(domain, types, msg);
    const split = ethers.utils.splitSignature(signature);

    await TEMPLE.connect(alan).increaseAllowance(VAULT_ACTIONS.address, toAtto(10000))
    await VAULT_ACTIONS.connect(alan).depositTempleWithFaith(alanTempleDeposit, faith.usableFaith,vault.address,deadline, split.v,split.r,split.s)
    expect(await vault.balanceOf(alanAddr)).equals(expectedAmount);
  })

  it("Can unstake and deposit into vault", async () => {
    let alanStake = await new TempleStaking__factory(alan).attach(STAKING.address);
    let alanTemple = await new TempleERC20Token__factory(alan).attach(TEMPLE.address);
    let alanOgTemple = await new OGTemple__factory(alan).attach(OGTEMPLE.address);
    let alanOGTSwap = await new VaultActions__factory(alan).attach(VAULT_ACTIONS.address);

    await alanTemple.increaseAllowance(STAKING.address, toAtto(1000000))
    await alanTemple.increaseAllowance(vault.address, toAtto(100000));
    await alanTemple.increaseAllowance(VAULT_ACTIONS.address, toAtto(100000));
    await alanStake.stake(toAtto(1000));
    await alanOgTemple.increaseAllowance(VAULT_ACTIONS.address, toAtto(10000000000))
    await alanOgTemple.increaseAllowance(STAKING.address, toAtto(10000000000))
    
    const ogtBal = await OGTEMPLE.balanceOf(await alan.getAddress())
    const amount = await STAKING.balance(ogtBal);
    const nonce = await vault.nonces(await alan.getAddress());
    const deadline = await blockTimestamp() + (60*20);

    const domain = {
        name: await vault.name(),
        version: '1',
        chainId: await alan.getChainId(),
        verifyingContract: vault.address
    };

    const types = {
        depositFor : [
            { name: "owner", type: "address"},
            { name: "maxAmount", type: "uint256"},
            { name: "deadline", type: "uint256"},
            { name: "nonce", type: "uint256"}
        ]
    };

    const msg = {
        owner: await alan.getAddress(),
        maxAmount: amount,
        deadline: deadline,
        nonce: nonce
    }
    
    let signature = await alan._signTypedData(domain, types, msg);
    const split = ethers.utils.splitSignature(signature);
    
    await alanOGTSwap.unstakeAndDepositIntoVault(ogtBal, vault.address,deadline, split.v,split.r,split.s);
    
    expect(await vault.balanceOf(await alan.getAddress())).equals(amount);
    expect(await TEMPLE.balanceOf(await alan.getAddress())).equals(toAtto(0));
  });
});