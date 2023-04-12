pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TempleTest } from "../TempleTest.sol";
import { TempleDebtToken } from "contracts/v2/TempleDebtToken.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

import {console2} from "forge-std/Test.sol";

contract TempleDebtTokenTestBase is TempleTest {
    TempleDebtToken public dUSD;
    address public bob = makeAddr("bob");
    uint256 public constant defaultBaseInterest = 0.01e18;

    event BaseInterestRateSet(uint256 rate);
    event DebtorInterestRateSet(address indexed debtor, uint256 rate);
    event RecoveredToken(address indexed token, address to, uint256 amount);
    event Transfer(address indexed from, address indexed to, uint256 value);

    function setUp() public {
        dUSD = new TempleDebtToken("Temple Debt", "dUSD", gov, defaultBaseInterest);
        vm.prank(gov);
        dUSD.addOperator(operator);
    }

    function setBaseInterest(uint256 r) internal {
        vm.prank(gov);
        dUSD.setBaseInterestRate(r);
    }

    function setDebtorInterest(address a, uint256 r) internal {
        vm.prank(gov);
        dUSD.setDebtorInterestRate(a, r);
    }

    function dumpBase() internal view {
        console2.log("BASE block.timestamp:", block.timestamp);

        console2.log("rate:", dUSD.baseRate());
        console2.log("totalShares:", dUSD.baseShares());
        console2.log("totalDebtCheckpoint:", dUSD.baseCheckpoint());
        console2.log("totalDebtCheckpointTime:", dUSD.baseCheckpointTime());
        (uint256 basePrincipalAndInterest, uint256 estimatedDebtorInterest) = dUSD.currentTotalDebt();
        console2.log("basePrincipalAndInterest:", basePrincipalAndInterest);
        console2.log("estimatedDebtorInterest:", estimatedDebtorInterest);
        console2.log(".");
    }

    function dumpDebtor(address debtor) internal view {
        console2.log("DEBTOR: ", debtor);
        console2.log("block.timestamp:", block.timestamp);

        (uint256 principal, uint256 baseShares, uint256 rate, uint256 checkpoint, uint256 checkpointTime) = dUSD.debtors(debtor);
        console2.log("rate:", rate);
        console2.log("baseInterestShares:", baseShares);
        console2.log("principal:", principal);
        console2.log("debtCheckpoint:", checkpoint);
        console2.log("debtCheckpointTime:", checkpointTime);
        console2.log("balanceOf:", dUSD.balanceOf(debtor));
        console2.log(".");
    }

    function checkBaseInterest(
        uint256 expectedInterestRateBps, 
        uint256 expectedTotalShares, 
        uint256 expectedTotalDebtCheckpoint, 
        uint256 expectedTotalDebtCheckpointTime,
        uint256 expectedBasePrincipalAndInterest,
        uint256 expectedEstimatedDebtorInterest
    ) internal {
        dumpBase();

        assertEq(dUSD.baseRate(), expectedInterestRateBps);
        assertEq(dUSD.baseShares(), expectedTotalShares);
        assertEq(dUSD.baseCheckpoint(), expectedTotalDebtCheckpoint);
        assertEq(dUSD.baseCheckpointTime(), expectedTotalDebtCheckpointTime);

        (uint256 basePrincipalAndInterest, uint256 estimatedDebtorInterest) = dUSD.currentTotalDebt();
        assertEq(basePrincipalAndInterest, expectedBasePrincipalAndInterest);
        assertEq(estimatedDebtorInterest, expectedEstimatedDebtorInterest);
    }

    function checkDebtor(
        address debtor,
        uint256 expectedInterestRateBps, 
        uint256 expectedPrincipal,
        uint256 expectedBaseInterestShares,
        uint256 expectedDebtCheckpoint,
        uint256 expectedDebtCheckpointTime,
        uint256 expectedBalancedOf
    ) internal {
        dumpDebtor(debtor);

        (uint256 principal, uint256 baseShares, uint256 rate, uint256 checkpoint, uint256 checkpointTime) = dUSD.debtors(debtor);
        assertEq(rate, expectedInterestRateBps);
        assertEq(principal, expectedPrincipal);
        assertEq(baseShares, expectedBaseInterestShares);
        assertEq(checkpoint, expectedDebtCheckpoint);
        assertEq(checkpointTime, expectedDebtCheckpointTime);

        assertEq(dUSD.balanceOf(debtor), expectedBalancedOf);
    }
}

