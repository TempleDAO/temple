// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import {TempleTest} from "../TempleTest.sol";
import {TempleDebtToken} from "contracts/v2/TempleDebtToken.sol";
import {console2} from "forge-std/Test.sol";

contract TempleDebtTokenTest is TempleTest {
    TempleDebtToken public dUSD;

    address public bob = makeAddr("bob");

    uint256 public constant defaultBaseInterest = 0.01e18;

    function setUp() public {
        dUSD = new TempleDebtToken("Temple Debt", "dUSD", gov, defaultBaseInterest);
        vm.prank(gov);
        dUSD.addOperator(operator);
    }

    function testInitalization() public {
        assertEq(dUSD.name(), "Temple Debt");
        assertEq(dUSD.symbol(), "dUSD");
        assertEq(dUSD.decimals(), 18);
        assertEq(dUSD.totalSupply(), 0);

        (uint256 interestRateBps, uint256 totalShares, uint256 totalDebtCheckpoint, uint256 totalDebtCheckpointTime) = dUSD.baseInterest();
        assertEq(interestRateBps, 0.01e18);
        assertEq(totalShares, 0);
        assertEq(totalDebtCheckpoint, 0);
        assertEq(totalDebtCheckpointTime, block.timestamp);
    }

    function dumpBase() internal view {
        console2.log("BASE block.timestamp:", block.timestamp);

        (uint256 interestRateBps, uint256 totalShares, uint256 totalDebtCheckpoint, uint256 totalDebtCheckpointTime) = dUSD.baseInterest();
        console2.log("rate:", interestRateBps);
        console2.log("totalShares:", totalShares);
        console2.log("totalDebtCheckpoint:", totalDebtCheckpoint);
        console2.log("totalDebtCheckpointTime:", totalDebtCheckpointTime);
        console2.log(".");
    }

    function dumpDebtor(address debtor) internal view {
        console2.log("DEBTOR: ", debtor);
        console2.log("block.timestamp:", block.timestamp);

        (uint256 interestRateBps, uint256 debtCheckpointTime, uint256 principal, uint256 debtCheckpoint, uint256 baseInterestShares) = dUSD.debtors(debtor);
        console2.log("rate:", interestRateBps);
        console2.log("baseInterestShares:", baseInterestShares);
        console2.log("principal:", principal);
        console2.log("debtCheckpoint:", debtCheckpoint);
        console2.log("debtCheckpointTime:", debtCheckpointTime);
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

        (uint256 interestRateBps, uint256 totalShares, uint256 totalDebtCheckpoint, uint256 totalDebtCheckpointTime) = dUSD.baseInterest();
        assertEq(interestRateBps, expectedInterestRateBps);
        assertEq(totalShares, expectedTotalShares);
        assertEq(totalDebtCheckpoint, expectedTotalDebtCheckpoint);
        assertEq(totalDebtCheckpointTime, expectedTotalDebtCheckpointTime);

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

        (uint256 interestRateBps, uint256 debtCheckpointTime, uint256 principal, uint256 debtCheckpoint, uint256 baseInterestShares) = dUSD.debtors(debtor);
        assertEq(interestRateBps, expectedInterestRateBps);
        assertEq(debtCheckpointTime, expectedDebtCheckpointTime);
        assertEq(principal, expectedPrincipal);
        assertEq(debtCheckpoint, expectedDebtCheckpoint);
        assertEq(baseInterestShares, expectedBaseInterestShares);

        assertEq(dUSD.balanceOf(debtor), expectedBalancedOf);
    }

    function testBorrow_alice() public {
        vm.prank(operator);
        uint256 amount = 100e18;
        dUSD.borrow(alice, amount);

        // Just the principal at the same block
        checkBaseInterest(defaultBaseInterest, amount, amount, block.timestamp, amount, 0);
        checkDebtor(alice, 0, amount, amount, 0, block.timestamp, amount);

        vm.warp(block.timestamp + 365 days);
        dUSD.checkpointBaseDebt();
        dUSD.checkpointDebtor(alice);

        // 1yr of 1% cont. compounded on 100e18
        uint256 expectedDebt = 101005016708416805700;
        checkBaseInterest(defaultBaseInterest, amount, expectedDebt, block.timestamp, expectedDebt, 0);
        checkDebtor(alice, 0, amount, amount, 0, block.timestamp, expectedDebt);
    }

    function testBorrow_aliceAndBobInSameBlock() public {
        vm.startPrank(operator);
        uint256 amount = 100e18;
        dUSD.borrow(alice, amount);
        dUSD.borrow(bob, amount);

        // Alice and bob each get equal shares as they were allocated in the same block
        checkBaseInterest(defaultBaseInterest, 2*amount, 2*amount, block.timestamp, 2*amount, 0);
        checkDebtor(alice, 0, amount, amount, 0, block.timestamp, amount);
        checkDebtor(bob, 0, amount, amount, 0, block.timestamp, amount);

        vm.warp(block.timestamp + 365 days);
        dUSD.checkpointBaseDebt();
        dUSD.checkpointDebtor(alice);
        dUSD.checkpointDebtor(bob);

        // 1yr of 1% cont. compounded on 100e18
        uint256 expectedDebt = 101005016708416805700;
        checkBaseInterest(defaultBaseInterest, 2*amount, 2*expectedDebt, block.timestamp, 2*expectedDebt, 0);
        checkDebtor(alice, 0, amount, amount, 0, block.timestamp, expectedDebt);
        checkDebtor(bob, 0, amount, amount, 0, block.timestamp, expectedDebt);
    }

// @todo check emit's
// @todo check 0 amounts/addrs

    function testBorrow_aliceAndBobInDifferentBlock() public {
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
        dUSD.checkpointBaseDebt();
        dUSD.checkpointDebtor(alice);
        dUSD.checkpointDebtor(bob);

        // checkpoint includes 364 days of interest on 200002739763558233400
        uint256 expectedTotal = 202007266194009208842;
        checkBaseInterest(defaultBaseInterest, amount+bobExpectedShares, expectedTotal, block.timestamp, expectedTotal, 0);
        aliceExpectedDebt = 101005016708416805542;
        checkDebtor(alice, 0, amount, amount, 0, block.timestamp, aliceExpectedDebt);
        checkDebtor(bob, 0, amount, bobExpectedShares, 0, block.timestamp, expectedTotal-aliceExpectedDebt-1); // balanceOf rounded down.
    }

    function testRepay_alice_InSameBlock() public {
        vm.startPrank(operator);
        uint256 amount = 100e18;
        dUSD.borrow(alice, amount);
        dUSD.repay(alice, amount);

        checkBaseInterest(defaultBaseInterest, 0, 0, block.timestamp, 0, 0);
        checkDebtor(alice, 0, 0, 0, 0, block.timestamp, 0);
    }

// @todo repay more than we have
// @todo Try and brake the debtor principal repay overflow

    function testRepay_alice_ADayLater() public {
        vm.startPrank(operator);
        uint256 amount = 100e18;
        dUSD.borrow(alice, amount);
        uint256 blockTs = block.timestamp;
        vm.warp(block.timestamp + 1 days);

        // 1 day of 1% interest on 100e18
        uint256 expectedBal = 100002739763558233400;
        checkBaseInterest(defaultBaseInterest, amount, amount, blockTs, expectedBal, 0);
        checkDebtor(alice, 0, amount, amount, 0, blockTs, expectedBal);

        // assertEq(dUSD.balanceOf(alice), expectedBal);
        dUSD.repay(alice, expectedBal);

        checkBaseInterest(defaultBaseInterest, 0, 0, block.timestamp, 0, 0);
        checkDebtor(alice, 0, 0, 0, 0, block.timestamp, 0);
    }

    function testRepay_aliceAndBob_InSameBlock() public {
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

    function testRepay_aliceAndBob_ADayLater() public {
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

    function testRepay_aliceAndBob_InDifferentBlocks() public {
        vm.startPrank(operator);
        uint256 amount = 100e18;
        dUSD.borrow(alice, amount);
        uint256 blockTs1 = block.timestamp;
        vm.warp(block.timestamp + 1 days);
        uint256 blockTs2 = block.timestamp;
        dUSD.borrow(bob, amount);

        // uint256 blockTs2 = block.timestamp;
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
