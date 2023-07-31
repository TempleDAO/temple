pragma solidity 0.8.18;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { CompoundedInterest } from "contracts/v2/interestRate/CompoundedInterest.sol";
import { TempleDebtTokenTestBase } from "./TempleDebtToken.Base.t.sol";

/* solhint-disable func-name-mixedcase, contract-name-camelcase, not-rely-on-time */
contract TempleDebtTokenTestBaseAndDebtorInterest is TempleDebtTokenTestBase {
    uint256 public aliceInterestRate = 0.02e18;
    uint256 public bobInterestRate = 0.05e18;

    function setUp() public {
        _setUp();

        vm.startPrank(executor);
        dUSD.setRiskPremiumInterestRate(alice, aliceInterestRate);
        dUSD.setRiskPremiumInterestRate(bob, bobInterestRate);
        vm.stopPrank();
    }

    function test_mint_alice() public {
        vm.prank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);

        // Just the principal at the same block
        checkBaseInterest(DEFAULT_BASE_INTEREST, amount, amount, block.timestamp, amount, amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, block.timestamp, amount);

        vm.warp(block.timestamp + 365 days);
        dUSD.checkpointBaseInterest();
        dUSD.checkpointDebtorInterest(alice);

        uint256 expectedBaseDebt = ONE_PCT_365DAY;
        uint256 expectedDebtorTotal = TWO_PCT_365DAY;
        uint256 expectedDebtorInterestOnly = expectedDebtorTotal - amount;
        checkBaseInterest(DEFAULT_BASE_INTEREST, amount, expectedBaseDebt, block.timestamp, expectedBaseDebt, amount, expectedDebtorInterestOnly);
        checkDebtor(alice, aliceInterestRate, amount, amount, expectedDebtorInterestOnly, block.timestamp, expectedDebtorTotal+expectedBaseDebt-amount);
    }

    function test_mint_aliceAndBob_inSameBlock() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);
        dUSD.mint(bob, amount);

        // Alice and bob each get equal shares as they were allocated in the same block
        checkBaseInterest(DEFAULT_BASE_INTEREST, 2*amount, 2*amount, block.timestamp, 2*amount, 2*amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, block.timestamp, amount);
        checkDebtor(bob, bobInterestRate, amount, amount, 0, block.timestamp, amount);

        vm.warp(block.timestamp + 365 days);
        dUSD.checkpointBaseInterest();
        dUSD.checkpointDebtorInterest(alice);
        dUSD.checkpointDebtorInterest(bob);

        uint256 aliceExpectedBaseTotal = ONE_PCT_365DAY;
        uint256 aliceExpectedDebtorInterestOnly = TWO_PCT_365DAY - amount;
        uint256 aliceExpectedBalanceOf = aliceExpectedBaseTotal + aliceExpectedDebtorInterestOnly;

        uint256 bobExpectedBaseTotal = ONE_PCT_365DAY;
        uint256 bobExpectedDebtorInterestOnly = FIVE_PCT_365DAY - amount;
        uint256 bobExpectedBalanceOf = bobExpectedBaseTotal + bobExpectedDebtorInterestOnly;

        checkBaseInterest(
            DEFAULT_BASE_INTEREST, 2*amount, 
            aliceExpectedBaseTotal+bobExpectedBaseTotal, 
            block.timestamp, 
            aliceExpectedBaseTotal+bobExpectedBaseTotal, 
            2*amount, aliceExpectedDebtorInterestOnly+bobExpectedDebtorInterestOnly
        );
        checkDebtor(alice, aliceInterestRate, amount, amount, aliceExpectedDebtorInterestOnly, block.timestamp, aliceExpectedBalanceOf);
        checkDebtor(bob, bobInterestRate, amount, amount, bobExpectedDebtorInterestOnly, block.timestamp, bobExpectedBalanceOf);
    }

    function test_mint_aliceAndBob_inDifferentBlock() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);

        // Bob borrows 1 day later
        uint256 blockTs = block.timestamp;
        vm.warp(blockTs + 1 days);
        dUSD.mint(bob, amount);

        uint256 aliceExpectedBaseTotal = ONE_PCT_1DAY;
        uint256 aliceExpectedDebtorInterestOnly = TWO_PCT_1DAY - amount;
        uint256 aliceExpectedBalanceOf = aliceExpectedBaseTotal + aliceExpectedDebtorInterestOnly;

        // Bob gets slightly less shares since Alice has accrued a bit extra from the 1 day of solo borrowing
        uint256 bobExpectedShares = SECOND_DAY_SHARES;

        checkBaseInterest(DEFAULT_BASE_INTEREST, amount+bobExpectedShares, amount+aliceExpectedBaseTotal, block.timestamp, amount+aliceExpectedBaseTotal, 2*amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, blockTs, aliceExpectedBalanceOf);
        checkDebtor(bob, bobInterestRate, amount, bobExpectedShares, 0, block.timestamp, amount-1); // balanceOf rounded down.

        vm.warp(block.timestamp + 364 days);
        dUSD.checkpointBaseInterest();
        dUSD.checkpointDebtorInterest(alice);
        dUSD.checkpointDebtorInterest(bob);

        aliceExpectedBaseTotal = ONE_PCT_365DAY_ROUNDING;
        aliceExpectedDebtorInterestOnly = TWO_PCT_365DAY - amount;
        aliceExpectedBalanceOf = aliceExpectedBaseTotal + aliceExpectedDebtorInterestOnly;

        uint256 bobExpectedBaseTotal = ONE_PCT_364DAY;
        uint256 bobExpectedDebtorInterestOnly = FIVE_PCT_364DAY - amount;
        uint256 bobExpectedBalanceOf = bobExpectedBaseTotal + bobExpectedDebtorInterestOnly;

        checkBaseInterest(
            DEFAULT_BASE_INTEREST, amount+bobExpectedShares, 
            aliceExpectedBaseTotal+bobExpectedBaseTotal, 
            block.timestamp, 
            aliceExpectedBaseTotal+bobExpectedBaseTotal, 
            2*amount, aliceExpectedDebtorInterestOnly+bobExpectedDebtorInterestOnly
        );
        checkDebtor(alice, aliceInterestRate, amount, amount, aliceExpectedDebtorInterestOnly, block.timestamp, aliceExpectedBalanceOf);
        checkDebtor(bob, bobInterestRate, amount, bobExpectedShares, bobExpectedDebtorInterestOnly, block.timestamp, bobExpectedBalanceOf-1);
    }

    function test_burn_alice_inSameBlock() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);
        dUSD.burn(alice, amount);

        checkBaseInterest(DEFAULT_BASE_INTEREST, 0, 0, block.timestamp, 0, 0, 0);
        checkDebtor(alice, aliceInterestRate, 0, 0, 0, block.timestamp, 0);
    }

    function test_burn_alice_aDayLater() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);
        uint256 blockTs = block.timestamp;
        vm.warp(block.timestamp + 1 days);

        uint256 aliceExpectedBaseTotal = ONE_PCT_1DAY;
        uint256 aliceExpectedDebtorInterestOnly = TWO_PCT_1DAY - amount;
        uint256 aliceExpectedBalanceOf = aliceExpectedBaseTotal + aliceExpectedDebtorInterestOnly;

        checkBaseInterest(DEFAULT_BASE_INTEREST, amount, amount, blockTs, aliceExpectedBaseTotal, amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, blockTs, aliceExpectedBalanceOf);

        dUSD.burn(alice, aliceExpectedBalanceOf);

        checkBaseInterest(DEFAULT_BASE_INTEREST, 0, 0, block.timestamp, 0, 0, 0);
        checkDebtor(alice, aliceInterestRate, 0, 0, 0, block.timestamp, 0);
    }

    function test_burn_aliceAndBob_inSameBlock() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);
        dUSD.mint(bob, amount);
        dUSD.burn(alice, amount);
        dUSD.burn(bob, amount);

        checkBaseInterest(DEFAULT_BASE_INTEREST, 0, 0, block.timestamp, 0, 0, 0);
        checkDebtor(alice, aliceInterestRate, 0, 0, 0, block.timestamp, 0);
        checkDebtor(bob, bobInterestRate, 0, 0, 0, block.timestamp, 0);
    }

    function test_burn_aliceAndBob_aDayLater() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);
        dUSD.mint(bob, amount);
        uint256 blockTs = block.timestamp;
        vm.warp(block.timestamp + 1 days);

        uint256 aliceExpectedBaseTotal = ONE_PCT_1DAY;
        uint256 aliceExpectedDebtorInterestOnly = TWO_PCT_1DAY - amount;
        uint256 aliceExpectedBalanceOf = aliceExpectedBaseTotal + aliceExpectedDebtorInterestOnly;

        uint256 bobExpectedBaseTotal = ONE_PCT_1DAY;
        uint256 bobExpectedDebtorInterestOnly = FIVE_PCT_1DAY - amount;
        uint256 bobExpectedBalanceOf = bobExpectedBaseTotal + bobExpectedDebtorInterestOnly;

        checkBaseInterest(DEFAULT_BASE_INTEREST, 2*amount, 2*amount, blockTs, aliceExpectedBaseTotal+bobExpectedBaseTotal, 2*amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, blockTs, aliceExpectedBalanceOf);
        checkDebtor(bob, bobInterestRate, amount, amount, 0, blockTs, bobExpectedBalanceOf);

        dUSD.burn(alice, aliceExpectedBalanceOf);
        dUSD.burn(bob, bobExpectedBalanceOf);

        checkBaseInterest(DEFAULT_BASE_INTEREST, 0, 0, block.timestamp, 0, 0, 0);
        checkDebtor(alice, aliceInterestRate, 0, 0, 0, block.timestamp, 0);
        checkDebtor(bob, bobInterestRate, 0, 0, 0, block.timestamp, 0);
    }

    function test_burn_aliceAndBob_inDifferentBlocks() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);
        uint256 blockTs1 = block.timestamp;
        vm.warp(block.timestamp + 1 days);
        uint256 blockTs2 = block.timestamp;
        dUSD.mint(bob, amount);

        vm.warp(block.timestamp + 1 days);

        uint256 aliceExpectedBaseTotal = ONE_PCT_2DAY;
        uint256 aliceExpectedDebtorInterestOnly = TWO_PCT_2DAY - amount;
        uint256 aliceExpectedBalanceOf = aliceExpectedBaseTotal + aliceExpectedDebtorInterestOnly;

        uint256 bobExpectedBaseTotal = ONE_PCT_1DAY;
        uint256 bobExpectedDebtorInterestOnly = FIVE_PCT_1DAY - amount;
        uint256 bobExpectedBalanceOf = bobExpectedBaseTotal + bobExpectedDebtorInterestOnly;

        // Bob gets slightly less shares since Alice has accrued a bit extra from the 1 day of solo borrowing
        uint256 bobExpectedShares = SECOND_DAY_SHARES;

        checkBaseInterest(DEFAULT_BASE_INTEREST, amount+bobExpectedShares, amount+bobExpectedBaseTotal, blockTs2, aliceExpectedBaseTotal+bobExpectedBaseTotal, 2*amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, blockTs1, aliceExpectedBalanceOf);
        checkDebtor(bob, bobInterestRate, amount, bobExpectedShares, 0, blockTs2, bobExpectedBalanceOf-1);

        // Alice pays it off fully
        dUSD.burn(alice, aliceExpectedBalanceOf);

        checkBaseInterest(DEFAULT_BASE_INTEREST, bobExpectedShares, bobExpectedBaseTotal, block.timestamp, bobExpectedBaseTotal, amount, 0);
        checkDebtor(alice, aliceInterestRate, 0, 0, 0, block.timestamp, 0);
        checkDebtor(bob, bobInterestRate, amount, bobExpectedShares, 0, blockTs2, bobExpectedBalanceOf);

        // Bob pays it off fully
        dUSD.burn(bob, bobExpectedBalanceOf);

        checkBaseInterest(DEFAULT_BASE_INTEREST, 0, 0, block.timestamp, 0, 0, 0);
        checkDebtor(alice, aliceInterestRate, 0, 0, 0, block.timestamp, 0);
        checkDebtor(bob, bobInterestRate, 0, 0, 0, block.timestamp, 0);
    }

    function test_burn_alice_interestRepayOnly() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);
        uint256 blockTs = block.timestamp;
        vm.warp(block.timestamp + 365 days);

        uint256 aliceExpectedBaseTotal = ONE_PCT_365DAY;
        uint256 aliceExpectedDebtorInterestOnly = TWO_PCT_365DAY - amount;
        uint256 aliceExpectedBalanceOf = aliceExpectedBaseTotal + aliceExpectedDebtorInterestOnly;

        checkBaseInterest(DEFAULT_BASE_INTEREST, amount, amount, blockTs, aliceExpectedBaseTotal, amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, blockTs, aliceExpectedBalanceOf);

        uint256 repayAmount = 1e18;
        dUSD.burn(alice, repayAmount);

        // Expected remaining debtor interest = prior balance minus the repayment amount
        aliceExpectedBalanceOf = aliceExpectedBalanceOf - repayAmount;

        // Expected remaining base interest remains the same - nothing was taken off this because the repayment was small
        checkBaseInterest(DEFAULT_BASE_INTEREST, amount, aliceExpectedBaseTotal, block.timestamp, aliceExpectedBaseTotal, amount, aliceExpectedDebtorInterestOnly-repayAmount);
        checkDebtor(alice, aliceInterestRate, amount, amount, aliceExpectedDebtorInterestOnly-repayAmount, block.timestamp, aliceExpectedBalanceOf);
    }

    function test_burn_alice_flippedRates() public {
        // Flip so the base rate is higher than Alice's rate
        // so we can check the order of what gets paid off first.
        vm.startPrank(executor);
        dUSD.setBaseInterestRate(aliceInterestRate);
        dUSD.setRiskPremiumInterestRate(alice, DEFAULT_BASE_INTEREST);
        vm.stopPrank();

        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);
        uint256 blockTs = block.timestamp;
        vm.warp(block.timestamp + 365 days);

        uint256 aliceExpectedBaseTotal = TWO_PCT_365DAY;
        uint256 aliceExpectedDebtorInterestOnly = ONE_PCT_365DAY - amount;
        uint256 aliceExpectedBalanceOf = aliceExpectedBaseTotal + aliceExpectedDebtorInterestOnly;

        checkBaseInterest(aliceInterestRate, amount, amount, blockTs, aliceExpectedBaseTotal, amount, 0);
        checkDebtor(alice, DEFAULT_BASE_INTEREST, amount, amount, 0, blockTs, aliceExpectedBalanceOf);

        uint256 repayAmount = 0.5e18;
        uint256 repayShares = dUSD.baseDebtToShares(repayAmount) + 1;  // Gets rounded up within repay.
        dUSD.burn(alice, repayAmount);

        // Expected remaining debtor interest = prior balance minus the repayment amount
        aliceExpectedBalanceOf = aliceExpectedBalanceOf - repayAmount;

        // The base interest and shares goes down by the repay amount, Alice's specific debt is unchanged.
        checkBaseInterest(aliceInterestRate, amount-repayShares, aliceExpectedBaseTotal-repayAmount, block.timestamp, aliceExpectedBaseTotal-repayAmount, amount, aliceExpectedDebtorInterestOnly);
        checkDebtor(alice, DEFAULT_BASE_INTEREST, amount, amount-repayShares, aliceExpectedDebtorInterestOnly, block.timestamp, aliceExpectedBalanceOf);
    }

    function test_burn_aliceAndBob_partial() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);
        vm.warp(block.timestamp + 1 days);
        dUSD.mint(bob, amount);

        vm.warp(block.timestamp + 1 days);

        Expected memory aliceExpected = makeExpected(
            /*shares*/          amount,
            /*base total*/      ONE_PCT_2DAY,
            /*debtor int only*/ TWO_PCT_2DAY - amount
        );
        Expected memory bobExpected = makeExpected(
            /*shares*/          SECOND_DAY_SHARES,
            /*base total*/      ONE_PCT_1DAY,
            /*debtor int only*/ FIVE_PCT_1DAY - amount
        );

        checkBaseInterest(DEFAULT_BASE_INTEREST, amount+bobExpected.baseShares, amount+bobExpected.baseTotal, block.timestamp-1 days, aliceExpected.baseTotal+bobExpected.baseTotal, 2*amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, block.timestamp-2 days, aliceExpected.balanceOf);
        checkDebtor(bob, bobInterestRate, amount, bobExpected.baseShares, 0, block.timestamp-1 days, bobExpected.balanceOf-1);
        
        // Alice pays 10e18 off
        uint256 repayAmount = 10e18;
        dUSD.burn(alice, repayAmount);

        // The repaid amount from the base is the actual repaid amount minus what we paid off from Alice's risk premium interest
        uint256 baseRepayAmount = repayAmount - aliceExpected.debtorInterestOnly;

        checkBaseInterest(
            DEFAULT_BASE_INTEREST,
            amount+bobExpected.baseShares - (dUSD.baseDebtToShares(baseRepayAmount)+1), // round up when repaid
            aliceExpected.baseTotal + bobExpected.baseTotal - baseRepayAmount,
            block.timestamp, 
            aliceExpected.baseTotal + bobExpected.baseTotal - baseRepayAmount,
            amount + aliceExpected.baseTotal - baseRepayAmount, 0 // bob hasn't had a checkpoint so the estimate debtor interest is zero
        );

        checkDebtor(
            alice, 
            aliceInterestRate, 
            aliceExpected.balanceOf-repayAmount, 
            amount-(dUSD.baseDebtToShares(baseRepayAmount)+1),  // round up when repaid
            0, 
            block.timestamp, 
            aliceExpected.balanceOf-repayAmount
        );
        checkDebtor(bob, bobInterestRate, amount, bobExpected.baseShares, 0, block.timestamp-1 days, bobExpected.balanceOf-1);

        // Alice pays the remainder off
        dUSD.burn(alice, aliceExpected.balanceOf-repayAmount);

        checkBaseInterest(DEFAULT_BASE_INTEREST, bobExpected.baseShares, bobExpected.baseTotal, block.timestamp, bobExpected.baseTotal, amount, 0);
        checkDebtor(alice, aliceInterestRate, 0, 0, 0, block.timestamp, 0);
        checkDebtor(bob, bobInterestRate, amount, bobExpected.baseShares, 0, block.timestamp-1 days, bobExpected.balanceOf);
    }

    function test_setRiskPremiumInterestRate() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        uint256 startBlockTs = block.timestamp;
        dUSD.mint(alice, amount);
        vm.warp(block.timestamp + 1 days);
        dUSD.mint(bob, amount);

        vm.warp(block.timestamp + 364 days);

        Expected memory aliceExpected = makeExpected(
            /*shares*/          amount,
            /*base total*/      ONE_PCT_365DAY_ROUNDING,
            /*debtor int only*/ TWO_PCT_365DAY - amount
        );
        Expected memory bobExpected = makeExpected(
            /*shares*/          SECOND_DAY_SHARES,
            /*base total*/      ONE_PCT_364DAY,
            /*debtor int only*/ FIVE_PCT_364DAY - amount
        );
        
        checkBaseInterest(DEFAULT_BASE_INTEREST, aliceExpected.baseShares+bobExpected.baseShares, ONE_PCT_1DAY + amount, startBlockTs + 1 days, aliceExpected.baseTotal+bobExpected.baseTotal, 2*amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, aliceExpected.baseShares, 0, startBlockTs, aliceExpected.balanceOf);
        checkDebtor(bob, bobInterestRate, amount, bobExpected.baseShares, 0, startBlockTs + 1 days, bobExpected.balanceOf-1); // balanceOf rounded down

        changePrank(executor);
        uint256 updatedRate = 0.1e18;
        dUSD.setRiskPremiumInterestRate(alice, updatedRate);

        // The rate was updated and a checkpoint was made.
        // bob's extra interest isn't added to the estimatedDebtorInterest because he didn't checkpoint
        checkBaseInterest(DEFAULT_BASE_INTEREST, amount+bobExpected.baseShares, ONE_PCT_1DAY + amount, startBlockTs + 1 days, aliceExpected.baseTotal+bobExpected.baseTotal, 2*amount, aliceExpected.debtorInterestOnly);
        checkDebtor(alice, updatedRate, amount, amount, aliceExpected.debtorInterestOnly, block.timestamp, aliceExpected.balanceOf);
        checkDebtor(bob, bobInterestRate, amount, bobExpected.baseShares, 0, startBlockTs + 1 days, bobExpected.balanceOf-1);

        uint256 ts = block.timestamp;
        vm.warp(block.timestamp + 365 days);

        // The net amount of base interest for Alice is the first day's interest, compounded for another 729 days
        // There are very insignificant rounding diffs if we were to compound in steps
        //  - eg: 1 day => 364 days => 365 days (net 730 days)
        uint256 compoundedAliceBase = CompoundedInterest.continuouslyCompounded(ONE_PCT_1DAY, 729 days, uint96(DEFAULT_BASE_INTEREST));
        // Since alice was checkpoint setRiskPremiumInterestRate, we need to then compound at the new rate for another yr.
        uint256 compoundedAliceDebtorInterest = (
            CompoundedInterest.continuouslyCompounded(aliceExpected.debtorInterestOnly + amount, 365 days, uint96(updatedRate)) -
            amount
        );

        // Similarly for precision, we need to compound Bob in one hit.
        uint256 compoundedBobBase = CompoundedInterest.continuouslyCompounded(amount, 729 days, uint96(DEFAULT_BASE_INTEREST));
        uint256 compoundedBobDebtorInterest = (
            CompoundedInterest.continuouslyCompounded(amount, 729 days, uint96(bobInterestRate)) -
            amount
        );

        checkBaseInterest(
            DEFAULT_BASE_INTEREST, 
            aliceExpected.baseShares + bobExpected.baseShares, 
            ONE_PCT_1DAY + amount, 
            startBlockTs + 1 days, 
            compoundedAliceBase + compoundedBobBase, 
            2*amount, aliceExpected.debtorInterestOnly
        );
        checkDebtor(
            alice, updatedRate, amount, aliceExpected.baseShares, 
            aliceExpected.debtorInterestOnly, ts, 
            compoundedAliceBase + compoundedAliceDebtorInterest
        );
        checkDebtor(
            bob, bobInterestRate, amount, 
            bobExpected.baseShares, 0, startBlockTs + 1 days,
            compoundedBobBase - 1 + compoundedBobDebtorInterest
        );
    }
    
    function test_setRiskPremiumInterestRateToZero() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        uint256 startBlockTs = block.timestamp;
        dUSD.mint(alice, amount);
        vm.warp(block.timestamp + 1 days);
        dUSD.mint(bob, amount);

        vm.warp(block.timestamp + 364 days);

        Expected memory aliceExpected = makeExpected(
            /*shares*/          amount,
            /*base total*/      ONE_PCT_365DAY_ROUNDING,
            /*debtor int only*/ TWO_PCT_365DAY - amount
        );
        Expected memory bobExpected = makeExpected(
            /*shares*/          SECOND_DAY_SHARES,
            /*base total*/      ONE_PCT_364DAY,
            /*debtor int only*/ FIVE_PCT_364DAY - amount
        );
        
        checkBaseInterest(DEFAULT_BASE_INTEREST, aliceExpected.baseShares+bobExpected.baseShares, ONE_PCT_1DAY + amount, startBlockTs + 1 days, aliceExpected.baseTotal+bobExpected.baseTotal, 2*amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, aliceExpected.baseShares, 0, startBlockTs, aliceExpected.balanceOf);
        checkDebtor(bob, bobInterestRate, amount, bobExpected.baseShares, 0, startBlockTs + 1 days, bobExpected.balanceOf-1); // balanceOf rounded down

        changePrank(executor);
        uint256 updatedRate = 0;
        dUSD.setRiskPremiumInterestRate(alice, updatedRate);

        // The rate was updated and a checkpoint was made.
        // bob's extra interest isn't added to the estimatedDebtorInterest because he didn't checkpoint
        checkBaseInterest(DEFAULT_BASE_INTEREST, amount+bobExpected.baseShares, ONE_PCT_1DAY + amount, startBlockTs + 1 days, aliceExpected.baseTotal+bobExpected.baseTotal, 2*amount, aliceExpected.debtorInterestOnly);
        checkDebtor(alice, updatedRate, amount, amount, aliceExpected.debtorInterestOnly, block.timestamp, aliceExpected.balanceOf);
        checkDebtor(bob, bobInterestRate, amount, bobExpected.baseShares, 0, startBlockTs + 1 days, bobExpected.balanceOf-1);

        uint256 ts = block.timestamp;
        vm.warp(block.timestamp + 365 days);

        // The net amount of base interest for Alice is the first day's interest, compounded for another 729 days
        // There are very insignificant rounding diffs if we were to compound in steps
        //  - eg: 1 day => 364 days => 365 days (net 730 days)
        uint256 compoundedAliceBase = CompoundedInterest.continuouslyCompounded(ONE_PCT_1DAY, 729 days, uint96(DEFAULT_BASE_INTEREST));
        // Since alice was checkpoint setRiskPremiumInterestRate, we need to then compound at the new rate for another yr.
        uint256 compoundedAliceDebtorInterest = (
            CompoundedInterest.continuouslyCompounded(aliceExpected.debtorInterestOnly + amount, 365 days, uint96(updatedRate)) -
            amount
        );

        // Similarly for precision, we need to compound Bob in one hit.
        uint256 compoundedBobBase = CompoundedInterest.continuouslyCompounded(amount, 729 days, uint96(DEFAULT_BASE_INTEREST));
        uint256 compoundedBobDebtorInterest = (
            CompoundedInterest.continuouslyCompounded(amount, 729 days, uint96(bobInterestRate)) -
            amount
        );

        checkBaseInterest(
            DEFAULT_BASE_INTEREST, 
            aliceExpected.baseShares + bobExpected.baseShares, 
            ONE_PCT_1DAY + amount, 
            startBlockTs + 1 days, 
            compoundedAliceBase + compoundedBobBase, 
            2*amount, aliceExpected.debtorInterestOnly
        );
        checkDebtor(
            alice, updatedRate, amount, aliceExpected.baseShares, 
            aliceExpected.debtorInterestOnly, ts, 
            compoundedAliceBase + compoundedAliceDebtorInterest
        );
        checkDebtor(
            bob, bobInterestRate, amount, 
            bobExpected.baseShares, 0, startBlockTs + 1 days,
            compoundedBobBase - 1 + compoundedBobDebtorInterest
        );
    }
    
    function test_burnAll() public {
        vm.startPrank(executor);

        uint256 amount = 100e18;
        uint256 startBlockTs = block.timestamp;
        dUSD.mint(alice, amount);
        vm.warp(block.timestamp + 1 days);
        dUSD.mint(bob, amount);

        vm.warp(block.timestamp + 364 days);
        changePrank(executor);
        dUSD.setRiskPremiumInterestRate(alice, 0.1e18);
        vm.warp(block.timestamp + 365 days);

        uint256 bobExpectedShares = SECOND_DAY_SHARES;

        // Bob's interest compounds in one hit as there was no checkpoint.
        uint256 compoundedBobBase = CompoundedInterest.continuouslyCompounded(amount, 729 days, uint96(DEFAULT_BASE_INTEREST));
        uint256 compoundedBobDebtorInterest = (
            CompoundedInterest.continuouslyCompounded(amount, 729 days, uint96(bobInterestRate)) -
            amount
        );

        changePrank(executor);
        dUSD.burnAll(alice);
        checkBaseInterest(DEFAULT_BASE_INTEREST, bobExpectedShares, compoundedBobBase, block.timestamp, compoundedBobBase, amount, 0);
        checkDebtor(alice, 0.1e18, 0, 0, 0, block.timestamp, 0);
        checkDebtor(bob, bobInterestRate, amount, bobExpectedShares, 0, startBlockTs + 1 days, compoundedBobBase + compoundedBobDebtorInterest);

        dUSD.burnAll(bob);
        checkBaseInterest(DEFAULT_BASE_INTEREST, 0, 0, block.timestamp, 0, 0, 0);
        checkDebtor(alice, 0.1e18, 0, 0, 0, block.timestamp, 0);
        checkDebtor(bob, bobInterestRate, 0, 0, 0, block.timestamp, 0);
    }

    function test_checkpointDebtorsInterest() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        uint256 startBlockTs = block.timestamp;
        dUSD.mint(alice, amount);
        vm.warp(block.timestamp + 1 days);
        dUSD.mint(bob, amount);
        vm.warp(block.timestamp + 364 days);

        Expected memory aliceExpected = makeExpected(
            /*shares*/          amount,
            /*base total*/      ONE_PCT_365DAY_ROUNDING,
            /*debtor int only*/ TWO_PCT_365DAY - amount
        );
        Expected memory bobExpected = makeExpected(
            /*shares*/          SECOND_DAY_SHARES,
            /*base total*/      ONE_PCT_364DAY,
            /*debtor int only*/ FIVE_PCT_364DAY - amount
        );

        checkBaseInterest(DEFAULT_BASE_INTEREST, aliceExpected.baseShares+bobExpected.baseShares, ONE_PCT_1DAY + amount, startBlockTs + 1 days, aliceExpected.baseTotal+bobExpected.baseTotal, 2*amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, aliceExpected.baseShares, 0, startBlockTs, aliceExpected.balanceOf);
        checkDebtor(bob, bobInterestRate, amount, bobExpected.baseShares, 0, startBlockTs + 1 days, bobExpected.balanceOf-1); // balanceOf rounded down

        address[] memory ds = new address[](2);
        ds[0] = alice;
        ds[1] = bob;
        dUSD.checkpointDebtorsInterest(ds);

        checkBaseInterest(
            DEFAULT_BASE_INTEREST, aliceExpected.baseShares + bobExpected.baseShares, 
            ONE_PCT_1DAY + amount, startBlockTs + 1 days, 
            aliceExpected.baseTotal + bobExpected.baseTotal, 
            2*amount, aliceExpected.debtorInterestOnly + bobExpected.debtorInterestOnly
        );
        checkDebtor(alice, aliceInterestRate, amount, aliceExpected.baseShares, aliceExpected.debtorInterestOnly, block.timestamp, aliceExpected.balanceOf);
        checkDebtor(bob, bobInterestRate, amount, bobExpected.baseShares, bobExpected.debtorInterestOnly, block.timestamp, bobExpected.balanceOf-1);
    }

    function test_currentDebtOf() public {
        vm.startPrank(executor);

        uint256 amount = 100e18;
        dUSD.mint(alice, amount);
        vm.warp(block.timestamp + 1 days);
        dUSD.mint(bob, amount);

        vm.warp(block.timestamp + 364 days);
        changePrank(executor);
        dUSD.setRiskPremiumInterestRate(alice, 0.1e18);
        vm.warp(block.timestamp + 365 days);

        uint256 compoundedAliceBase = CompoundedInterest.continuouslyCompounded(ONE_PCT_1DAY, 729 days, uint96(DEFAULT_BASE_INTEREST));

        (uint256 principal, uint256 baseInterest, uint256 riskPremiumInterest) = dUSD.currentDebtOf(alice);
        assertEq(principal, amount);
        assertEq(baseInterest, compoundedAliceBase-amount);
        assertEq(riskPremiumInterest, TEN_PCT_365DAY_1-amount);
        assertEq(dUSD.balanceOf(alice), principal+baseInterest+riskPremiumInterest);

        uint256 compoundedBobBase = CompoundedInterest.continuouslyCompounded(amount, 729 days, uint96(DEFAULT_BASE_INTEREST));
        uint256 compoundedBobDebtorInterest = (
            CompoundedInterest.continuouslyCompounded(amount, 729 days, uint96(bobInterestRate)) -
            amount
        );
        (principal, baseInterest, riskPremiumInterest) = dUSD.currentDebtOf(bob);
        assertEq(principal, amount);
        assertEq(baseInterest, compoundedBobBase-amount-1);
        assertEq(riskPremiumInterest, compoundedBobDebtorInterest);
        assertEq(dUSD.balanceOf(bob), principal+baseInterest+riskPremiumInterest);
    }

    function test_mint_and_burn_fuzz(address account, uint256 amount, uint256 timeGap) public {
        vm.assume(account != address(0));
        vm.assume(amount != 0);
        vm.assume(amount < 100_000_000e18);
        vm.assume(timeGap < 5 * 365 days);

        vm.startPrank(executor);
        dUSD.setRiskPremiumInterestRate(account, aliceInterestRate);
        changePrank(executor);

        dUSD.mint(account, amount);

        checkBaseInterest(DEFAULT_BASE_INTEREST, amount, amount, block.timestamp, amount, amount, 0);
        checkDebtor(account, aliceInterestRate, amount, amount, 0, block.timestamp, amount);
        assertEq(dUSD.totalSupply(), amount);

        vm.warp(block.timestamp + timeGap);

        uint256 expectedTotalBalance = (
            CompoundedInterest.continuouslyCompounded(amount, timeGap, uint96(DEFAULT_BASE_INTEREST)) +
            CompoundedInterest.continuouslyCompounded(amount, timeGap, uint96(aliceInterestRate)) - amount
        );

        uint256 balance = dUSD.balanceOf(account);
        assertEq(balance, expectedTotalBalance);

        dUSD.burn(account, balance);

        checkBaseInterest(DEFAULT_BASE_INTEREST, 0, 0, block.timestamp, 0, 0, 0);
        checkDebtor(account, aliceInterestRate, 0, 0, 0, block.timestamp, 0);
        assertEq(dUSD.totalSupply(), 0);
    }
}