contract TempleDebtTokenTestAdmin is TempleDebtTokenTestBase {

    function test_initalization() public {
        assertEq(dUSD.name(), "Temple Debt");
        assertEq(dUSD.symbol(), "dUSD");
        assertEq(dUSD.decimals(), 18);
        assertEq(dUSD.totalSupply(), 0);

        assertEq(dUSD.baseRate(), 0.01e18);
        assertEq(dUSD.baseShares(), 0);
        assertEq(dUSD.baseCheckpoint(), 0);
        assertEq(dUSD.baseCheckpointTime(), block.timestamp);
    }

    function test_nonTransferrable() public {
        vm.expectRevert(abi.encodeWithSelector(TempleDebtToken.NonTransferrable.selector));
        dUSD.transfer(alice, 100);

        vm.expectRevert(abi.encodeWithSelector(TempleDebtToken.NonTransferrable.selector));
        dUSD.approve(alice, 100);

        vm.expectRevert(abi.encodeWithSelector(TempleDebtToken.NonTransferrable.selector));
        dUSD.transferFrom(alice, bob, 100);

        assertEq(dUSD.allowance(alice, bob), 0);
    }

    function test_access_addAndRemoveOperator() public {
        vm.startPrank(gov);
        check_addAndRemoveOperator(dUSD);
    }

    function test_access_setBaseInterestRate() public {
        expectOnlyGov();
        dUSD.setBaseInterestRate(0);
    }

    function test_access_setDebtorInterestRate() public {
        expectOnlyGov();
        dUSD.setDebtorInterestRate(alice, 0);
    }

    function test_access_recoverToken() public {
        expectOnlyGov();
        dUSD.recoverToken(address(dUSD), alice, 100);
    }

    function test_access_borrow() public {
        expectOnlyOperators();
        dUSD.borrow(alice, 100);
    }

    function test_access_repay() public {
        expectOnlyOperators();
        dUSD.repay(alice, 100);
    }

    function test_access_repayAll() public {
        expectOnlyOperators();
        dUSD.repayAll(alice);
    }

}

contract TempleDebtTokenTestBaseInterestOnly is TempleDebtTokenTestBase {
    function test_borrow_invalidParams() public {
        vm.startPrank(operator);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector, address(0)));
        dUSD.borrow(address(0), 100);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        dUSD.borrow(alice, 0);
    }

    function test_borrow_alice() public {
        vm.prank(operator);
        uint256 amount = 100e18;

        vm.expectEmit(true, true, true, true);
        emit Transfer(address(0), alice, amount);
        dUSD.borrow(alice, amount);

        // Only the principal at the same block
        checkBaseInterest(defaultBaseInterest, amount, amount, block.timestamp, amount, 0);
        checkDebtor(alice, 0, amount, amount, 0, block.timestamp, amount);

        vm.warp(block.timestamp + 365 days);
        dUSD.checkpointPrincipalAndBaseInterest();
        dUSD.checkpointDebtorInterest(alice);

        // 1yr of 1% cont. compounded on 100e18
        uint256 expectedDebt = 101005016708416805700;
        checkBaseInterest(defaultBaseInterest, amount, expectedDebt, block.timestamp, expectedDebt, 0);
        checkDebtor(alice, 0, amount, amount, 0, block.timestamp, expectedDebt);
    }

    function test_borrow_aliceAndBobInSameBlock() public {
        vm.startPrank(operator);
        uint256 amount = 100e18;
        dUSD.borrow(alice, amount);
        dUSD.borrow(bob, amount);

        // Alice and bob each get equal shares as they were allocated in the same block
        checkBaseInterest(defaultBaseInterest, 2*amount, 2*amount, block.timestamp, 2*amount, 0);
        checkDebtor(alice, 0, amount, amount, 0, block.timestamp, amount);
        checkDebtor(bob, 0, amount, amount, 0, block.timestamp, amount);

        vm.warp(block.timestamp + 365 days);
        dUSD.checkpointPrincipalAndBaseInterest();
        dUSD.checkpointDebtorInterest(alice);
        dUSD.checkpointDebtorInterest(bob);

        // 1yr of 1% cont. compounded on 100e18
        uint256 expectedDebt = 101005016708416805700;
        checkBaseInterest(defaultBaseInterest, 2*amount, 2*expectedDebt, block.timestamp, 2*expectedDebt, 0);
        checkDebtor(alice, 0, amount, amount, 0, block.timestamp, expectedDebt);
        checkDebtor(bob, 0, amount, amount, 0, block.timestamp, expectedDebt);
    }

