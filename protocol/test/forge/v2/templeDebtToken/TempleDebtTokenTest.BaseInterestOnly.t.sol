pragma solidity 0.8.18;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleDebtTokenTestBase } from "./TempleDebtToken.Base.t.sol";

/* solhint-disable func-name-mixedcase, contract-name-camelcase, not-rely-on-time */
contract TempleDebtTokenTestBaseInterestOnly is TempleDebtTokenTestBase {
    function setUp() public {
        _setUp();
    }

    function test_mint_invalidParams() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        dUSD.mint(address(0), 100);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        dUSD.mint(alice, 0);
    }

    function test_mint_alice() public {
        vm.prank(executor);
        uint256 amount = 100e18;

        vm.expectEmit();
        emit Transfer(address(0), alice, amount);
        dUSD.mint(alice, amount);

        // Only the principal at the same block
        checkBaseInterest(DEFAULT_BASE_INTEREST, amount, amount, block.timestamp, amount, amount, 0);
        checkDebtor(alice, 0, amount, amount, 0, block.timestamp, amount);

        vm.warp(block.timestamp + 365 days);
        dUSD.checkpointBaseInterest();
        dUSD.checkpointDebtorInterest(alice);

        uint256 expectedDebt = ONE_PCT_365DAY;
        checkBaseInterest(DEFAULT_BASE_INTEREST, amount, expectedDebt, block.timestamp, expectedDebt, amount, 0);
        checkDebtor(alice, 0, amount, amount, 0, block.timestamp, expectedDebt);
    }

    function test_mint_aliceAndBob_inSameBlock() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);
        dUSD.mint(bob, amount);

        // Alice and bob each get equal shares as they were allocated in the same block
        checkBaseInterest(DEFAULT_BASE_INTEREST, 2*amount, 2*amount, block.timestamp, 2*amount, 2*amount, 0);
        checkDebtor(alice, 0, amount, amount, 0, block.timestamp, amount);
        checkDebtor(bob, 0, amount, amount, 0, block.timestamp, amount);

        vm.warp(block.timestamp + 365 days);
        dUSD.checkpointBaseInterest();
        dUSD.checkpointDebtorInterest(alice);
        dUSD.checkpointDebtorInterest(bob);

        uint256 expectedDebt = ONE_PCT_365DAY;
        checkBaseInterest(DEFAULT_BASE_INTEREST, 2*amount, 2*expectedDebt, block.timestamp, 2*expectedDebt, 2*amount, 0);
        checkDebtor(alice, 0, amount, amount, 0, block.timestamp, expectedDebt);
        checkDebtor(bob, 0, amount, amount, 0, block.timestamp, expectedDebt);
    }

    function test_mint_aliceAndBob_inDifferentBlock() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);

        // Bob borrows 1 day later
        uint256 blockTs = block.timestamp;
        vm.warp(blockTs + 1 days);
        dUSD.mint(bob, amount);

        // Bob gets slightly less shares since Alice has accrued a bit extra from the 1 day of solo borrowing
        uint256 bobExpectedShares = SECOND_DAY_SHARES;
        uint256 aliceExpectedDebt = ONE_PCT_1DAY;
        checkBaseInterest(DEFAULT_BASE_INTEREST, amount+bobExpectedShares, amount+aliceExpectedDebt, block.timestamp, amount+aliceExpectedDebt, 2*amount, 0);
        checkDebtor(alice, 0, amount, amount, 0, blockTs, aliceExpectedDebt);
        checkDebtor(bob, 0, amount, bobExpectedShares, 0, block.timestamp, amount-1); // balanceOf rounded down.

        vm.warp(block.timestamp + 364 days);
        dUSD.checkpointBaseInterest();
        dUSD.checkpointDebtorInterest(alice);
        dUSD.checkpointDebtorInterest(bob);

        // checkpoint includes 364 days of interest on (ONE_PCT_1DAY+amount)=200002739763558233400
        uint256 expectedTotal = 202007266194009208842;
        checkBaseInterest(DEFAULT_BASE_INTEREST, amount+bobExpectedShares, expectedTotal, block.timestamp, expectedTotal, 2*amount, 0);
        aliceExpectedDebt = ONE_PCT_365DAY_ROUNDING;
        checkDebtor(alice, 0, amount, amount, 0, block.timestamp, aliceExpectedDebt);
        checkDebtor(bob, 0, amount, bobExpectedShares, 0, block.timestamp, expectedTotal-aliceExpectedDebt-1); // balanceOf rounded down.
    }

    function test_burn_invalidParams() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        dUSD.burn(address(0), 100);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        dUSD.burn(alice, 0);
    }

    function test_burn_alice_inSameBlock() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);

        vm.expectEmit();
        emit Transfer(alice, address(0), amount);
        uint256 burnedAmount = dUSD.burn(alice, amount);

        assertEq(burnedAmount, amount);
        checkBaseInterest(DEFAULT_BASE_INTEREST, 0, 0, block.timestamp, 0, 0, 0);
        checkDebtor(alice, 0, 0, 0, 0, block.timestamp, 0);
    }

    function test_burn_tooMuch_cap() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);

        uint256 burnedAmount = dUSD.burn(alice, amount+1);
        assertEq(burnedAmount, amount);

        assertEq(dUSD.balanceOf(alice), 0);
    }

    function test_burn_alice_aDayLater() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);
        uint256 blockTs = block.timestamp;
        vm.warp(block.timestamp + 1 days);

        // 1 day of 1% interest on 100e18
        uint256 expectedBal = ONE_PCT_1DAY;
        checkBaseInterest(DEFAULT_BASE_INTEREST, amount, amount, blockTs, expectedBal, amount, 0);
        checkDebtor(alice, 0, amount, amount, 0, blockTs, expectedBal);

        dUSD.burn(alice, expectedBal);

        checkBaseInterest(DEFAULT_BASE_INTEREST, 0, 0, block.timestamp, 0, 0, 0);
        checkDebtor(alice, 0, 0, 0, 0, block.timestamp, 0);
    }

    function test_burn_aliceAndBob_inSameBlock() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);
        dUSD.mint(bob, amount);
        dUSD.burn(alice, amount);
        dUSD.burn(bob, amount);

        checkBaseInterest(DEFAULT_BASE_INTEREST, 0, 0, block.timestamp, 0, 0, 0);
        checkDebtor(alice, 0, 0, 0, 0, block.timestamp, 0);
        checkDebtor(bob, 0, 0, 0, 0, block.timestamp, 0);
    }

    function test_burn_aliceAndBob_aDayLater() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);
        dUSD.mint(bob, amount);
        uint256 blockTs = block.timestamp;
        vm.warp(block.timestamp + 1 days);

        uint256 expectedBal = ONE_PCT_1DAY;
        checkBaseInterest(DEFAULT_BASE_INTEREST, 2*amount, 2*amount, blockTs, 2*expectedBal, 2*amount, 0);
        checkDebtor(alice, 0, amount, amount, 0, blockTs, expectedBal);
        checkDebtor(bob, 0, amount, amount, 0, blockTs, expectedBal);

        dUSD.burn(alice, expectedBal);
        dUSD.burn(bob, expectedBal);

        checkBaseInterest(DEFAULT_BASE_INTEREST, 0, 0, block.timestamp, 0, 0, 0);
        checkDebtor(alice, 0, 0, 0, 0, block.timestamp, 0);
        checkDebtor(bob, 0, 0, 0, 0, block.timestamp, 0);
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
        
        uint256 expectedAliceBal = ONE_PCT_2DAY;
        uint256 expectedBobBal = ONE_PCT_1DAY;

        // Slightly less than the amount as Alice accrued some interest
        uint256 expectedBobShares = SECOND_DAY_SHARES;
        checkBaseInterest(DEFAULT_BASE_INTEREST, amount+expectedBobShares, amount+expectedBobBal, blockTs2, expectedAliceBal+expectedBobBal, 2*amount, 0);
        checkDebtor(alice, 0, amount, amount, 0, blockTs1, expectedAliceBal);
        checkDebtor(bob, 0, amount, expectedBobShares, 0, blockTs2, expectedBobBal-1);
        
        // Alice pays it off fully
        dUSD.burn(alice, expectedAliceBal);

        checkBaseInterest(DEFAULT_BASE_INTEREST, expectedBobShares, expectedBobBal, block.timestamp, expectedBobBal, amount, 0);
        checkDebtor(alice, 0, 0, 0, 0, block.timestamp, 0);
        checkDebtor(bob, 0, amount, expectedBobShares, 0, blockTs2, expectedBobBal);

        // Bob pays it off fully
        dUSD.burn(bob, expectedBobBal);

        checkBaseInterest(DEFAULT_BASE_INTEREST, 0, 0, block.timestamp, 0, 0, 0);
        checkDebtor(alice, 0, 0, 0, 0, block.timestamp, 0);
        checkDebtor(bob, 0, 0, 0, 0, block.timestamp, 0);
    }

    function test_burn_alice_interestRepayOnly() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);
        uint256 blockTs = block.timestamp;
        vm.warp(block.timestamp + 365 days);

        uint256 expectedBal = ONE_PCT_365DAY;
        checkBaseInterest(DEFAULT_BASE_INTEREST, amount, amount, blockTs, expectedBal, amount, 0);
        checkDebtor(alice, 0, amount, amount, 0, blockTs, expectedBal);

        uint256 repayAmount = 1e18;
        uint256 repayShares = dUSD.baseDebtToShares(repayAmount) + 1; // Gets rounded up within repay.
        dUSD.burn(alice, repayAmount);

        checkBaseInterest(DEFAULT_BASE_INTEREST, amount-repayShares, expectedBal-repayAmount, block.timestamp, expectedBal-repayAmount, amount, 0);
        checkDebtor(alice, 0, amount, amount-repayShares, 0, block.timestamp, expectedBal-repayAmount);
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

        uint256 expectedAliceBal = ONE_PCT_2DAY;
        uint256 expectedBobBal = ONE_PCT_1DAY;

        // Slightly less than the amount as Alice accrued some interest
        uint256 expectedBobShares = SECOND_DAY_SHARES;
        checkBaseInterest(DEFAULT_BASE_INTEREST, amount+expectedBobShares, amount+expectedBobBal, blockTs2, expectedAliceBal+expectedBobBal, 2*amount, 0);
        checkDebtor(alice, 0, amount, amount, 0, blockTs1, expectedAliceBal);
        checkDebtor(bob, 0, amount, expectedBobShares, 0, blockTs2, expectedBobBal-1);
        
        // Alice pays 10e18 off
        uint256 repayAmount = 10e18;
        dUSD.burn(alice, repayAmount);
        uint256 repayShares = dUSD.baseDebtToShares(repayAmount);

        checkBaseInterest(
            DEFAULT_BASE_INTEREST, 
            amount+expectedBobShares-repayShares-1, 
            expectedBobBal+expectedAliceBal-repayAmount, 
            block.timestamp, 
            expectedBobBal+expectedAliceBal-repayAmount, 
            amount+expectedAliceBal-repayAmount, 0
        );

        expectedAliceBal -= repayAmount;
        checkDebtor(alice, 0, expectedAliceBal, amount-repayShares-1, 0, block.timestamp, expectedAliceBal);
        checkDebtor(bob, 0, amount, expectedBobShares, 0, blockTs2, expectedBobBal-1);

        // Alice pays the remainder off
        dUSD.burn(alice, expectedAliceBal);

        checkBaseInterest(DEFAULT_BASE_INTEREST, expectedBobShares, expectedBobBal, block.timestamp, expectedBobBal, amount, 0);
        checkDebtor(alice, 0, 0, 0, 0, block.timestamp, 0);
        checkDebtor(bob, 0, amount, expectedBobShares, 0, blockTs2, expectedBobBal);
    }

    function test_zeroInterest() public {
        setBaseInterest(0);

        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);
        uint256 blockTs1 = block.timestamp;
        vm.warp(block.timestamp + 1 days);
        uint256 blockTs2 = block.timestamp;
        dUSD.mint(bob, amount);
        vm.warp(block.timestamp + 1 days);

        checkBaseInterest(0, 2*amount, 2*amount, blockTs2, 2*amount, 2*amount, 0);
        checkDebtor(alice, 0, amount, amount, 0, blockTs1, amount);
        checkDebtor(bob, 0, amount, amount, 0, blockTs2, amount);
        
        // Alice pays it off fully
        dUSD.burn(alice, amount);
        checkBaseInterest(0, amount, amount, block.timestamp, amount, amount, 0);
        checkDebtor(alice, 0, 0, 0, 0, block.timestamp, 0);

        // Because of shares->debt rounding, Bob's balance changes by 1 after Alice repays.
        checkDebtor(bob, 0, amount, amount, 0, blockTs2, amount);

        // Bob pays it off fully
        dUSD.burn(bob, amount);

        checkBaseInterest(0, 0, 0, block.timestamp, 0, 0, 0);
        checkDebtor(alice, 0, 0, 0, 0, block.timestamp, 0);
        checkDebtor(bob, 0, 0, 0, 0, block.timestamp, 0);
    }

    function test_setBaseInterestRate() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        uint256 startBlockTs = block.timestamp;
        dUSD.mint(alice, amount);
        vm.warp(block.timestamp + 1 days);
        dUSD.mint(bob, amount);

        vm.warp(block.timestamp + 364 days);

        uint256 aliceBal = ONE_PCT_1DAY;
        // checkpoint includes 364 days of interest on (aliceBal+amount)=200002739763558233400
        uint256 expectedTotal = 202007266194009208842;

        // Slightly less than the amount as Alice accrued some interest
        uint256 bobExpectedShares = SECOND_DAY_SHARES;
        checkBaseInterest(DEFAULT_BASE_INTEREST, amount+bobExpectedShares, amount+aliceBal, startBlockTs + 1 days, expectedTotal, 2*amount, 0);

        aliceBal = ONE_PCT_365DAY_ROUNDING;
        checkDebtor(alice, 0, amount, amount, 0, startBlockTs, aliceBal);

        uint256 bobBal = ONE_PCT_364DAY;
        checkDebtor(bob, 0, amount, bobExpectedShares, 0, startBlockTs + 1 days, bobBal-1);

        changePrank(executor);
        uint256 updatedBaseRate = 0.05e18;
        dUSD.setBaseInterestRate(updatedBaseRate);

        // The rate was updated and a checkpoint was made
        checkBaseInterest(updatedBaseRate, amount+bobExpectedShares, expectedTotal, block.timestamp, expectedTotal, 2*amount, 0);
        checkDebtor(alice, 0, amount, amount, 0, startBlockTs, aliceBal);
        checkDebtor(bob, 0, amount, bobExpectedShares, 0, startBlockTs + 1 days, bobBal-1);

        uint256 ts = block.timestamp;
        vm.warp(block.timestamp + 365 days);

        // The previous total (202007266194009208842) + 5% cont. compounding for 1 yr
        uint256 expectedBal = 212364400207699397755;
        checkBaseInterest(updatedBaseRate, amount+bobExpectedShares, expectedTotal, ts, expectedBal, 2*amount, 0);

        // 365 days of 5% interest on ONE_PCT_365DAY_ROUNDING
        aliceBal = 106183654654535961929;
        checkDebtor(alice, 0, amount, amount, 0, startBlockTs, aliceBal);

        // 365 days of 5% interest on ONE_PCT_364DAY
        bobBal = 106180745553163435825;
        checkDebtor(bob, 0, amount, bobExpectedShares, 0, startBlockTs + 1 days, bobBal);
    }

    function test_burnAll_zeroAmount() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        dUSD.burnAll(address(0));

        // Noop as there's no debt
        dUSD.burnAll(alice);
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
        dUSD.setBaseInterestRate(0.05e18);
        vm.warp(block.timestamp + 365 days);

        uint256 bobExpectedShares = SECOND_DAY_SHARES;
        uint256 bobBal = 106180745553163435826;

        changePrank(executor);
        dUSD.burnAll(alice);
        checkBaseInterest(0.05e18, bobExpectedShares, bobBal, block.timestamp, bobBal, amount, 0);
        checkDebtor(alice, 0, 0, 0, 0, block.timestamp, 0);
        checkDebtor(bob, 0, amount, bobExpectedShares, 0, startBlockTs + 1 days, bobBal);

        dUSD.burnAll(bob);
        checkBaseInterest(0.05e18, 0, 0, block.timestamp, 0, 0, 0);
        checkDebtor(alice, 0, 0, 0, 0, block.timestamp, 0);
        checkDebtor(bob, 0, 0, 0, 0, block.timestamp, 0);
    }

    function test_shareToDebtConversion() public {
        vm.startPrank(executor);

        uint256 amount = 100e18;
        dUSD.mint(alice, amount);
        vm.warp(block.timestamp + 1 days);
        dUSD.mint(bob, amount);

        vm.warp(block.timestamp + 364 days);
        changePrank(executor);
        dUSD.setBaseInterestRate(0.05e18);
        vm.warp(block.timestamp + 365 days);

        uint256 bobExpectedShares = SECOND_DAY_SHARES;
        uint256 bobInterest = 12364400207699397755;

        // Test converting one way and back again.
        (uint256 totalPrincipal, uint256 baseInterest,) = dUSD.currentTotalDebt();
        assertEq(totalPrincipal, 2*amount);
        assertEq(baseInterest, bobInterest);
        assertEq(dUSD.baseDebtToShares(totalPrincipal+baseInterest), amount+bobExpectedShares);
        assertEq(dUSD.baseSharesToDebt(dUSD.baseDebtToShares(totalPrincipal+baseInterest)), totalPrincipal+baseInterest);
    }

    function test_currentDebtOf() public {
        vm.startPrank(executor);

        uint256 amount = 100e18;
        dUSD.mint(alice, amount);
        vm.warp(block.timestamp + 1 days);
        dUSD.mint(bob, amount);

        vm.warp(block.timestamp + 364 days);
        changePrank(executor);
        dUSD.setBaseInterestRate(0.05e18);
        vm.warp(block.timestamp + 365 days);

        uint256 aliceBal = 6183654654535961929;
        (uint256 principal, uint256 baseInterest, uint256 riskPremiumInterest) = dUSD.currentDebtOf(alice);
        assertEq(principal, amount);
        assertEq(baseInterest, aliceBal);
        assertEq(riskPremiumInterest, 0);
        assertEq(dUSD.balanceOf(alice), principal+baseInterest+riskPremiumInterest);

        uint256 bobBal = 6180745553163435825;
        (principal, baseInterest, riskPremiumInterest) = dUSD.currentDebtOf(bob);
        assertEq(principal, amount);
        assertEq(baseInterest, bobBal);
        assertEq(riskPremiumInterest, 0);
        assertEq(dUSD.balanceOf(bob), principal+baseInterest+riskPremiumInterest);
    }
}
