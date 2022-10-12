import { config } from 'dotenv';
import { ethers, network } from 'hardhat';
import { blockTimestamp, toAtto } from '../helpers';
import { Signer, BigNumber } from 'ethers';
import {
  TempleERC20Token,
  TempleERC20Token__factory,
  ERC20,
  ERC20__factory,
  Vault,
  Vault__factory,
  Exposure__factory,
  JoiningFee,
  JoiningFee__factory,
  VaultedTemple,
  VaultedTemple__factory,
  AscendZaps,
  AscendZaps__factory,
  IBalancerVault,
  Exposure,
} from '../../typechain';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { advanceTimeAndBlock } from '../utils/time';
import { impersonateAccount } from '../utils/account';
import { takeSnapshot, revertToSnapshot } from '../utils/snapshot';
import constants from '../constants';

config();

describe.only('Ascend Zaps', async () => {
  let TEMPLE: TempleERC20Token;
  let DAI: ERC20;
  let vault: Vault;
  let joiningFee: JoiningFee;
  let vaultedTemple: VaultedTemple;
  let ascendZaps: AscendZaps;
  let templeExposure: Exposure;

  let owner: Signer;
  let alan: SignerWithAddress;
  let ben: Signer;
  const periodDuration = 60 * 10;
  const balanceVaultAddress = '0xBA12222222228d8Ba445958a75a0704d566BF2C8';

  let snapshotId: string;

  before(async function () {
    this.timeout(0);
    await network.provider.request({
      method: 'hardhat_reset',
      params: [
        {
          forking: {
            jsonRpcUrl: process.env.MAINNET_RPC_URL || '',
            blockNumber: 15721699,
          },
        },
      ],
    });

    [owner, alan, ben] = await ethers.getSigners();

    TEMPLE = await TempleERC20Token__factory.connect(
      '0x470EBf5f030Ed85Fc1ed4C2d36B9DD02e77CF1b7',
      owner
    );
    await impersonateAccount(constants.accounts.MULTISIG);
    const multisig = await ethers.getSigner(constants.accounts.MULTISIG);
    await TEMPLE.connect(multisig).addMinter(await owner.getAddress());

    DAI = await ERC20__factory.connect(constants.tokens.DAI, owner);

    joiningFee = await new JoiningFee__factory(owner).deploy(toAtto(0.0001));

    templeExposure = await new Exposure__factory(owner).deploy(
      'temple exposure',
      'TPL-VAULT-EXPOSURE',
      TEMPLE.address
    );

    vaultedTemple = await new VaultedTemple__factory(owner).deploy(
      TEMPLE.address,
      templeExposure.address
    );

    await templeExposure.setLiqidator(vaultedTemple.address);

    vault = await new Vault__factory(owner).deploy(
      'Temple 1m Vault',
      'TV_1M',
      TEMPLE.address,
      templeExposure.address,
      vaultedTemple.address,
      periodDuration,
      60,
      { p: 1, q: 1 },
      joiningFee.address,
      await blockTimestamp()
    );

    await templeExposure.setMinterState(vault.address, true);

    ascendZaps = await new AscendZaps__factory(owner).deploy(
      vaultedTemple.address,
      TEMPLE.address
    );

    await TEMPLE.mint(alan.address, toAtto(1000));
    await TEMPLE.mint(await ben.getAddress(), toAtto(1000));
    await TEMPLE.mint(ascendZaps.address, toAtto(1000000));

    await TEMPLE.connect(alan).approve(vault.address, toAtto(1000));
    await vault.connect(alan).deposit(toAtto(1000));
  });

  beforeEach(async () => {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  it('Constructor', async () => {
    expect(await ascendZaps.vaultedTemple()).to.be.eq(vaultedTemple.address);
    expect(await ascendZaps.temple()).to.be.eq(TEMPLE.address);
  });

  describe('Exit vault early', async () => {
    let balance: BigNumber;
    let swapAmount: BigNumber;
    let singleSwap: IBalancerVault.SingleSwapStruct;
    let fundMng: IBalancerVault.FundManagementStruct;
    let deadline: number;

    beforeEach(async () => {
      balance = await vault.balanceOf(alan.address);
      swapAmount = balance.div(2);
      singleSwap = {
        poolId:
          '0x1b65fe4881800b91d4277ba738b567cbb200a60d0002000000000000000002cc',
        kind: 0,
        assetIn: TEMPLE.address,
        assetOut: constants.tokens.DAI,
        amount: swapAmount,
        userData: '0x',
      };
      fundMng = {
        sender: ascendZaps.address,
        fromInternalBalance: false,
        recipient: alan.address,
        toInternalBalance: false,
      };
      deadline = Math.floor(new Date().getTime() / 1000) + 10 * 60;
    });

    it('first vault cycle error', async () => {
      await vault.connect(alan).approve(ascendZaps.address, swapAmount);
      await expect(
        ascendZaps
          .connect(alan)
          .exitVaultEarly(
            swapAmount,
            vault.address,
            singleSwap,
            fundMng,
            0,
            deadline
          )
      ).to.be.revertedWith('FirstVaultCycle');

      await advanceTimeAndBlock(periodDuration);
      const res = await vault.inEnterExitWindow();
      const cycleNum = res.cycleNumber;
      expect(cycleNum).to.be.eq(1);

      await ascendZaps
        .connect(alan)
        .exitVaultEarly(
          swapAmount,
          vault.address,
          singleSwap,
          fundMng,
          0,
          deadline
        );
    });

    it('invalid swap data', async () => {
      singleSwap.assetIn = constants.tokens.USDC;
      singleSwap.amount = swapAmount.sub(1);

      await vault.connect(alan).approve(ascendZaps.address, swapAmount);
      await advanceTimeAndBlock(periodDuration);
      await expect(
        ascendZaps
          .connect(alan)
          .exitVaultEarly(
            swapAmount,
            vault.address,
            singleSwap,
            fundMng,
            0,
            deadline
          )
      ).to.be.revertedWith('SwapDataDoesNotMatch');

      singleSwap.amount = swapAmount;

      await expect(
        ascendZaps
          .connect(alan)
          .exitVaultEarly(
            swapAmount,
            vault.address,
            singleSwap,
            fundMng,
            0,
            deadline
          )
      ).to.be.revertedWith('SwapDataDoesNotMatch');

      singleSwap.assetIn = TEMPLE.address;

      await ascendZaps
        .connect(alan)
        .exitVaultEarly(
          swapAmount,
          vault.address,
          singleSwap,
          fundMng,
          0,
          deadline
        );
    });

    it('exit vault early swaps TEMPLE to DAI on balancer vault', async () => {
      await vault.connect(alan).approve(ascendZaps.address, swapAmount);
      await expect(
        ascendZaps
          .connect(alan)
          .exitVaultEarly(
            swapAmount,
            vault.address,
            singleSwap,
            fundMng,
            0,
            deadline
          )
      ).to.be.revertedWith('FirstVaultCycle');

      await advanceTimeAndBlock(periodDuration);
      const res = await vault.inEnterExitWindow();
      const cycleNum = res.cycleNumber;
      expect(cycleNum).to.be.eq(1);

      const beforeBalance = await TEMPLE.balanceOf(balanceVaultAddress);
      const beforeDAIBalance = await DAI.balanceOf(alan.address);

      await ascendZaps
        .connect(alan)
        .exitVaultEarly(
          swapAmount,
          vault.address,
          singleSwap,
          fundMng,
          0,
          deadline
        );

      expect(await TEMPLE.balanceOf(balanceVaultAddress)).to.be.eq(
        beforeBalance.add(singleSwap.amount)
      );
      expect(await DAI.balanceOf(alan.address)).to.be.gt(beforeDAIBalance);
    });
  });

  it('Redeem vault token to temple & Check interest accrued', async () => {
    await advanceTimeAndBlock(periodDuration);
    const res = await vault.inEnterExitWindow();
    const cycleNum = res.cycleNumber;
    expect(cycleNum).to.be.eq(1);

    let interestAccrued = await ascendZaps.checkInterestAccrued(vault.address);
    expect(interestAccrued).to.be.eq(0);

    const balance = await vault.balanceOf(alan.address);
    const swapAmount = balance.div(2);
    const singleSwap: IBalancerVault.SingleSwapStruct = {
      poolId:
        '0x1b65fe4881800b91d4277ba738b567cbb200a60d0002000000000000000002cc',
      kind: 0,
      assetIn: TEMPLE.address,
      assetOut: constants.tokens.DAI,
      amount: swapAmount,
      userData: '0x',
    };
    const fundMng: IBalancerVault.FundManagementStruct = {
      sender: ascendZaps.address,
      fromInternalBalance: false,
      recipient: alan.address,
      toInternalBalance: false,
    };
    const deadline = Math.floor(new Date().getTime() / 1000) + 10 * 60;

    await vault.connect(alan).approve(ascendZaps.address, swapAmount);
    await ascendZaps
      .connect(alan)
      .exitVaultEarly(
        swapAmount,
        vault.address,
        singleSwap,
        fundMng,
        0,
        deadline
      );

    interestAccrued = await ascendZaps.checkInterestAccrued(vault.address);
    expect(interestAccrued).to.be.eq(0);

    await ascendZaps.redeemVaultTokenToTemple(vault.address);
    interestAccrued = await ascendZaps.checkInterestAccrued(vault.address);
    expect(interestAccrued).to.be.eq(0);

    const vaultedTempleBalance = await TEMPLE.balanceOf(vaultedTemple.address);
    expect(vaultedTempleBalance).to.be.eq(balance.sub(swapAmount));
  });

  it('Only owner can withdraw from contract', async () => {
    const beforeBal = await TEMPLE.balanceOf(await owner.getAddress());
    const expectedBal = beforeBal.add(toAtto(100));

    await ascendZaps.withdraw(
      TEMPLE.address,
      await owner.getAddress(),
      toAtto(100)
    );

    expect(await TEMPLE.balanceOf(await owner.getAddress())).equals(
      expectedBal
    );

    expect(
      ascendZaps
        .connect(alan)
        .withdraw(TEMPLE.address, await alan.getAddress(), toAtto(100))
    ).to.be.revertedWith('Ownable: caller is not the owner');
  });
});