// @todo check emit's
// @todo check 0 amounts/addrs

    function test_borrow_aliceAndBobInDifferentBlock() public {
        vm.startPrank(operator);
        uint256 amount = 100e18;
        dUSD.borrow(alice, amount);

        // Bob borrows 1 day later
        uint256 blockTs = block.timestamp;
        vm.warp(blockTs + 1 days);
        dUSD.borrow(bob, amount);

        // Bob gets slightly less shares since Alice has accrued a bit extra from the 1 day of solo borrowing
        uint256 bobExpectedShares = 99997260311502753656;

        // checkpoint includes Alice's 1 day of interest on 100e18, plus the extra 100e18
        uint256 aliceExpectedDebt = 100002739763558233400;
        checkBaseInterest(defaultBaseInterest, amount+bobExpectedShares, amount+aliceExpectedDebt, block.timestamp, amount+aliceExpectedDebt, 0);
        checkDebtor(alice, 0, amount, amount, 0, blockTs, aliceExpectedDebt);
        checkDebtor(bob, 0, amount, bobExpectedShares, 0, block.timestamp, amount-1); // balanceOf rounded down.

        vm.warp(block.timestamp + 364 days);
        dUSD.checkpointPrincipalAndBaseInterest();
        dUSD.checkpointDebtorInterest(alice);
        dUSD.checkpointDebtorInterest(bob);

        // checkpoint includes 364 days of interest on 200002739763558233400
        uint256 expectedTotal = 202007266194009208842;
        checkBaseInterest(defaultBaseInterest, amount+bobExpectedShares, expectedTotal, block.timestamp, expectedTotal, 0);
        aliceExpectedDebt = 101005016708416805542;
        checkDebtor(alice, 0, amount, amount, 0, block.timestamp, aliceExpectedDebt);
        checkDebtor(bob, 0, amount, bobExpectedShares, 0, block.timestamp, expectedTotal-aliceExpectedDebt-1); // balanceOf rounded down.
    }

    function test_repay_invalidParams() public {
        vm.startPrank(operator);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector, address(0)));
        dUSD.repay(address(0), 100);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        dUSD.repay(alice, 0);
    }

    function test_repayAll_invalidParams() public {
        vm.startPrank(operator);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector, address(0)));
        dUSD.repayAll(address(0));

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        dUSD.repayAll(alice);
    }

    function test_repay_alice_InSameBlock() public {
        vm.startPrank(operator);
        uint256 amount = 100e18;
        dUSD.borrow(alice, amount);
        dUSD.repay(alice, amount);

        checkBaseInterest(defaultBaseInterest, 0, 0, block.timestamp, 0, 0);
        checkDebtor(alice, 0, 0, 0, 0, block.timestamp, 0);
    }

    function test_repay_tooMuch() public {
        vm.startPrank(operator);
        uint256 amount = 100e18;
        dUSD.borrow(alice, amount);

        vm.expectRevert(abi.encodeWithSelector(TempleDebtToken.RepayingMoreThanDebt.selector, amount, amount+1));
        dUSD.repay(alice, amount+1);
    }

