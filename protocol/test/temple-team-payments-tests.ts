import { Signer } from 'ethers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

import {
  TempleERC20Token,
  TempleTeamPayments,
  TempleERC20Token__factory,
  TempleTeamPayments__factory,
} from '../typechain';
import { blockTimestamp } from './helpers';
import { PANIC_CODES } from "@nomicfoundation/hardhat-chai-matchers/panic";

const SECONDS_IN_1_MONTH = 2630000;
const ONLY_OWNER_ERROR = "OwnableUnauthorizedAccount";

describe('TempleTeamPayments', function () {
  const SECONDS_IN_10_MONTHS = 26300000;

  let PAYMENTS: TempleTeamPayments;
  let owner: Signer;
  let member0: Signer;
  let member1: Signer;
  let nonMember: Signer;
  let ownerAddress: string;
  let member0Address: string;
  let member1Address: string;
  let nonMemberAddress: string;
  let TEMPLE: TempleERC20Token;
  const allocation100K = 100000;

  beforeEach(async function () {
    [owner, member0, member1, nonMember] = await ethers.getSigners();
    ownerAddress = await owner.getAddress();
    member0Address = await member0.getAddress();
    member1Address = await member1.getAddress();
    nonMemberAddress = await nonMember.getAddress();

    TEMPLE = await new TempleERC20Token__factory(owner).deploy();
    await TEMPLE.addMinter(await owner.getAddress());

    PAYMENTS = await new TempleTeamPayments__factory(owner).deploy(
      TEMPLE.address,
      SECONDS_IN_10_MONTHS,
      await blockTimestamp(),
    );
    await PAYMENTS.setAllocations([member0Address, member1Address], [allocation100K, allocation100K]);

    await TEMPLE.mint(PAYMENTS.address, 1000000);
  });

  describe('Deployment', function () {
    it('should set the right owner', async function () {
      expect(await PAYMENTS.owner()).to.equal(ownerAddress);
    });

    it('should allow owner to renounce', async function () {
      await PAYMENTS.renounceOwnership();
      expect(await PAYMENTS.owner()).to.equal(ethers.constants.AddressZero);
    });

    it('should allow owner to transfer ownership', async function () {
      await PAYMENTS.transferOwnership(member1Address);
      expect(await PAYMENTS.owner()).to.equal(member1Address);
    });

    it('should set the right TEMPLE token', async function () {
      expect(await PAYMENTS.TEMPLE()).to.equal(TEMPLE.address);
    });
  });

  describe('Management', function () {
    it('only owner can call onlyOwner functions', async () => {
      const member0Connect = PAYMENTS.connect(member0);
      const ownerConnect = PAYMENTS.connect(owner);

      await expect(member0Connect.setAllocations([member1Address], [1000]))
        .to.be.revertedWithCustomError(PAYMENTS, ONLY_OWNER_ERROR).withArgs(await member0.getAddress());
      await expect(member0Connect.pauseMember(member1Address))
        .to.be.revertedWithCustomError(PAYMENTS, ONLY_OWNER_ERROR).withArgs(await member0.getAddress());
      await expect(member0Connect.adhocPayment(member1Address, 100))
        .to.be.revertedWithCustomError(PAYMENTS, ONLY_OWNER_ERROR).withArgs(await member0.getAddress());
      await expect(member0Connect.withdrawTempleBalance(member1Address, 100))
        .to.be.revertedWithCustomError(PAYMENTS, ONLY_OWNER_ERROR).withArgs(await member0.getAddress());

      await ownerConnect.setAllocations([member1Address], [1000]);
      await ownerConnect.pauseMember(member1Address);
      await ownerConnect.adhocPayment(member1Address, 100);
      await ownerConnect.withdrawTempleBalance(member1Address, 100);
    });

    it('should allow owner to withdraw TEMPLE', async function () {
      const ownerConnect = PAYMENTS.connect(owner);
      const amount = 1000000;
      const withdrawal = ownerConnect.withdrawTempleBalance(ownerAddress, amount);
      await expect(() => withdrawal).to.changeTokenBalance(TEMPLE, owner, amount);
    });

    it('should not allow owner to withdraw to AddressZero', async function () {
      const ownerConnect = PAYMENTS.connect(owner);
      const amount = 1000000;
      await expect(ownerConnect.withdrawTempleBalance(ethers.constants.AddressZero, amount))
        .to.be.revertedWithCustomError(TEMPLE, "ERC20InvalidReceiver");
    });

    it('should allow owner to make ad hoc payments', async function () {
      const amount = 100000;
      const startingClaimed = await PAYMENTS.claimed(member0Address);
      const ownerConnect = PAYMENTS.connect(owner);

      await expect(() => ownerConnect.adhocPayment(member0Address, amount)).to.changeTokenBalance(
        TEMPLE,
        member0,
        amount
      );
      const endingClaimed = await PAYMENTS.claimed(member0Address);
      expect(endingClaimed.sub(startingClaimed)).to.equal(amount);
    });

    // should not allow setAllocations to be called on AddressZero
    it('should not allow owner to set allocations on AddressZero', async function () {
      const ownerConnect = PAYMENTS.connect(owner);
      await expect(ownerConnect.setAllocations([member0Address, ethers.constants.AddressZero], [allocation100K, allocation100K]))
        .to.be.revertedWith("TempleTeamPayments: Address cannot be 0x0");
    });

    it('should set allocation to total claimed when a member is paused (no previous claims)', async function () {
      const ownerConnect = PAYMENTS.connect(owner);

      await advanceMonths(1);
      await ownerConnect.pauseMember(member0Address);

      expect(await PAYMENTS.claimed(member0Address)).to.equal(0);
      expect(await PAYMENTS.allocation(member0Address)).to.equal(0);
      await expect(PAYMENTS.calculateClaimable(member0Address))
        .to.be.revertedWith("TempleTeamPayments: Member not found");
    });

    it('should set allocation to total claimed when a member is paused (previous claims)', async function () {
      const ownerConnect = PAYMENTS.connect(owner);
      const member0Connect = PAYMENTS.connect(member0);

      await advanceMonths(1);

      await member0Connect.claim();
      await ownerConnect.pauseMember(member0Address);

      const member0Claimed = await PAYMENTS.claimed(member0Address);
      expect(member0Claimed).to.equal(allocation100K * (1 / 10));

      expect(await PAYMENTS.allocation(member0Address)).to.equal(member0Claimed);
      await expect(PAYMENTS.calculateClaimable(member0Address))
        .to.be.revertedWithPanic(PANIC_CODES.ARITHMETIC_UNDER_OR_OVERFLOW);
    });
  });

  describe('Transactions', function () {
    it('should send member the correct amount of TEMPLE after claim', async function () {
      const member0Connect = PAYMENTS.connect(member0);
      await advanceMonths(1);
      await expect(() => member0Connect.claim()).to.changeTokenBalance(TEMPLE, member0, allocation100K / 10);
    });

    it('should have claimable equal to 1/10 of allocation after one month', async function () {
      await advanceMonths(1);
      expectClaimableEqualTo(PAYMENTS, member0, allocation100K * (1 / 10));
    });

    it('should calculate correct claimable and update total claimed after a claim is made', async function () {
      await advanceMonths(1);

      const member0Connect = await PAYMENTS.connect(member0);
      await member0Connect.claim();
      await expectClaimableEqualTo(PAYMENTS, member0, 0);
      expect(await PAYMENTS.claimed(member0Address)).to.equal(allocation100K * (1 / 10));

      await advanceMonths(5);

      await expectClaimableEqualTo(PAYMENTS, member0, allocation100K * (5 / 10));

      await member0Connect.claim();
      expect(await PAYMENTS.claimed(member0Address)).to.equal(allocation100K * (6 / 10));
      await expectClaimableEqualTo(PAYMENTS, member0, 0);
    });

    it('should allow entire allocation to be claimed after round end date', async function () {
      const member0Connect = await PAYMENTS.connect(member0);

      await advanceMonths(15);
      await expectClaimableEqualTo(PAYMENTS, member0, allocation100K);

      await member0Connect.claim();
      await expectClaimableEqualTo(PAYMENTS, member0, 0);
      const member0Claimed = await PAYMENTS.claimed(member0Address);
      expect(member0Claimed).to.equal(allocation100K);
    });

    it('should set allocation to total claimed when a member is paused (no previous claims)', async function () {
      await advanceMonths(1);

      const ownerConnect = await PAYMENTS.connect(owner);
      const member0Address = await member0.getAddress();

      await ownerConnect.pauseMember(member0Address);
      const member0Claimed = await PAYMENTS.claimed(member0Address);
      expect(member0Claimed).to.equal(0);
      expect(await PAYMENTS.allocation(member0Address)).to.equal(member0Claimed);
    });

    it('should handle late joining members', async function () {
      await advanceMonths(5);

      const lateMember = nonMember;
      const lateMemberAddress = nonMemberAddress;

      await PAYMENTS.connect(owner).setAllocations([lateMemberAddress], [allocation100K]);
      await expectClaimableEqualTo(PAYMENTS, lateMember, allocation100K * (5 / 10));

      await advanceMonths(5);
      await expectClaimableEqualTo(PAYMENTS, lateMember, allocation100K);
    });
  });

  describe('Edge cases', function () {
    beforeEach(async function () {
      await advanceMonths(1);
      await PAYMENTS.connect(member1).claim();
    });

    describe('decreased after initial claim', async function () {
      it('should calculate correct claimable amount', async function () {
        // User claimed ~10,000 month 1.
        // Decreasing their allocation to 50,000 means their monthly claimable would've been ~5,000 from the start
        // User should not be able to claim until after month 2 because they've already claimed 2 months of pay.
        await PAYMENTS.connect(owner).setAllocations([member1Address], [50000]);

        await expect(PAYMENTS.calculateClaimable(member1Address))
          .to.be.revertedWithPanic(PANIC_CODES.ARITHMETIC_UNDER_OR_OVERFLOW);

        await advanceMonths(1);
        await expectClaimableEqualTo(PAYMENTS, member1, 0);

        await advanceMonths(1);
        await expectClaimableEqualTo(PAYMENTS, member1, 5000);
      });
    });

    describe('decreased to an amount below initial claim', async function () {
      it('should calculate correct claimable amount', async function () {
        // User claimed ~10,000 month 1.
        // Decreasing their allocation to 9,900 should prevent them from making further claims
        await PAYMENTS.connect(owner).setAllocations([member1Address], [9900]);

        await expect(PAYMENTS.calculateClaimable(member1Address))
          .to.be.revertedWithPanic(PANIC_CODES.ARITHMETIC_UNDER_OR_OVERFLOW);
        await advanceMonths(12);
        await expect(PAYMENTS.calculateClaimable(member1Address))
          .to.be.revertedWithPanic(PANIC_CODES.ARITHMETIC_UNDER_OR_OVERFLOW);
      });
    });

    describe('increased after initial claim', async function () {
      it('should calculate correct claimable amount', async function () {
        // User claimed ~10,000 month 1.
        // Increasing their allocation to 200,000 means their monthly claimable would've been ~20,000 from the start
        // User should be able to claim 30,000 next month. The month after that, they should be able to claim 20,000.
        await PAYMENTS.connect(owner).setAllocations([member1Address], [200000]);

        await advanceMonths(1);
        await expectClaimableEqualTo(PAYMENTS, member1, 30000);
        await advanceMonths(1);
        await expectClaimableEqualTo(PAYMENTS, member1, 50000);
      });
    });
  });
});

async function expectClaimableEqualTo(paymentsContract: TempleTeamPayments, member: Signer, amount: number) {
  const address = await member.getAddress();
  const addrClaimable = await paymentsContract.calculateClaimable(address);
  expect(addrClaimable.toNumber()).to.equal(amount);
}

async function fastForward(seconds: number) {
  await ethers.provider.send('evm_increaseTime', [seconds]);
  await ethers.provider.send('evm_mine', []);
}

async function advanceMonths(months: number) {
  await fastForward(SECONDS_IN_1_MONTH * months);
}
