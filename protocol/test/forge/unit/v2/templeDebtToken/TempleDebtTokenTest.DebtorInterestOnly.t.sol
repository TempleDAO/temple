pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TempleDebtTokenTestBase } from "./TempleDebtToken.Base.t.sol";
import { ITempleDebtToken } from "contracts/interfaces/v2/ITempleDebtToken.sol";

/* solhint-disable func-name-mixedcase, contract-name-camelcase, not-rely-on-time */
contract TempleDebtTokenTestDebtorInterestOnly is TempleDebtTokenTestBase {
    uint96 public aliceInterestRate = 0.02e18;
    uint96 public bobInterestRate = 0.05e18;

    function setUp() public {
        _setUp();

        vm.startPrank(executor);
        dUSD.setBaseInterestRate(0);
        dUSD.setRiskPremiumInterestRate(alice, aliceInterestRate);
        dUSD.setRiskPremiumInterestRate(bob, bobInterestRate);
        vm.stopPrank();
    }

    function test_mint_alice() public {
        vm.prank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);

        // Just the principal at the same block
        checkBaseInterest(0, amount, amount, block.timestamp, amount, amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, block.timestamp, amount);

        vm.warp(block.timestamp + 365 days);
        dUSD.checkpointBaseInterest();
        dUSD.checkpointDebtorInterest(alice);

        uint256 expectedTotal = TWO_PCT_365DAY;
        uint256 expectedInterestOnly = expectedTotal - amount;
        checkBaseInterest(0, amount, amount, block.timestamp, amount, amount, expectedInterestOnly);
        checkDebtor(alice, aliceInterestRate, amount, amount, expectedInterestOnly, block.timestamp, expectedTotal);
    }

    function test_mint_aliceAndBob_inSameBlock() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);
        dUSD.mint(bob, amount);

        // Alice and bob each get equal shares as they were allocated in the same block
        checkBaseInterest(0, 2*amount, 2*amount, block.timestamp, 2*amount, 2*amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, block.timestamp, amount);
        checkDebtor(bob, bobInterestRate, amount, amount, 0, block.timestamp, amount);

        vm.warp(block.timestamp + 365 days);
        dUSD.checkpointBaseInterest();
        dUSD.checkpointDebtorInterest(alice);
        dUSD.checkpointDebtorInterest(bob);

        uint256 aliceExpectedTotal = TWO_PCT_365DAY;
        uint256 aliceExpectedInterestOnly = aliceExpectedTotal - amount;

        uint256 bobExpectedTotal = FIVE_PCT_365DAY;
        uint256 bobExpectedInterestOnly = bobExpectedTotal - amount;

        checkBaseInterest(0, 2*amount, 2*amount, block.timestamp, 2*amount, 2*amount, aliceExpectedInterestOnly+bobExpectedInterestOnly);
        checkDebtor(alice, aliceInterestRate, amount, amount, aliceExpectedInterestOnly, block.timestamp, aliceExpectedTotal);
        checkDebtor(bob, bobInterestRate, amount, amount, bobExpectedInterestOnly, block.timestamp, bobExpectedTotal);
    }

    function test_mint_aliceAndBob_inDifferentBlock() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);

        // Bob borrows 1 day later
        uint256 blockTs = block.timestamp;
        vm.warp(blockTs + 1 days);
        dUSD.mint(bob, amount);

        uint256 aliceExpectedDebt = TWO_PCT_1DAY;
        checkBaseInterest(0, 2*amount, 2*amount, block.timestamp, 2*amount, 2*amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, blockTs, aliceExpectedDebt);
        checkDebtor(bob, bobInterestRate, amount, amount, 0, block.timestamp, amount); // balanceOf rounded down.

        vm.warp(block.timestamp + 364 days);
        dUSD.checkpointBaseInterest();
        dUSD.checkpointDebtorInterest(alice);
        dUSD.checkpointDebtorInterest(bob);

        aliceExpectedDebt = TWO_PCT_365DAY;
        uint256 bobExpectedDebt = FIVE_PCT_364DAY;

        checkBaseInterest(0, 2*amount, 2*amount, block.timestamp, 2*amount, 2*amount, aliceExpectedDebt+bobExpectedDebt-2*amount);
        checkDebtor(alice, aliceInterestRate, amount, amount, aliceExpectedDebt-amount, block.timestamp, aliceExpectedDebt);
        checkDebtor(bob, bobInterestRate, amount, amount, bobExpectedDebt-amount, block.timestamp, bobExpectedDebt);
    }

    function test_burn_alice_inSameBlock() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);
        dUSD.burn(alice, amount);

        checkBaseInterest(0, 0, 0, block.timestamp, 0, 0, 0);
        checkDebtor(alice, aliceInterestRate, 0, 0, 0, block.timestamp, 0);
    }

    function test_burn_alice_aDayLater() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);
        uint256 blockTs = block.timestamp;
        vm.warp(block.timestamp + 1 days);

        uint256 expectedBal = TWO_PCT_1DAY;
        checkBaseInterest(0, amount, amount, blockTs, amount, amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, blockTs, expectedBal);

        dUSD.burn(alice, expectedBal);

        checkBaseInterest(0, 0, 0, block.timestamp, 0, 0, 0);
        checkDebtor(alice, aliceInterestRate, 0, 0, 0, block.timestamp, 0);
    }

    function test_burn_aliceAndBob_inSameBlock() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);
        dUSD.mint(bob, amount);
        dUSD.burn(alice, amount);
        dUSD.burn(bob, amount);

        checkBaseInterest(0, 0, 0, block.timestamp, 0, 0, 0);
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

        uint256 expectedAliceBal = TWO_PCT_1DAY;
        uint256 expectedBobBal = FIVE_PCT_1DAY;

        checkBaseInterest(0, 2*amount, 2*amount, blockTs, 2*amount, 2*amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, blockTs, expectedAliceBal);
        checkDebtor(bob, bobInterestRate, amount, amount, 0, blockTs, expectedBobBal);

        dUSD.burn(alice, expectedAliceBal);
        dUSD.burn(bob, expectedBobBal);

        checkBaseInterest(0, 0, 0, block.timestamp, 0, 0, 0);
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

        uint256 expectedAliceBal = TWO_PCT_2DAY;
        uint256 expectedBobBal = FIVE_PCT_1DAY;
        
        checkBaseInterest(0, 2*amount, 2*amount, blockTs2, 2*amount, 2*amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, blockTs1, expectedAliceBal);
        checkDebtor(bob, bobInterestRate, amount, amount, 0, blockTs2, expectedBobBal);
        
        // Alice pays it off fully
        dUSD.burn(alice, expectedAliceBal);

        checkBaseInterest(0, amount, amount, block.timestamp, amount, amount, 0);
        checkDebtor(alice, aliceInterestRate, 0, 0, 0, block.timestamp, 0);
        checkDebtor(bob, bobInterestRate, amount, amount, 0, blockTs2, expectedBobBal);

        // Bob pays it off fully
        dUSD.burn(bob, expectedBobBal);

        checkBaseInterest(0, 0, 0, block.timestamp, 0, 0, 0);
        checkDebtor(alice, aliceInterestRate, 0, 0, 0, block.timestamp, 0);
        checkDebtor(bob, bobInterestRate, 0, 0, 0, block.timestamp, 0);
    }

    function test_burn_alice_interestRepayOnly() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);
        uint256 blockTs = block.timestamp;
        vm.warp(block.timestamp + 365 days);

        uint256 expectedBal = TWO_PCT_365DAY;
        checkBaseInterest(0, amount, amount, blockTs, amount, amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, blockTs, expectedBal);

        uint256 repayAmount = 1e18;
        dUSD.burn(alice, repayAmount);

        // Expected remaining debtor interest = prior balance minus the repayment amount
        expectedBal = expectedBal - repayAmount;
        checkBaseInterest(0, amount, amount, block.timestamp, amount, amount, expectedBal-amount);
        checkDebtor(alice, aliceInterestRate, amount, amount, expectedBal-amount, block.timestamp, expectedBal);
    }

    function test_burn_aliceAndBob_partial() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);
        uint256 blockTs1 = block.timestamp;
        vm.warp(block.timestamp + 1 days);
        uint256 blockTs2 = block.timestamp;
        dUSD.mint(bob, amount);

        vm.warp(block.timestamp + 1 days);

        uint256 expectedAliceBal = TWO_PCT_2DAY;
        uint256 expectedBobBal = FIVE_PCT_1DAY;

        checkBaseInterest(0, 2*amount, 2*amount, blockTs2, 2*amount, 2*amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, blockTs1, expectedAliceBal);
        checkDebtor(bob, bobInterestRate, amount, amount, 0, blockTs2, expectedBobBal);
        
        // Alice pays 10e18 off
        uint256 repayAmount = 10e18;
        dUSD.burn(alice, repayAmount);

        // shares == amount in this case since there's 0
        expectedAliceBal = expectedAliceBal-repayAmount;
        checkBaseInterest(
            0,
            expectedAliceBal + amount,
            expectedAliceBal + amount,
            block.timestamp, 
            expectedAliceBal + amount,
            expectedAliceBal + amount, 0 // bob hasn't had a checkpoint so the estimate debtor interest is zero
        );

        checkDebtor(alice, aliceInterestRate, expectedAliceBal, expectedAliceBal, 0, block.timestamp, expectedAliceBal);
        checkDebtor(bob, bobInterestRate, amount, amount, 0, blockTs2, expectedBobBal);

        // Alice pays the remainder off
        dUSD.burn(alice, expectedAliceBal);

        checkBaseInterest(0, amount, amount, block.timestamp, amount, amount, 0);
        checkDebtor(alice, aliceInterestRate, 0, 0, 0, block.timestamp, 0);
        checkDebtor(bob, bobInterestRate, amount, amount, 0, blockTs2, expectedBobBal);
    }

    function test_setRiskPremiumInterestRate() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        uint256 startBlockTs = block.timestamp;
        dUSD.mint(alice, amount);
        vm.warp(block.timestamp + 1 days);
        dUSD.mint(bob, amount);

        vm.warp(block.timestamp + 364 days);

        uint256 aliceBal = TWO_PCT_365DAY;
        uint256 bobBal = FIVE_PCT_364DAY;

        checkBaseInterest(0, 2*amount, 2*amount, startBlockTs + 1 days, 2*amount, 2*amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, startBlockTs, aliceBal);
        checkDebtor(bob, bobInterestRate, amount, amount, 0, startBlockTs + 1 days, bobBal);

        vm.startPrank(executor);
        uint96 updatedRate = 0.1e18;
        dUSD.setRiskPremiumInterestRate(alice, updatedRate);

        // The rate was updated and a checkpoint was made.
        // bob's extra interest isn't added to the estimatedDebtorInterest because he didn't checkpoint
        checkBaseInterest(0, 2*amount, 2*amount, block.timestamp, 2*amount, 2*amount, aliceBal-amount);
        checkDebtor(alice, updatedRate, amount, amount, aliceBal-amount, block.timestamp, aliceBal);
        checkDebtor(bob, bobInterestRate, amount, amount, 0, startBlockTs + 1 days, bobBal);

        uint256 ts = block.timestamp;
        vm.warp(block.timestamp + 365 days);

        // 365 days of 10% interest on ONE_PCT_365DAY_ROUNDING
        uint256 aliceBal2 = TEN_PCT_365DAY_1;
        
        bobBal = FIVE_PCT_729DAY;
        checkBaseInterest(0, 2*amount, 2*amount, ts, 2*amount, 2*amount, aliceBal-amount);
        checkDebtor(alice, updatedRate, amount, amount, aliceBal-amount, ts, aliceBal2);
        checkDebtor(bob, bobInterestRate, amount, amount, 0, startBlockTs + 1 days, bobBal);
    }
    
    function test_setRiskPremiumInterestRateToZero() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        uint256 startBlockTs = block.timestamp;
        dUSD.mint(alice, amount);
        vm.warp(block.timestamp + 1 days);
        dUSD.mint(bob, amount);

        vm.warp(block.timestamp + 364 days);

        uint256 aliceBal = TWO_PCT_365DAY;
        uint256 bobBal = FIVE_PCT_364DAY;

        checkBaseInterest(0, 2*amount, 2*amount, startBlockTs + 1 days, 2*amount, 2*amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, startBlockTs, aliceBal);
        checkDebtor(bob, bobInterestRate, amount, amount, 0, startBlockTs + 1 days, bobBal);

        vm.startPrank(executor);
        uint96 updatedRate = 0;
        dUSD.setRiskPremiumInterestRate(alice, updatedRate);

        // The rate was updated and a checkpoint was made.
        // bob's extra interest isn't added to the estimatedDebtorInterest because he didn't checkpoint
        checkBaseInterest(0, 2*amount, 2*amount, block.timestamp, 2*amount, 2*amount, aliceBal-amount);
        checkDebtor(alice, updatedRate, amount, amount, aliceBal-amount, block.timestamp, aliceBal);
        checkDebtor(bob, bobInterestRate, amount, amount, 0, startBlockTs + 1 days, bobBal);

        uint256 ts = block.timestamp;
        vm.warp(block.timestamp + 365 days);

        // 365 days of 0% interest. So Alice's balance remains the same.
        uint256 aliceBal2 = aliceBal;
        
        bobBal = FIVE_PCT_729DAY;
        checkBaseInterest(0, 2*amount, 2*amount, ts, 2*amount, 2*amount, aliceBal-amount);
        checkDebtor(alice, updatedRate, amount, amount, aliceBal-amount, ts, aliceBal2);
        checkDebtor(bob, bobInterestRate, amount, amount, 0, startBlockTs + 1 days, bobBal);
    }

    function test_burnAll() public {
        vm.startPrank(executor);

        uint256 amount = 100e18;
        uint256 startBlockTs = block.timestamp;
        dUSD.mint(alice, amount);
        vm.warp(block.timestamp + 1 days);
        dUSD.mint(bob, amount);

        vm.warp(block.timestamp + 364 days);
        vm.startPrank(executor);
        dUSD.setRiskPremiumInterestRate(alice, 0.1e18);
        vm.warp(block.timestamp + 365 days);

        uint256 bobBal = FIVE_PCT_729DAY;

        vm.startPrank(executor);
        dUSD.burnAll(alice);
        checkBaseInterest(0, amount, amount, block.timestamp, amount, amount, 0);
        checkDebtor(alice, 0.1e18, 0, 0, 0, block.timestamp, 0);
        checkDebtor(bob, bobInterestRate, amount, amount, 0, startBlockTs + 1 days, bobBal);

        dUSD.burnAll(bob);
        checkBaseInterest(0, 0, 0, block.timestamp, 0, 0, 0);
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

        uint256 aliceBal = TWO_PCT_365DAY;
        uint256 bobBal = FIVE_PCT_364DAY;

        checkBaseInterest(0, 2*amount, 2*amount, startBlockTs + 1 days, 2*amount, 2*amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, startBlockTs, aliceBal);
        checkDebtor(bob, bobInterestRate, amount, amount, 0, startBlockTs + 1 days, bobBal);

        address[] memory ds = new address[](2);
        ds[0] = alice;
        ds[1] = bob;
        dUSD.checkpointDebtorsInterest(ds);
        checkBaseInterest(0, 2*amount, 2*amount, block.timestamp, 2*amount, 2*amount, (aliceBal+bobBal)-2*amount);
        checkDebtor(alice, aliceInterestRate, amount, amount, aliceBal-amount, block.timestamp, aliceBal);
        checkDebtor(bob, bobInterestRate, amount, amount, bobBal-amount, block.timestamp, bobBal);
    }

    function test_currentDebtOf() public {
        vm.startPrank(executor);

        uint256 amount = 100e18;
        dUSD.mint(alice, amount);
        vm.warp(block.timestamp + 1 days);
        dUSD.mint(bob, amount);

        vm.warp(block.timestamp + 364 days);
        vm.startPrank(executor);
        dUSD.setRiskPremiumInterestRate(alice, 0.1e18);
        vm.warp(block.timestamp + 365 days);

        ITempleDebtToken.DebtOwed memory userDebt = dUSD.currentDebtOf(alice);
        assertEq(userDebt.principal, amount);
        assertEq(userDebt.baseInterest, 0);
        assertEq(userDebt.riskPremiumInterest, TEN_PCT_365DAY_1-amount);
        assertEq(dUSD.balanceOf(alice), userDebt.principal+userDebt.baseInterest+userDebt.riskPremiumInterest);

        uint256 bobBal = 10501953516812792800;
        userDebt = dUSD.currentDebtOf(bob);
        assertEq(userDebt.principal, amount);
        assertEq(userDebt.baseInterest, 0);
        assertEq(userDebt.riskPremiumInterest, bobBal);
        assertEq(dUSD.balanceOf(bob), userDebt.principal+userDebt.baseInterest+userDebt.riskPremiumInterest);
    }
}