// @todo Try and brake the debtor principal repay overflow

    function test_repay_alice_ADayLater() public {
        vm.startPrank(operator);
        uint256 amount = 100e18;
        dUSD.borrow(alice, amount);
        uint256 blockTs = block.timestamp;
        vm.warp(block.timestamp + 1 days);

        // 1 day of 1% interest on 100e18
        uint256 expectedBal = 100002739763558233400;
        checkBaseInterest(defaultBaseInterest, amount, amount, blockTs, expectedBal, 0);
        checkDebtor(alice, 0, amount, amount, 0, blockTs, expectedBal);

        dUSD.repay(alice, expectedBal);

        checkBaseInterest(defaultBaseInterest, 0, 0, block.timestamp, 0, 0);
        checkDebtor(alice, 0, 0, 0, 0, block.timestamp, 0);
    }

    function test_repay_aliceAndBob_InSameBlock() public {
        vm.startPrank(operator);
        uint256 amount = 100e18;
        dUSD.borrow(alice, amount);
        dUSD.borrow(bob, amount);
        dUSD.repay(alice, amount);
        dUSD.repay(bob, amount);

        checkBaseInterest(defaultBaseInterest, 0, 0, block.timestamp, 0, 0);
        checkDebtor(alice, 0, 0, 0, 0, block.timestamp, 0);
        checkDebtor(bob, 0, 0, 0, 0, block.timestamp, 0);
    }

    function test_repay_aliceAndBob_ADayLater() public {
        vm.startPrank(operator);
        uint256 amount = 100e18;
        dUSD.borrow(alice, amount);
        dUSD.borrow(bob, amount);
        uint256 blockTs = block.timestamp;
        vm.warp(block.timestamp + 1 days);

        // 1 day of 1% interest on 100e18
        uint256 expectedBal = 100002739763558233400;
        checkBaseInterest(defaultBaseInterest, 2*amount, 2*amount, blockTs, 2*expectedBal, 0);
        checkDebtor(alice, 0, amount, amount, 0, blockTs, expectedBal);
        checkDebtor(bob, 0, amount, amount, 0, blockTs, expectedBal);

        dUSD.repay(alice, expectedBal);
        dUSD.repay(bob, expectedBal);

        checkBaseInterest(defaultBaseInterest, 0, 0, block.timestamp, 0, 0);
        checkDebtor(alice, 0, 0, 0, 0, block.timestamp, 0);
        checkDebtor(bob, 0, 0, 0, 0, block.timestamp, 0);
    }

    function test_repay_aliceAndBob_InDifferentBlocks() public {
        vm.startPrank(operator);
        uint256 amount = 100e18;
        dUSD.borrow(alice, amount);
        uint256 blockTs1 = block.timestamp;
        vm.warp(block.timestamp + 1 days);
        uint256 blockTs2 = block.timestamp;
        dUSD.borrow(bob, amount);

        vm.warp(block.timestamp + 1 days);

        uint256 expectedAliceBal = 100005479602179510350;
        uint256 expectedBobBal = 100002739763558233399;
        uint256 expectedBobShares = 99997260311502753656;
        checkBaseInterest(defaultBaseInterest, amount+expectedBobShares, amount+expectedBobBal+1, blockTs2, expectedAliceBal+expectedBobBal+1, 0);
        checkDebtor(alice, 0, amount, amount, 0, blockTs1, expectedAliceBal);
        checkDebtor(bob, 0, amount, expectedBobShares, 0, blockTs2, expectedBobBal);
        
        // Alice pays it off fully
        dUSD.repay(alice, expectedAliceBal);

        checkBaseInterest(defaultBaseInterest, expectedBobShares, expectedBobBal+1, block.timestamp, expectedBobBal+1, 0);
        checkDebtor(alice, 0, 0, 0, 0, block.timestamp, 0);

        // Because of shares->debt rounding, Bob's balance changes by 1 after Alice repays.
        expectedBobBal = expectedBobBal+1;
        checkDebtor(bob, 0, amount, expectedBobShares, 0, blockTs2, expectedBobBal);

        // Bob pays it off fully
        dUSD.repay(bob, expectedBobBal);

        checkBaseInterest(defaultBaseInterest, 0, 0, block.timestamp, 0, 0);
        checkDebtor(alice, 0, 0, 0, 0, block.timestamp, 0);
        checkDebtor(bob, 0, 0, 0, 0, block.timestamp, 0);
    }

    function test_repay_alice_interestRepayOnly() public {
        vm.startPrank(operator);
        uint256 amount = 100e18;
        dUSD.borrow(alice, amount);
        uint256 blockTs = block.timestamp;
        vm.warp(block.timestamp + 365 days);

        // 1 day of 1% interest on 100e18
        uint256 expectedBal = 101005016708416805700;
        checkBaseInterest(defaultBaseInterest, amount, amount, blockTs, expectedBal, 0);
        checkDebtor(alice, 0, amount, amount, 0, blockTs, expectedBal);

        uint256 repayAmount = 1e18;
        uint256 repayShares = dUSD.baseDebtToShares(repayAmount) + 1; // Gets rounded up within repay.
        dUSD.repay(alice, repayAmount);

        checkBaseInterest(defaultBaseInterest, amount-repayShares, expectedBal-repayAmount, block.timestamp, expectedBal-repayAmount, 0);
        checkDebtor(alice, 0, amount, amount-repayShares, 0, block.timestamp, expectedBal-repayAmount);
    }

    function test_repay_aliceAndBob_partial() public {
        vm.startPrank(operator);
        uint256 amount = 100e18;
        dUSD.borrow(alice, amount);
        uint256 blockTs1 = block.timestamp;
        vm.warp(block.timestamp + 1 days);
        uint256 blockTs2 = block.timestamp;
        dUSD.borrow(bob, amount);

        vm.warp(block.timestamp + 1 days);

        uint256 expectedAliceBal = 100005479602179510350;
        uint256 expectedBobBal = 100002739763558233400;
        uint256 expectedBobShares = 99997260311502753656;
        checkBaseInterest(defaultBaseInterest, amount+expectedBobShares, amount+expectedBobBal, blockTs2, expectedAliceBal+expectedBobBal, 0);
        checkDebtor(alice, 0, amount, amount, 0, blockTs1, expectedAliceBal);
        checkDebtor(bob, 0, amount, expectedBobShares, 0, blockTs2, expectedBobBal-1);
        
        // Alice pays 10e18 off
        uint256 repayAmount = 10e18;
        dUSD.repay(alice, repayAmount);
        uint256 repayShares = dUSD.baseDebtToShares(repayAmount);

        checkBaseInterest(
            defaultBaseInterest, 
            amount+expectedBobShares-repayShares-1, 
            expectedBobBal+expectedAliceBal-repayAmount, 
            block.timestamp, 
            expectedBobBal+expectedAliceBal-repayAmount, 
            0
        );

        expectedAliceBal -= repayAmount;
        checkDebtor(alice, 0, expectedAliceBal, amount-repayShares-1, 0, block.timestamp, expectedAliceBal);
        checkDebtor(bob, 0, amount, expectedBobShares, 0, blockTs2, expectedBobBal-1);

        // Alice pays the remainder off
        dUSD.repay(alice, expectedAliceBal);

        checkBaseInterest(defaultBaseInterest, expectedBobShares, expectedBobBal, block.timestamp, expectedBobBal, 0);
        checkDebtor(alice, 0, 0, 0, 0, block.timestamp, 0);
        checkDebtor(bob, 0, amount, expectedBobShares, 0, blockTs2, expectedBobBal);
    }

    function testZeroInterest() public {
        setBaseInterest(0);

        vm.startPrank(operator);
        uint256 amount = 100e18;
        dUSD.borrow(alice, amount);
        uint256 blockTs1 = block.timestamp;
        vm.warp(block.timestamp + 1 days);
        uint256 blockTs2 = block.timestamp;
        dUSD.borrow(bob, amount);
        vm.warp(block.timestamp + 1 days);

        checkBaseInterest(0, 2*amount, 2*amount, blockTs2, 2*amount, 0);
        checkDebtor(alice, 0, amount, amount, 0, blockTs1, amount);
        checkDebtor(bob, 0, amount, amount, 0, blockTs2, amount);
        
        // Alice pays it off fully
        dUSD.repay(alice, amount);
        checkBaseInterest(0, amount, amount, block.timestamp, amount, 0);
        checkDebtor(alice, 0, 0, 0, 0, block.timestamp, 0);

        // Because of shares->debt rounding, Bob's balance changes by 1 after Alice repays.
        checkDebtor(bob, 0, amount, amount, 0, blockTs2, amount);

        // Bob pays it off fully
        dUSD.repay(bob, amount);

        checkBaseInterest(0, 0, 0, block.timestamp, 0, 0);
        checkDebtor(alice, 0, 0, 0, 0, block.timestamp, 0);
        checkDebtor(bob, 0, 0, 0, 0, block.timestamp, 0);
    }

    function testSetBaseInterestRate() public {
        vm.startPrank(operator);
        uint256 amount = 100e18;
        uint256 startBlockTs = block.timestamp;
        dUSD.borrow(alice, amount);
        vm.warp(block.timestamp + 1 days);
        dUSD.borrow(bob, amount);

        vm.warp(block.timestamp + 364 days);

        // 1 day of interest
        uint256 aliceBal = 100002739763558233400;

        // checkpoint includes 364 days of interest on 200002739763558233400 (Alices debt on 1 day interest)
        uint256 expectedTotal = 202007266194009208842;

        // Slightly less than the amount as Alice accrued some interest
        uint256 bobExpectedShares = 99997260311502753656;
        checkBaseInterest(defaultBaseInterest, amount+bobExpectedShares, amount+aliceBal, startBlockTs + 1 days, expectedTotal, 0);

        // 365 days of 1% interest on 100e18
        aliceBal = 101005016708416805542;
        checkDebtor(alice, 0, amount, amount, 0, startBlockTs, aliceBal);

        // 364 days of 1% interest on 100e18
        uint256 bobBal = 101002249485592403299;
        checkDebtor(bob, 0, amount, bobExpectedShares, 0, startBlockTs + 1 days, bobBal);

        changePrank(gov);
        uint256 updatedBaseRate = 0.05e18;
        dUSD.setBaseInterestRate(updatedBaseRate);

        // The rate was updated and a checkpoint was made
        checkBaseInterest(updatedBaseRate, amount+bobExpectedShares, expectedTotal, block.timestamp, expectedTotal, 0);
        checkDebtor(alice, 0, amount, amount, 0, startBlockTs, aliceBal);
        checkDebtor(bob, 0, amount, bobExpectedShares, 0, startBlockTs + 1 days, bobBal);

        uint256 ts = block.timestamp;
        vm.warp(block.timestamp + 365 days);

        // The previous total (202007266194009208842) + 5% cont. compounding for 1 yr
        uint256 expectedBal = 212364400207699397755;
        checkBaseInterest(updatedBaseRate, amount+bobExpectedShares, expectedTotal, ts, expectedBal, 0);

        // 365 days of 5% interest on 101005016708416805542
        aliceBal = 106183654654535961929;
        checkDebtor(alice, 0, amount, amount, 0, startBlockTs, aliceBal);

        // 365 days of 5% interest on 101002249485592403299
        bobBal = 106180745553163435825;
        checkDebtor(bob, 0, amount, bobExpectedShares, 0, startBlockTs + 1 days, bobBal);
    }
}

