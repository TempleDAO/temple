import { config } from 'dotenv';
import { ethers, waffle, network } from 'hardhat';
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
import { mineForwardSeconds } from '../helpers';
import { impersonateAccount } from '../utils/account';
import { takeSnapshot, revertToSnapshot } from '../utils/snapshot';
import constants from '../constants';

config();

describe('Ascend Zaps', async () => {
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

  let snapshotId: string;

  before(async function () {
    this.timeout(0);
    await network.provider.request({
      method: 'hardhat_reset',
      params: [
        {
          forking: {
            jsonRpcUrl: process.env.MAINNET_RPC_URL || '',
            blockNumber: 15674900,
          },
        },
      ],
    });

    [owner, alan, ben] = await ethers.getSigners();

    TEMPLE = await TempleERC20Token__factory.connect(
      constants.tokens.TEMPLE,
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

    await expect(
      new AscendZaps__factory(owner).deploy(
        ethers.constants.AddressZero,
        TEMPLE.address
      )
    ).to.be.revertedWith('InvalidAddress');
    await expect(
      new AscendZaps__factory(owner).deploy(
        vaultedTemple.address,
        ethers.constants.AddressZero
      )
    ).to.be.revertedWith('InvalidAddress');

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
        poolId: constants.contracts.BALANCER_POOL_ID,
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

      await mineForwardSeconds(periodDuration);
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
      await mineForwardSeconds(periodDuration);
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

    it('balancer swap fail', async () => {
      singleSwap.assetOut = constants.tokens.USDC;
      await vault.connect(alan).approve(ascendZaps.address, swapAmount);
      await mineForwardSeconds(periodDuration);

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
      ).to.be.revertedWith('BalancerVaultSwapError');

      singleSwap.assetOut = constants.tokens.DAI;

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

    it('invalid fund recipient', async () => {
      fundMng.recipient = await ben.getAddress();
      await vault.connect(alan).approve(ascendZaps.address, swapAmount);
      await mineForwardSeconds(periodDuration);

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

      fundMng.recipient = alan.address;

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

    it('insufficient temple balance', async () => {
      const amount = toAtto(1000000).add(1);
      await TEMPLE.mint(alan.address, amount);

      await TEMPLE.connect(alan).approve(vault.address, amount);
      await vault.connect(alan).deposit(amount);

      swapAmount = amount;
      singleSwap.amount = amount;

      await vault.connect(alan).approve(ascendZaps.address, swapAmount);
      await mineForwardSeconds(periodDuration);

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
      ).to.be.revertedWith('InsufficientTempleBalance');
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

      await mineForwardSeconds(periodDuration);
      const res = await vault.inEnterExitWindow();
      const cycleNum = res.cycleNumber;
      expect(cycleNum).to.be.eq(1);

      const beforeBalance = await TEMPLE.balanceOf(
        constants.contracts.BALANCER_VAULT
      );
      const beforeDAIBalance = await DAI.balanceOf(alan.address);

      const amountCalculated = await ascendZaps
        .connect(alan)
        .callStatic.exitVaultEarly(
          swapAmount,
          vault.address,
          singleSwap,
          fundMng,
          0,
          deadline
        );

      const tx = await ascendZaps
        .connect(alan)
        .exitVaultEarly(
          swapAmount,
          vault.address,
          singleSwap,
          fundMng,
          0,
          deadline
        );
      await expect(tx)
        .to.emit(ascendZaps, 'EarlyWithdraw')
        .withArgs(
          await alan.getAddress(),
          swapAmount,
          vault.address,
          singleSwap.assetOut,
          amountCalculated
        );

      expect(
        await TEMPLE.balanceOf(constants.contracts.BALANCER_VAULT)
      ).to.be.eq(beforeBalance.add(singleSwap.amount));
      expect(await DAI.balanceOf(alan.address)).to.be.gt(beforeDAIBalance);
    });
  });

  describe('Redeem vault token to temple & Check interest accrued', async () => {
    let balance: BigNumber;
    let swapAmount: BigNumber;
    let singleSwap: IBalancerVault.SingleSwapStruct;
    let fundMng: IBalancerVault.FundManagementStruct;
    let deadline: number;

    beforeEach(async () => {
      balance = await vault.balanceOf(alan.address);
      swapAmount = balance.div(2);
      singleSwap = {
        poolId: constants.contracts.BALANCER_POOL_ID,
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

    it('only redeem when vault can exit', async () => {
      const canExit = await vault.canExit();
      expect(canExit).to.be.eq(false);

      await expect(
        ascendZaps.redeemVaultTokenToTemple(vault.address)
      ).to.be.revertedWith('CanNotExitVault');

      await mineForwardSeconds(periodDuration);

      await ascendZaps.redeemVaultTokenToTemple(vault.address);
    });

    it('only owner can redeem', async () => {
      await mineForwardSeconds(periodDuration);

      await expect(
        ascendZaps.connect(alan).redeemVaultTokenToTemple(vault.address)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Redeem vault token to temple & Check interest accrued', async () => {
      await mineForwardSeconds(periodDuration);
      const res = await vault.inEnterExitWindow();
      const cycleNum = res.cycleNumber;
      expect(cycleNum).to.be.eq(1);

      let interestAccrued = await ascendZaps.checkInterestAccrued(
        vault.address
      );
      expect(interestAccrued).to.be.eq(0);

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

      const tx = await ascendZaps.redeemVaultTokenToTemple(vault.address);
      interestAccrued = await ascendZaps.checkInterestAccrued(vault.address);
      expect(interestAccrued).to.be.eq(0);

      await expect(tx)
        .to.emit(ascendZaps, 'VaultRedeemed')
        .withArgs(vault.address, 0);

      const vaultedTempleBalance = await TEMPLE.balanceOf(
        vaultedTemple.address
      );
      expect(vaultedTempleBalance).to.be.eq(balance.sub(swapAmount));
    });
  });

  describe('Withdraw', async () => {
    describe('Temple token', async () => {
      it('user can not withdraw', async () => {
        expect(
          ascendZaps
            .connect(alan)
            .withdraw(TEMPLE.address, await alan.getAddress(), toAtto(100))
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('withdraw zero amount', async () => {
        expect(
          ascendZaps
            .connect(owner)
            .withdraw(TEMPLE.address, await alan.getAddress(), toAtto(0))
        ).to.be.revertedWith('WithdrawZeroAmount');
      });

      it('withdraw no more than balance', async () => {
        const balance = await TEMPLE.balanceOf(ascendZaps.address);
        await expect(
          ascendZaps
            .connect(owner)
            .withdraw(TEMPLE.address, await alan.getAddress(), balance.add(1))
        ).to.be.revertedWith('ERC20: transfer amount exceeds balance');
      });

      it('withdraw up to balance', async () => {
        const balance = await TEMPLE.balanceOf(ascendZaps.address);
        const beforeBalance = await TEMPLE.balanceOf(alan.address);
        await ascendZaps
          .connect(owner)
          .withdraw(TEMPLE.address, await alan.getAddress(), balance);

        const afterBalance = await TEMPLE.balanceOf(alan.address);
        expect(await TEMPLE.balanceOf(ascendZaps.address)).to.be.eq(0);
        expect(afterBalance).to.be.eq(beforeBalance.add(balance));
      });
    });

    describe('ETH', async () => {
      const amount = toAtto(10);

      beforeEach(async () => {
        await network.provider.send('hardhat_setBalance', [
          ascendZaps.address,
          amount.toHexString(),
        ]);
      });

      it('user can not withdraw', async () => {
        expect(
          ascendZaps
            .connect(alan)
            .withdraw(
              ethers.constants.AddressZero,
              await alan.getAddress(),
              amount
            )
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });

      it('withdraw zero amount', async () => {
        expect(
          ascendZaps
            .connect(owner)
            .withdraw(
              ethers.constants.AddressZero,
              await alan.getAddress(),
              toAtto(0)
            )
        ).to.be.revertedWith('WithdrawZeroAmount');
      });

      it('withdraw no more than balance', async () => {
        await expect(
          ascendZaps
            .connect(owner)
            .withdraw(
              ethers.constants.AddressZero,
              await alan.getAddress(),
              amount.add(1)
            )
        ).to.be.revertedWith('WithdrawSendFailed');
      });

      it('withdraw up to balance', async () => {
        const beforeBalance = await waffle.provider.getBalance(alan.address);
        await ascendZaps
          .connect(owner)
          .withdraw(ethers.constants.AddressZero, alan.address, amount);

        const afterBalance = await waffle.provider.getBalance(alan.address);
        expect(await waffle.provider.getBalance(ascendZaps.address)).to.be.eq(
          0
        );
        expect(afterBalance).to.be.eq(beforeBalance.add(amount));
      });
    });
  });
});