contract TempleDebtTokenTestDebtorInterestOnly is TempleDebtTokenTestBase {
    uint256 aliceInterestRate = 0.02e18;
    uint256 bobInterestRate = 0.05e18;

    function setRates() internal {
        vm.startPrank(gov);
        dUSD.setBaseInterestRate(0);
        dUSD.setDebtorInterestRate(alice, aliceInterestRate);
        dUSD.setDebtorInterestRate(bob, bobInterestRate);
        vm.stopPrank();
    }

    function test_borrow_alice() public {
        setRates();

        vm.prank(operator);
        uint256 amount = 100e18;
        dUSD.borrow(alice, amount);

        // Just the principal at the same block
        checkBaseInterest(0, amount, amount, block.timestamp, amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, block.timestamp, amount);

        vm.warp(block.timestamp + 365 days);
        dUSD.checkpointPrincipalAndBaseInterest();
        dUSD.checkpointDebtorInterest(alice);

        // 1yr of 2% cont. compounded on 100e18.
        uint256 expectedTotal = 102020134002675580900;
        uint256 expectedInterestOnly = expectedTotal - amount;
        checkBaseInterest(0, amount, amount, block.timestamp, amount, expectedInterestOnly);
        checkDebtor(alice, aliceInterestRate, amount, amount, expectedInterestOnly, block.timestamp, expectedTotal);
    }

    function test_borrow_aliceAndBobInSameBlock() public {
        setRates();

        vm.startPrank(operator);
        uint256 amount = 100e18;
        dUSD.borrow(alice, amount);
        dUSD.borrow(bob, amount);

        // Alice and bob each get equal shares as they were allocated in the same block
        checkBaseInterest(0, 2*amount, 2*amount, block.timestamp, 2*amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, block.timestamp, amount);
        checkDebtor(bob, bobInterestRate, amount, amount, 0, block.timestamp, amount);

        vm.warp(block.timestamp + 365 days);
        dUSD.checkpointPrincipalAndBaseInterest();
        dUSD.checkpointDebtorInterest(alice);
        dUSD.checkpointDebtorInterest(bob);

        // 1yr of 2% cont. compounded on 100e18.
        uint256 aliceExpectedTotal = 102020134002675580900;
        uint256 aliceExpectedInterestOnly = aliceExpectedTotal - amount;

        // 1yr of 5% cont. compounded on 100e18.
        uint256 bobExpectedTotal = 105127109637602403900;
        uint256 bobExpectedInterestOnly = bobExpectedTotal - amount;

        // 1yr of 1% cont. compounded on 100e18
        uint256 expectedDebt = 7147243640277984800;
        checkBaseInterest(0, 2*amount, 2*amount, block.timestamp, 2*amount, expectedDebt);
        checkDebtor(alice, aliceInterestRate, amount, amount, aliceExpectedInterestOnly, block.timestamp, aliceExpectedTotal);
        checkDebtor(bob, bobInterestRate, amount, amount, bobExpectedInterestOnly, block.timestamp, bobExpectedTotal);
    }

    function test_borrow_aliceAndBobInDifferentBlock() public {
        setRates();

        vm.startPrank(operator);
        uint256 amount = 100e18;
        dUSD.borrow(alice, amount);

        // Bob borrows 1 day later
        uint256 blockTs = block.timestamp;
        vm.warp(blockTs + 1 days);
        dUSD.borrow(bob, amount);

        // 1 day of 2% cont. compounded on 100e18
        uint256 aliceExpectedDebt = 100005479602179510500;
        checkBaseInterest(0, 2*amount, 2*amount, block.timestamp, 2*amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, blockTs, aliceExpectedDebt);
        checkDebtor(bob, bobInterestRate, amount, amount, 0, block.timestamp, amount); // balanceOf rounded down.

        vm.warp(block.timestamp + 364 days);
        dUSD.checkpointPrincipalAndBaseInterest();
        dUSD.checkpointDebtorInterest(alice);
        dUSD.checkpointDebtorInterest(bob);

        // 1 year of 2% cont. compounded on 100e18
        aliceExpectedDebt = 102020134002675580900;

        // 1 year of 5% cont. compounded on 100e18
        uint256 bobExpectedDebt = 105112709650002483400;

        checkBaseInterest(0, 2*amount, 2*amount, block.timestamp, 2*amount, aliceExpectedDebt+bobExpectedDebt-2*amount);
        checkDebtor(alice, aliceInterestRate, amount, amount, aliceExpectedDebt-amount, block.timestamp, aliceExpectedDebt);
        checkDebtor(bob, bobInterestRate, amount, amount, bobExpectedDebt-amount, block.timestamp, bobExpectedDebt);
    }

    function test_repay_alice_InSameBlock() public {
        setRates();

        vm.startPrank(operator);
        uint256 amount = 100e18;
        dUSD.borrow(alice, amount);
        dUSD.repay(alice, amount);

        checkBaseInterest(0, 0, 0, block.timestamp, 0, 0);
        checkDebtor(alice, aliceInterestRate, 0, 0, 0, block.timestamp, 0);
    }

    function test_repay_alice_ADayLater() public {
        setRates();

        vm.startPrank(operator);
        uint256 amount = 100e18;
        dUSD.borrow(alice, amount);
        uint256 blockTs = block.timestamp;
        vm.warp(block.timestamp + 1 days);

        // 1 day of 2% interest on 100e18
        uint256 expectedBal = 100005479602179510500;
        checkBaseInterest(0, amount, amount, blockTs, amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, blockTs, expectedBal);

        dUSD.repay(alice, expectedBal);

        checkBaseInterest(0, 0, 0, block.timestamp, 0, 0);
        checkDebtor(alice, aliceInterestRate, 0, 0, 0, block.timestamp, 0);
    }

    function test_repay_aliceAndBob_InSameBlock() public {
        setRates();

        vm.startPrank(operator);
        uint256 amount = 100e18;
        dUSD.borrow(alice, amount);
        dUSD.borrow(bob, amount);
        dUSD.repay(alice, amount);
        dUSD.repay(bob, amount);

        checkBaseInterest(0, 0, 0, block.timestamp, 0, 0);
        checkDebtor(alice, aliceInterestRate, 0, 0, 0, block.timestamp, 0);
        checkDebtor(bob, bobInterestRate, 0, 0, 0, block.timestamp, 0);
    }

    function test_repay_aliceAndBob_ADayLater() public {
        setRates();

        vm.startPrank(operator);
        uint256 amount = 100e18;
        dUSD.borrow(alice, amount);
        dUSD.borrow(bob, amount);
        uint256 blockTs = block.timestamp;
        vm.warp(block.timestamp + 1 days);

        // 1 day of 2% interest on 100e18
        uint256 expectedAliceBal = 100005479602179510500;

        // 1 day of 5% interest on 100e18
        uint256 expectedBobBal = 100013699568442168900;

        checkBaseInterest(0, 2*amount, 2*amount, blockTs, 2*amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, blockTs, expectedAliceBal);
        checkDebtor(bob, bobInterestRate, amount, amount, 0, blockTs, expectedBobBal);

        dUSD.repay(alice, expectedAliceBal);
        dUSD.repay(bob, expectedBobBal);

        checkBaseInterest(0, 0, 0, block.timestamp, 0, 0);
        checkDebtor(alice, aliceInterestRate, 0, 0, 0, block.timestamp, 0);
        checkDebtor(bob, bobInterestRate, 0, 0, 0, block.timestamp, 0);
    }

    function test_repay_aliceAndBob_InDifferentBlocks() public {
        setRates();

        vm.startPrank(operator);
        uint256 amount = 100e18;
        dUSD.borrow(alice, amount);
        uint256 blockTs1 = block.timestamp;
        vm.warp(block.timestamp + 1 days);
        uint256 blockTs2 = block.timestamp;
        dUSD.borrow(bob, amount);

        vm.warp(block.timestamp + 1 days);

        // 2 day of 2% interest on 100e18
        uint256 expectedAliceBal = 100010959504619421600;

        // 1 day of 5% interest on 100e18
        uint256 expectedBobBal = 100013699568442168900;
        
        checkBaseInterest(0, 2*amount, 2*amount, blockTs2, 2*amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, blockTs1, expectedAliceBal);
        checkDebtor(bob, bobInterestRate, amount, amount, 0, blockTs2, expectedBobBal);
        
        // Alice pays it off fully
        dUSD.repay(alice, expectedAliceBal);

        checkBaseInterest(0, amount, amount, block.timestamp, amount, 0);
        checkDebtor(alice, aliceInterestRate, 0, 0, 0, block.timestamp, 0);
        checkDebtor(bob, bobInterestRate, amount, amount, 0, blockTs2, expectedBobBal);

        // Bob pays it off fully
        dUSD.repay(bob, expectedBobBal);

        checkBaseInterest(0, 0, 0, block.timestamp, 0, 0);
        checkDebtor(alice, aliceInterestRate, 0, 0, 0, block.timestamp, 0);
        checkDebtor(bob, bobInterestRate, 0, 0, 0, block.timestamp, 0);
    }

    function test_repay_alice_interestRepayOnly() public {
        setRates();

        vm.startPrank(operator);
        uint256 amount = 100e18;
        dUSD.borrow(alice, amount);
        uint256 blockTs = block.timestamp;
        vm.warp(block.timestamp + 365 days);

        // 1yr of 2% cont. compounded on 100e18.
        uint256 expectedBal = 102020134002675580900;
        checkBaseInterest(0, amount, amount, blockTs, amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, blockTs, expectedBal);

        uint256 repayAmount = 1e18;
        dUSD.repay(alice, repayAmount);

        // Expected remaining debtor interest = prior balance minus the repayment amount
        expectedBal = expectedBal - repayAmount;
        checkBaseInterest(0, amount, amount, block.timestamp, amount, expectedBal-amount);
        checkDebtor(alice, aliceInterestRate, amount, amount, expectedBal-amount, block.timestamp, expectedBal);
    }

    function test_repay_aliceAndBob_partial() public {
        setRates();

        vm.startPrank(operator);
        uint256 amount = 100e18;
        dUSD.borrow(alice, amount);
        uint256 blockTs1 = block.timestamp;
        vm.warp(block.timestamp + 1 days);
        uint256 blockTs2 = block.timestamp;
        dUSD.borrow(bob, amount);

        vm.warp(block.timestamp + 1 days);

        // 2 day of 2% interest on 100e18
        uint256 expectedAliceBal = 100010959504619421600;

        // 1 day of 5% interest on 100e18
        uint256 expectedBobBal = 100013699568442168900;

        checkBaseInterest(0, 2*amount, 2*amount, blockTs2, 2*amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, blockTs1, expectedAliceBal);
        checkDebtor(bob, bobInterestRate, amount, amount, 0, blockTs2, expectedBobBal);
        
        // Alice pays 10e18 off
        uint256 repayAmount = 10e18;
        dUSD.repay(alice, repayAmount);

        // shares == amount in this case since there's 0
        expectedAliceBal = expectedAliceBal-repayAmount;
        checkBaseInterest(
            0,
            expectedAliceBal + amount,
            expectedAliceBal + amount,
            block.timestamp, 
            expectedAliceBal + amount,
            0 // bob hasn't had a checkpoint so the estimate debtor interest is zero
        );

        checkDebtor(alice, aliceInterestRate, expectedAliceBal, expectedAliceBal, 0, block.timestamp, expectedAliceBal);
        checkDebtor(bob, bobInterestRate, amount, amount, 0, blockTs2, expectedBobBal);

        // Alice pays the remainder off
        dUSD.repay(alice, expectedAliceBal);

        checkBaseInterest(0, amount, amount, block.timestamp, amount, 0);
        checkDebtor(alice, aliceInterestRate, 0, 0, 0, block.timestamp, 0);
        checkDebtor(bob, bobInterestRate, amount, amount, 0, blockTs2, expectedBobBal);
    }

    function testSetDebtorInterestRate() public {
        setRates();

        vm.startPrank(operator);
        uint256 amount = 100e18;
        uint256 startBlockTs = block.timestamp;
        dUSD.borrow(alice, amount);
        vm.warp(block.timestamp + 1 days);
        dUSD.borrow(bob, amount);

        vm.warp(block.timestamp + 364 days);

        // 1yr of 2% cont. compounded on 100e18.
        uint256 aliceBal = 102020134002675580900;

        // 1 year of 5% cont. compounded on 100e18
        uint256 bobBal = 105112709650002483400;

        checkBaseInterest(0, 2*amount, 2*amount, startBlockTs + 1 days, 2*amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, startBlockTs, aliceBal);
        checkDebtor(bob, bobInterestRate, amount, amount, 0, startBlockTs + 1 days, bobBal);

        changePrank(gov);
        uint256 updatedRate = 0.1e18;
        dUSD.setDebtorInterestRate(alice, updatedRate);

        // The rate was updated and a checkpoint was made.
        // bob's extra interest isn't added to the estimatedDebtorInterest because he didn't checkpoint
        checkBaseInterest(0, 2*amount, 2*amount, startBlockTs + 1 days, 2*amount, aliceBal-amount);
        checkDebtor(alice, updatedRate, amount, amount, aliceBal-amount, block.timestamp, aliceBal);
        checkDebtor(bob, bobInterestRate, amount, amount, 0, startBlockTs + 1 days, bobBal);

        uint256 ts = block.timestamp;
        vm.warp(block.timestamp + 365 days);

        // 365 days of 10% interest on 101005016708416805542
        uint256 aliceBal2 = 112749685157937566936;
        
        // 365 days of 5% interest on 105112709650002483400
        bobBal = 110501953516812792800;

        checkBaseInterest(0, 2*amount, 2*amount, startBlockTs + 1 days, 2*amount, aliceBal-amount);
        checkDebtor(alice, updatedRate, amount, amount, aliceBal-amount, ts, aliceBal2);
        checkDebtor(bob, bobInterestRate, amount, amount, 0, startBlockTs + 1 days, bobBal);
    }
}

// @todo add a test to check estimatedDebtorInterest pre and post debtor checkpoint