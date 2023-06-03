pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TempleTest } from "../TempleTest.sol";
import { ITempleDebtToken, TempleDebtToken } from "contracts/v2/TempleDebtToken.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";
import { CompoundedInterest } from "contracts/v2/interestRate/CompoundedInterest.sol";
import { console2 } from "forge-std/Test.sol";

contract TempleDebtTokenTestBase is TempleTest {
    bool public constant LOG = false;

    TempleDebtToken public dUSD;
    uint256 public constant defaultBaseInterest = 0.01e18;

    // Continuously compounding rates based on 100e18;
    uint256 public constant one_pct_1day = 100002739763558233400;
    uint256 public constant one_pct_2day = 100005479602179510350;
    uint256 public constant one_pct_364day = 101002249485592403300;
    uint256 public constant one_pct_365day = 101005016708416805700;
    
    // The net amount of base interest for 365 days, done in two steps (1 day, then 364 days)
    // There are very insignificant rounding diffs compared to doing it in one go as above
    uint256 public constant one_pct_365day_rounding = 101005016708416805542;

    uint256 public constant two_pct_1day = 100005479602179510500;
    uint256 public constant two_pct_2day = 100010959504619421600;
    uint256 public constant two_pct_365day = 102020134002675580900;
    uint256 public constant five_pct_1day = 100013699568442168900;
    uint256 public constant five_pct_364day = 105112709650002483400;
    uint256 public constant five_pct_365day = 105127109637602403900;
    uint256 public constant five_pct_729day = 110501953516812792800;

    // 10% 365 day cont. compounded interest on `one_pct_365day_rounding`
    uint256 public constant ten_pct_365day_1 = 112749685157937566936;

    // A second minter a day later gets slightly less shares (since the first minter accrued a day of extra debt already)
    uint256 public constant second_day_shares = 99997260311502753656;

    event BaseInterestRateSet(uint256 rate);
    event RiskPremiumInterestRateSet(address indexed debtor, uint256 rate);
    event AddedMinter(address indexed account);
    event RemovedMinter(address indexed account);
    event Transfer(address indexed from, address indexed to, uint256 value);

    // Used for testing to avoid stack too deep
    struct Expected {
        uint256 baseShares;
        uint256 baseTotal;
        uint256 debtorInterestOnly;
        uint256 balanceOf;
    }

    function _setUp() public {
        dUSD = new TempleDebtToken("Temple Debt", "dUSD", rescuer, executor, defaultBaseInterest);
        vm.prank(executor);
        dUSD.addMinter(executor);
    }

    function setBaseInterest(uint256 r) internal {
        vm.prank(executor);
        dUSD.setBaseInterestRate(r);
    }

    function dumpBase() internal view {
        console2.log("BASE block.timestamp:", block.timestamp);

        console2.log("rate:", dUSD.baseRate());
        console2.log("shares:", dUSD.baseShares());
        console2.log("checkpoint:", dUSD.baseCheckpoint());
        console2.log("checkpointTime:", dUSD.baseCheckpointTime());
        (uint256 totalPrincipal, uint256 baseInterest, uint256 estimatedDebtorInterest) = dUSD.currentTotalDebt();
        console2.log("totalPrincipal:", totalPrincipal);
        console2.log("baseInterest:", baseInterest);
        console2.log("principalAndBaseInterest:", totalPrincipal+baseInterest);
        console2.log("estimatedDebtorInterest:", estimatedDebtorInterest);
        console2.log(".");
    }

    function dumpDebtor(address debtor) internal view {
        console2.log("DEBTOR: ", debtor);
        console2.log("block.timestamp:", block.timestamp);

        (uint256 principal, uint256 baseShares, uint256 rate, uint256 checkpoint, uint256 checkpointTime) = dUSD.debtors(debtor);
        console2.log("rate:", rate);
        console2.log("baseShares:", baseShares);
        console2.log("principal:", principal);
        console2.log("checkpoint:", checkpoint);
        console2.log("checkpointTime:", checkpointTime);
        console2.log("balanceOf:", dUSD.balanceOf(debtor));
        console2.log(".");
    }

    function checkBaseInterest(
        uint256 expectedInterestRateBps, 
        uint256 expectedBaseShares, 
        uint256 expectedBaseCheckpoint, 
        uint256 expectedBaseCheckpointTime,
        uint256 expectedCurrentBasePrincipalAndInterest,
        uint256 expectedTotalPrincipal,
        uint256 expectedCurrentEstimatedDebtorInterest
    ) internal {
        if (LOG) dumpBase();

        assertEq(dUSD.baseRate(), expectedInterestRateBps);
        assertEq(dUSD.baseShares(), expectedBaseShares);
        assertEq(dUSD.baseCheckpoint(), expectedBaseCheckpoint);
        assertEq(dUSD.baseCheckpointTime(), expectedBaseCheckpointTime);

        (uint256 totalPrincipal, uint256 baseInterest, uint256 estimatedDebtorInterest) = dUSD.currentTotalDebt();
        assertEq(totalPrincipal+baseInterest, expectedCurrentBasePrincipalAndInterest);
        assertEq(estimatedDebtorInterest, expectedCurrentEstimatedDebtorInterest);
        assertEq(totalPrincipal, expectedTotalPrincipal);
        assertEq(dUSD.totalPrincipal(), totalPrincipal);
    }

    function checkDebtor(
        address debtor,
        uint256 expectedInterestRateBps, 
        uint256 expectedPrincipal,
        uint256 expectedBaseInterestShares,
        uint256 expectedCheckpoint,
        uint256 expectedCheckpointTime,
        uint256 expectedBalancedOf
    ) internal {
        if (LOG) dumpDebtor(debtor);

        (uint256 principal, uint256 baseShares, uint256 rate, uint256 checkpoint, uint256 checkpointTime) = dUSD.debtors(debtor);
        assertEq(rate, expectedInterestRateBps);
        assertEq(principal, expectedPrincipal);
        assertEq(baseShares, expectedBaseInterestShares);
        assertEq(checkpoint, expectedCheckpoint);
        assertEq(checkpointTime, expectedCheckpointTime);

        assertEq(dUSD.balanceOf(debtor), expectedBalancedOf);
    }

    function makeExpected(
        uint256 baseShares, 
        uint256 baseTotal, 
        uint256 debtorInterestOnly
    ) internal pure returns (Expected memory) {
        return Expected({
            baseShares: baseShares,
            baseTotal: baseTotal,
            debtorInterestOnly: debtorInterestOnly,
            balanceOf: baseTotal + debtorInterestOnly
        });
    }
}

contract TempleDebtTokenTestAdmin is TempleDebtTokenTestBase {
    function setUp() public {
        _setUp();
    }

    function test_initalization() public {
        assertEq(dUSD.version(), "1.0.0");
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
        vm.expectRevert(abi.encodeWithSelector(ITempleDebtToken.NonTransferrable.selector));
        dUSD.transfer(alice, 100);

        vm.expectRevert(abi.encodeWithSelector(ITempleDebtToken.NonTransferrable.selector));
        dUSD.approve(alice, 100);

        vm.expectRevert(abi.encodeWithSelector(ITempleDebtToken.NonTransferrable.selector));
        dUSD.transferFrom(alice, bob, 100);

        assertEq(dUSD.allowance(alice, bob), 0);
    }

    function test_access_addAndRemoveMinter() public {
        expectElevatedAccess();
        dUSD.addMinter(alice);

        expectElevatedAccess();
        dUSD.removeMinter(alice);
    }

    function test_addAndRemoveMinter() public {
        vm.startPrank(executor);
        assertEq(dUSD.minters(alice), false);

        vm.expectEmit();
        emit AddedMinter(alice);
        dUSD.addMinter(alice);
        assertEq(dUSD.minters(alice), true);

        vm.expectEmit();
        emit RemovedMinter(alice);
        dUSD.removeMinter(alice);
        assertEq(dUSD.minters(alice), false);
    }

    function test_access_setBaseInterestRate() public {
        expectElevatedAccess();
        dUSD.setBaseInterestRate(0);
    }

    function test_access_setRiskPremiumInterestRate() public {
        expectElevatedAccess();
        dUSD.setRiskPremiumInterestRate(alice, 0);
    }

    function test_access_recoverToken() public {
        expectElevatedAccess();
        dUSD.recoverToken(address(dUSD), alice, 100);
    }

    function expectOnlyMinters() internal {
        vm.prank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(ITempleDebtToken.CannotMintOrBurn.selector, unauthorizedUser));
    }

    function test_access_mint() public {
        expectOnlyMinters();
        dUSD.mint(alice, 100);
    }

    function test_access_burn() public {
        expectOnlyMinters();
        dUSD.burn(alice, 100, false);
    }

    function test_access_burnAll() public {
        expectOnlyMinters();
        dUSD.burnAll(alice);
    }

    function test_recoverToken() public {
        uint256 amount = 100 ether;
        FakeERC20 token = new FakeERC20("fake", "fake", address(dUSD), amount);

        vm.expectEmit();
        emit CommonEventsAndErrors.TokenRecovered(alice, address(token), amount);

        vm.startPrank(executor);
        dUSD.recoverToken(address(token), alice, amount);
        assertEq(token.balanceOf(alice), amount);
        assertEq(token.balanceOf(address(dUSD)), 0);
    }

}

contract TempleDebtTokenTestBaseInterestOnly is TempleDebtTokenTestBase {
    function setUp() public {
        _setUp();
    }

    function test_mint_invalidParams() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector, address(0)));
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
        checkBaseInterest(defaultBaseInterest, amount, amount, block.timestamp, amount, amount, 0);
        checkDebtor(alice, 0, amount, amount, 0, block.timestamp, amount);

        vm.warp(block.timestamp + 365 days);
        dUSD.checkpointBaseInterest();
        dUSD.checkpointDebtorInterest(alice);

        uint256 expectedDebt = one_pct_365day;
        checkBaseInterest(defaultBaseInterest, amount, expectedDebt, block.timestamp, expectedDebt, amount, 0);
        checkDebtor(alice, 0, amount, amount, 0, block.timestamp, expectedDebt);
    }

    function test_mint_aliceAndBob_inSameBlock() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);
        dUSD.mint(bob, amount);

        // Alice and bob each get equal shares as they were allocated in the same block
        checkBaseInterest(defaultBaseInterest, 2*amount, 2*amount, block.timestamp, 2*amount, 2*amount, 0);
        checkDebtor(alice, 0, amount, amount, 0, block.timestamp, amount);
        checkDebtor(bob, 0, amount, amount, 0, block.timestamp, amount);

        vm.warp(block.timestamp + 365 days);
        dUSD.checkpointBaseInterest();
        dUSD.checkpointDebtorInterest(alice);
        dUSD.checkpointDebtorInterest(bob);

        uint256 expectedDebt = one_pct_365day;
        checkBaseInterest(defaultBaseInterest, 2*amount, 2*expectedDebt, block.timestamp, 2*expectedDebt, 2*amount, 0);
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
        uint256 bobExpectedShares = second_day_shares;
        uint256 aliceExpectedDebt = one_pct_1day;
        checkBaseInterest(defaultBaseInterest, amount+bobExpectedShares, amount+aliceExpectedDebt, block.timestamp, amount+aliceExpectedDebt, 2*amount, 0);
        checkDebtor(alice, 0, amount, amount, 0, blockTs, aliceExpectedDebt);
        checkDebtor(bob, 0, amount, bobExpectedShares, 0, block.timestamp, amount-1); // balanceOf rounded down.

        vm.warp(block.timestamp + 364 days);
        dUSD.checkpointBaseInterest();
        dUSD.checkpointDebtorInterest(alice);
        dUSD.checkpointDebtorInterest(bob);

        // checkpoint includes 364 days of interest on (one_pct_1day+amount)=200002739763558233400
        uint256 expectedTotal = 202007266194009208842;
        checkBaseInterest(defaultBaseInterest, amount+bobExpectedShares, expectedTotal, block.timestamp, expectedTotal, 2*amount, 0);
        aliceExpectedDebt = one_pct_365day_rounding;
        checkDebtor(alice, 0, amount, amount, 0, block.timestamp, aliceExpectedDebt);
        checkDebtor(bob, 0, amount, bobExpectedShares, 0, block.timestamp, expectedTotal-aliceExpectedDebt-1); // balanceOf rounded down.
    }

    function test_burn_invalidParams() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector, address(0)));
        dUSD.burn(address(0), 100, false);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        dUSD.burn(alice, 0, false);
    }

    function test_burn_alice_inSameBlock() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);

        vm.expectEmit();
        emit Transfer(alice, address(0), amount);
        uint256 burnedAmount = dUSD.burn(alice, amount, false);

        assertEq(burnedAmount, amount);
        checkBaseInterest(defaultBaseInterest, 0, 0, block.timestamp, 0, 0, 0);
        checkDebtor(alice, 0, 0, 0, 0, block.timestamp, 0);
    }

    function test_burn_tooMuch_error() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);

        vm.expectRevert(abi.encodeWithSelector(ITempleDebtToken.BurnExceedsBalance.selector, amount, amount+1));
        dUSD.burn(alice, amount+1, false);
    }

    function test_burn_tooMuch_cap() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);

        uint256 burnedAmount = dUSD.burn(alice, amount+1, true);
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
        uint256 expectedBal = one_pct_1day;
        checkBaseInterest(defaultBaseInterest, amount, amount, blockTs, expectedBal, amount, 0);
        checkDebtor(alice, 0, amount, amount, 0, blockTs, expectedBal);

        dUSD.burn(alice, expectedBal, false);

        checkBaseInterest(defaultBaseInterest, 0, 0, block.timestamp, 0, 0, 0);
        checkDebtor(alice, 0, 0, 0, 0, block.timestamp, 0);
    }

    function test_burn_aliceAndBob_inSameBlock() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);
        dUSD.mint(bob, amount);
        dUSD.burn(alice, amount, false);
        dUSD.burn(bob, amount, false);

        checkBaseInterest(defaultBaseInterest, 0, 0, block.timestamp, 0, 0, 0);
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

        uint256 expectedBal = one_pct_1day;
        checkBaseInterest(defaultBaseInterest, 2*amount, 2*amount, blockTs, 2*expectedBal, 2*amount, 0);
        checkDebtor(alice, 0, amount, amount, 0, blockTs, expectedBal);
        checkDebtor(bob, 0, amount, amount, 0, blockTs, expectedBal);

        dUSD.burn(alice, expectedBal, false);
        dUSD.burn(bob, expectedBal, false);

        checkBaseInterest(defaultBaseInterest, 0, 0, block.timestamp, 0, 0, 0);
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
        
        uint256 expectedAliceBal = one_pct_2day;
        uint256 expectedBobBal = one_pct_1day;

        // Slightly less than the amount as Alice accrued some interest
        uint256 expectedBobShares = second_day_shares;
        checkBaseInterest(defaultBaseInterest, amount+expectedBobShares, amount+expectedBobBal, blockTs2, expectedAliceBal+expectedBobBal, 2*amount, 0);
        checkDebtor(alice, 0, amount, amount, 0, blockTs1, expectedAliceBal);
        checkDebtor(bob, 0, amount, expectedBobShares, 0, blockTs2, expectedBobBal-1);
        
        // Alice pays it off fully
        dUSD.burn(alice, expectedAliceBal, false);

        checkBaseInterest(defaultBaseInterest, expectedBobShares, expectedBobBal, block.timestamp, expectedBobBal, amount, 0);
        checkDebtor(alice, 0, 0, 0, 0, block.timestamp, 0);
        checkDebtor(bob, 0, amount, expectedBobShares, 0, blockTs2, expectedBobBal);

        // Bob pays it off fully
        dUSD.burn(bob, expectedBobBal, false);

        checkBaseInterest(defaultBaseInterest, 0, 0, block.timestamp, 0, 0, 0);
        checkDebtor(alice, 0, 0, 0, 0, block.timestamp, 0);
        checkDebtor(bob, 0, 0, 0, 0, block.timestamp, 0);
    }

    function test_burn_alice_interestRepayOnly() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);
        uint256 blockTs = block.timestamp;
        vm.warp(block.timestamp + 365 days);

        uint256 expectedBal = one_pct_365day;
        checkBaseInterest(defaultBaseInterest, amount, amount, blockTs, expectedBal, amount, 0);
        checkDebtor(alice, 0, amount, amount, 0, blockTs, expectedBal);

        uint256 repayAmount = 1e18;
        uint256 repayShares = dUSD.baseDebtToShares(repayAmount) + 1; // Gets rounded up within repay.
        dUSD.burn(alice, repayAmount, false);

        checkBaseInterest(defaultBaseInterest, amount-repayShares, expectedBal-repayAmount, block.timestamp, expectedBal-repayAmount, amount, 0);
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

        uint256 expectedAliceBal = one_pct_2day;
        uint256 expectedBobBal = one_pct_1day;

        // Slightly less than the amount as Alice accrued some interest
        uint256 expectedBobShares = second_day_shares;
        checkBaseInterest(defaultBaseInterest, amount+expectedBobShares, amount+expectedBobBal, blockTs2, expectedAliceBal+expectedBobBal, 2*amount, 0);
        checkDebtor(alice, 0, amount, amount, 0, blockTs1, expectedAliceBal);
        checkDebtor(bob, 0, amount, expectedBobShares, 0, blockTs2, expectedBobBal-1);
        
        // Alice pays 10e18 off
        uint256 repayAmount = 10e18;
        dUSD.burn(alice, repayAmount, false);
        uint256 repayShares = dUSD.baseDebtToShares(repayAmount);

        checkBaseInterest(
            defaultBaseInterest, 
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
        dUSD.burn(alice, expectedAliceBal, false);

        checkBaseInterest(defaultBaseInterest, expectedBobShares, expectedBobBal, block.timestamp, expectedBobBal, amount, 0);
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
        dUSD.burn(alice, amount, false);
        checkBaseInterest(0, amount, amount, block.timestamp, amount, amount, 0);
        checkDebtor(alice, 0, 0, 0, 0, block.timestamp, 0);

        // Because of shares->debt rounding, Bob's balance changes by 1 after Alice repays.
        checkDebtor(bob, 0, amount, amount, 0, blockTs2, amount);

        // Bob pays it off fully
        dUSD.burn(bob, amount, false);

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

        uint256 aliceBal = one_pct_1day;
        // checkpoint includes 364 days of interest on (aliceBal+amount)=200002739763558233400
        uint256 expectedTotal = 202007266194009208842;

        // Slightly less than the amount as Alice accrued some interest
        uint256 bobExpectedShares = second_day_shares;
        checkBaseInterest(defaultBaseInterest, amount+bobExpectedShares, amount+aliceBal, startBlockTs + 1 days, expectedTotal, 2*amount, 0);

        aliceBal = one_pct_365day_rounding;
        checkDebtor(alice, 0, amount, amount, 0, startBlockTs, aliceBal);

        uint256 bobBal = one_pct_364day;
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

        // 365 days of 5% interest on one_pct_365day_rounding
        aliceBal = 106183654654535961929;
        checkDebtor(alice, 0, amount, amount, 0, startBlockTs, aliceBal);

        // 365 days of 5% interest on one_pct_364day
        bobBal = 106180745553163435825;
        checkDebtor(bob, 0, amount, bobExpectedShares, 0, startBlockTs + 1 days, bobBal);
    }

    function test_burnAll_invalidParams() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector, address(0)));
        dUSD.burnAll(address(0));

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
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

        uint256 bobExpectedShares = second_day_shares;
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

        uint256 bobExpectedShares = second_day_shares;
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

contract TempleDebtTokenTestDebtorInterestOnly is TempleDebtTokenTestBase {
    uint256 aliceInterestRate = 0.02e18;
    uint256 bobInterestRate = 0.05e18;

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

        uint256 expectedTotal = two_pct_365day;
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

        uint256 aliceExpectedTotal = two_pct_365day;
        uint256 aliceExpectedInterestOnly = aliceExpectedTotal - amount;

        uint256 bobExpectedTotal = five_pct_365day;
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

        uint256 aliceExpectedDebt = two_pct_1day;
        checkBaseInterest(0, 2*amount, 2*amount, block.timestamp, 2*amount, 2*amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, blockTs, aliceExpectedDebt);
        checkDebtor(bob, bobInterestRate, amount, amount, 0, block.timestamp, amount); // balanceOf rounded down.

        vm.warp(block.timestamp + 364 days);
        dUSD.checkpointBaseInterest();
        dUSD.checkpointDebtorInterest(alice);
        dUSD.checkpointDebtorInterest(bob);

        aliceExpectedDebt = two_pct_365day;
        uint256 bobExpectedDebt = five_pct_364day;

        checkBaseInterest(0, 2*amount, 2*amount, block.timestamp, 2*amount, 2*amount, aliceExpectedDebt+bobExpectedDebt-2*amount);
        checkDebtor(alice, aliceInterestRate, amount, amount, aliceExpectedDebt-amount, block.timestamp, aliceExpectedDebt);
        checkDebtor(bob, bobInterestRate, amount, amount, bobExpectedDebt-amount, block.timestamp, bobExpectedDebt);
    }

    function test_burn_alice_inSameBlock() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);
        dUSD.burn(alice, amount, false);

        checkBaseInterest(0, 0, 0, block.timestamp, 0, 0, 0);
        checkDebtor(alice, aliceInterestRate, 0, 0, 0, block.timestamp, 0);
    }

    function test_burn_alice_aDayLater() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);
        uint256 blockTs = block.timestamp;
        vm.warp(block.timestamp + 1 days);

        uint256 expectedBal = two_pct_1day;
        checkBaseInterest(0, amount, amount, blockTs, amount, amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, blockTs, expectedBal);

        dUSD.burn(alice, expectedBal, false);

        checkBaseInterest(0, 0, 0, block.timestamp, 0, 0, 0);
        checkDebtor(alice, aliceInterestRate, 0, 0, 0, block.timestamp, 0);
    }

    function test_burn_aliceAndBob_inSameBlock() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);
        dUSD.mint(bob, amount);
        dUSD.burn(alice, amount, false);
        dUSD.burn(bob, amount, false);

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

        uint256 expectedAliceBal = two_pct_1day;
        uint256 expectedBobBal = five_pct_1day;

        checkBaseInterest(0, 2*amount, 2*amount, blockTs, 2*amount, 2*amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, blockTs, expectedAliceBal);
        checkDebtor(bob, bobInterestRate, amount, amount, 0, blockTs, expectedBobBal);

        dUSD.burn(alice, expectedAliceBal, false);
        dUSD.burn(bob, expectedBobBal, false);

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

        uint256 expectedAliceBal = two_pct_2day;
        uint256 expectedBobBal = five_pct_1day;
        
        checkBaseInterest(0, 2*amount, 2*amount, blockTs2, 2*amount, 2*amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, blockTs1, expectedAliceBal);
        checkDebtor(bob, bobInterestRate, amount, amount, 0, blockTs2, expectedBobBal);
        
        // Alice pays it off fully
        dUSD.burn(alice, expectedAliceBal, false);

        checkBaseInterest(0, amount, amount, block.timestamp, amount, amount, 0);
        checkDebtor(alice, aliceInterestRate, 0, 0, 0, block.timestamp, 0);
        checkDebtor(bob, bobInterestRate, amount, amount, 0, blockTs2, expectedBobBal);

        // Bob pays it off fully
        dUSD.burn(bob, expectedBobBal, false);

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

        uint256 expectedBal = two_pct_365day;
        checkBaseInterest(0, amount, amount, blockTs, amount, amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, blockTs, expectedBal);

        uint256 repayAmount = 1e18;
        dUSD.burn(alice, repayAmount, false);

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

        uint256 expectedAliceBal = two_pct_2day;
        uint256 expectedBobBal = five_pct_1day;

        checkBaseInterest(0, 2*amount, 2*amount, blockTs2, 2*amount, 2*amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, blockTs1, expectedAliceBal);
        checkDebtor(bob, bobInterestRate, amount, amount, 0, blockTs2, expectedBobBal);
        
        // Alice pays 10e18 off
        uint256 repayAmount = 10e18;
        dUSD.burn(alice, repayAmount, false);

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
        dUSD.burn(alice, expectedAliceBal, false);

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

        uint256 aliceBal = two_pct_365day;
        uint256 bobBal = five_pct_364day;

        checkBaseInterest(0, 2*amount, 2*amount, startBlockTs + 1 days, 2*amount, 2*amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, startBlockTs, aliceBal);
        checkDebtor(bob, bobInterestRate, amount, amount, 0, startBlockTs + 1 days, bobBal);

        changePrank(executor);
        uint256 updatedRate = 0.1e18;
        dUSD.setRiskPremiumInterestRate(alice, updatedRate);

        // The rate was updated and a checkpoint was made.
        // bob's extra interest isn't added to the estimatedDebtorInterest because he didn't checkpoint
        checkBaseInterest(0, 2*amount, 2*amount, startBlockTs + 1 days, 2*amount, 2*amount, aliceBal-amount);
        checkDebtor(alice, updatedRate, amount, amount, aliceBal-amount, block.timestamp, aliceBal);
        checkDebtor(bob, bobInterestRate, amount, amount, 0, startBlockTs + 1 days, bobBal);

        uint256 ts = block.timestamp;
        vm.warp(block.timestamp + 365 days);

        // 365 days of 10% interest on one_pct_365day_rounding
        uint256 aliceBal2 = ten_pct_365day_1;
        
        bobBal = five_pct_729day;
        checkBaseInterest(0, 2*amount, 2*amount, startBlockTs + 1 days, 2*amount, 2*amount, aliceBal-amount);
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
        changePrank(executor);
        dUSD.setRiskPremiumInterestRate(alice, 0.1e18);
        vm.warp(block.timestamp + 365 days);

        uint256 bobBal = five_pct_729day;

        changePrank(executor);
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

        uint256 aliceBal = two_pct_365day;
        uint256 bobBal = five_pct_364day;

        checkBaseInterest(0, 2*amount, 2*amount, startBlockTs + 1 days, 2*amount, 2*amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, startBlockTs, aliceBal);
        checkDebtor(bob, bobInterestRate, amount, amount, 0, startBlockTs + 1 days, bobBal);

        address[] memory ds = new address[](2);
        ds[0] = alice;
        ds[1] = bob;
        dUSD.checkpointDebtorsInterest(ds);
        checkBaseInterest(0, 2*amount, 2*amount, startBlockTs + 1 days, 2*amount, 2*amount, (aliceBal+bobBal)-2*amount);
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
        changePrank(executor);
        dUSD.setRiskPremiumInterestRate(alice, 0.1e18);
        vm.warp(block.timestamp + 365 days);

        (uint256 principal, uint256 baseInterest, uint256 riskPremiumInterest) = dUSD.currentDebtOf(alice);
        assertEq(principal, amount);
        assertEq(baseInterest, 0);
        assertEq(riskPremiumInterest, ten_pct_365day_1-amount);
        assertEq(dUSD.balanceOf(alice), principal+baseInterest+riskPremiumInterest);

        uint256 bobBal = 10501953516812792800;
        (principal, baseInterest, riskPremiumInterest) = dUSD.currentDebtOf(bob);
        assertEq(principal, amount);
        assertEq(baseInterest, 0);
        assertEq(riskPremiumInterest, bobBal);
        assertEq(dUSD.balanceOf(bob), principal+baseInterest+riskPremiumInterest);
    }
}

contract TempleDebtTokenTestBaseAndDebtorInterest is TempleDebtTokenTestBase {
    uint256 aliceInterestRate = 0.02e18;
    uint256 bobInterestRate = 0.05e18;

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
        checkBaseInterest(defaultBaseInterest, amount, amount, block.timestamp, amount, amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, block.timestamp, amount);

        vm.warp(block.timestamp + 365 days);
        dUSD.checkpointBaseInterest();
        dUSD.checkpointDebtorInterest(alice);

        uint256 expectedBaseDebt = one_pct_365day;
        uint256 expectedDebtorTotal = two_pct_365day;
        uint256 expectedDebtorInterestOnly = expectedDebtorTotal - amount;
        checkBaseInterest(defaultBaseInterest, amount, expectedBaseDebt, block.timestamp, expectedBaseDebt, amount, expectedDebtorInterestOnly);
        checkDebtor(alice, aliceInterestRate, amount, amount, expectedDebtorInterestOnly, block.timestamp, expectedDebtorTotal+expectedBaseDebt-amount);
    }

    function test_mint_aliceAndBob_inSameBlock() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);
        dUSD.mint(bob, amount);

        // Alice and bob each get equal shares as they were allocated in the same block
        checkBaseInterest(defaultBaseInterest, 2*amount, 2*amount, block.timestamp, 2*amount, 2*amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, block.timestamp, amount);
        checkDebtor(bob, bobInterestRate, amount, amount, 0, block.timestamp, amount);

        vm.warp(block.timestamp + 365 days);
        dUSD.checkpointBaseInterest();
        dUSD.checkpointDebtorInterest(alice);
        dUSD.checkpointDebtorInterest(bob);

        uint256 aliceExpectedBaseTotal = one_pct_365day;
        uint256 aliceExpectedDebtorInterestOnly = two_pct_365day - amount;
        uint256 aliceExpectedBalanceOf = aliceExpectedBaseTotal + aliceExpectedDebtorInterestOnly;

        uint256 bobExpectedBaseTotal = one_pct_365day;
        uint256 bobExpectedDebtorInterestOnly = five_pct_365day - amount;
        uint256 bobExpectedBalanceOf = bobExpectedBaseTotal + bobExpectedDebtorInterestOnly;

        checkBaseInterest(
            defaultBaseInterest, 2*amount, 
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

        uint256 aliceExpectedBaseTotal = one_pct_1day;
        uint256 aliceExpectedDebtorInterestOnly = two_pct_1day - amount;
        uint256 aliceExpectedBalanceOf = aliceExpectedBaseTotal + aliceExpectedDebtorInterestOnly;

        // Bob gets slightly less shares since Alice has accrued a bit extra from the 1 day of solo borrowing
        uint256 bobExpectedShares = second_day_shares;

        checkBaseInterest(defaultBaseInterest, amount+bobExpectedShares, amount+aliceExpectedBaseTotal, block.timestamp, amount+aliceExpectedBaseTotal, 2*amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, blockTs, aliceExpectedBalanceOf);
        checkDebtor(bob, bobInterestRate, amount, bobExpectedShares, 0, block.timestamp, amount-1); // balanceOf rounded down.

        vm.warp(block.timestamp + 364 days);
        dUSD.checkpointBaseInterest();
        dUSD.checkpointDebtorInterest(alice);
        dUSD.checkpointDebtorInterest(bob);

        aliceExpectedBaseTotal = one_pct_365day_rounding;
        aliceExpectedDebtorInterestOnly = two_pct_365day - amount;
        aliceExpectedBalanceOf = aliceExpectedBaseTotal + aliceExpectedDebtorInterestOnly;

        uint256 bobExpectedBaseTotal = one_pct_364day;
        uint256 bobExpectedDebtorInterestOnly = five_pct_364day - amount;
        uint256 bobExpectedBalanceOf = bobExpectedBaseTotal + bobExpectedDebtorInterestOnly;

        checkBaseInterest(
            defaultBaseInterest, amount+bobExpectedShares, 
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
        dUSD.burn(alice, amount, false);

        checkBaseInterest(defaultBaseInterest, 0, 0, block.timestamp, 0, 0, 0);
        checkDebtor(alice, aliceInterestRate, 0, 0, 0, block.timestamp, 0);
    }

    function test_burn_alice_aDayLater() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);
        uint256 blockTs = block.timestamp;
        vm.warp(block.timestamp + 1 days);

        uint256 aliceExpectedBaseTotal = one_pct_1day;
        uint256 aliceExpectedDebtorInterestOnly = two_pct_1day - amount;
        uint256 aliceExpectedBalanceOf = aliceExpectedBaseTotal + aliceExpectedDebtorInterestOnly;

        checkBaseInterest(defaultBaseInterest, amount, amount, blockTs, aliceExpectedBaseTotal, amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, blockTs, aliceExpectedBalanceOf);

        dUSD.burn(alice, aliceExpectedBalanceOf, false);

        checkBaseInterest(defaultBaseInterest, 0, 0, block.timestamp, 0, 0, 0);
        checkDebtor(alice, aliceInterestRate, 0, 0, 0, block.timestamp, 0);
    }

    function test_burn_aliceAndBob_inSameBlock() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);
        dUSD.mint(bob, amount);
        dUSD.burn(alice, amount, false);
        dUSD.burn(bob, amount, false);

        checkBaseInterest(defaultBaseInterest, 0, 0, block.timestamp, 0, 0, 0);
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

        uint256 aliceExpectedBaseTotal = one_pct_1day;
        uint256 aliceExpectedDebtorInterestOnly = two_pct_1day - amount;
        uint256 aliceExpectedBalanceOf = aliceExpectedBaseTotal + aliceExpectedDebtorInterestOnly;

        uint256 bobExpectedBaseTotal = one_pct_1day;
        uint256 bobExpectedDebtorInterestOnly = five_pct_1day - amount;
        uint256 bobExpectedBalanceOf = bobExpectedBaseTotal + bobExpectedDebtorInterestOnly;

        checkBaseInterest(defaultBaseInterest, 2*amount, 2*amount, blockTs, aliceExpectedBaseTotal+bobExpectedBaseTotal, 2*amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, blockTs, aliceExpectedBalanceOf);
        checkDebtor(bob, bobInterestRate, amount, amount, 0, blockTs, bobExpectedBalanceOf);

        dUSD.burn(alice, aliceExpectedBalanceOf, false);
        dUSD.burn(bob, bobExpectedBalanceOf, false);

        checkBaseInterest(defaultBaseInterest, 0, 0, block.timestamp, 0, 0, 0);
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

        uint256 aliceExpectedBaseTotal = one_pct_2day;
        uint256 aliceExpectedDebtorInterestOnly = two_pct_2day - amount;
        uint256 aliceExpectedBalanceOf = aliceExpectedBaseTotal + aliceExpectedDebtorInterestOnly;

        uint256 bobExpectedBaseTotal = one_pct_1day;
        uint256 bobExpectedDebtorInterestOnly = five_pct_1day - amount;
        uint256 bobExpectedBalanceOf = bobExpectedBaseTotal + bobExpectedDebtorInterestOnly;

        // Bob gets slightly less shares since Alice has accrued a bit extra from the 1 day of solo borrowing
        uint256 bobExpectedShares = second_day_shares;

        checkBaseInterest(defaultBaseInterest, amount+bobExpectedShares, amount+bobExpectedBaseTotal, blockTs2, aliceExpectedBaseTotal+bobExpectedBaseTotal, 2*amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, blockTs1, aliceExpectedBalanceOf);
        checkDebtor(bob, bobInterestRate, amount, bobExpectedShares, 0, blockTs2, bobExpectedBalanceOf-1);

        // Alice pays it off fully
        dUSD.burn(alice, aliceExpectedBalanceOf, false);

        checkBaseInterest(defaultBaseInterest, bobExpectedShares, bobExpectedBaseTotal, block.timestamp, bobExpectedBaseTotal, amount, 0);
        checkDebtor(alice, aliceInterestRate, 0, 0, 0, block.timestamp, 0);
        checkDebtor(bob, bobInterestRate, amount, bobExpectedShares, 0, blockTs2, bobExpectedBalanceOf);

        // Bob pays it off fully
        dUSD.burn(bob, bobExpectedBalanceOf, false);

        checkBaseInterest(defaultBaseInterest, 0, 0, block.timestamp, 0, 0, 0);
        checkDebtor(alice, aliceInterestRate, 0, 0, 0, block.timestamp, 0);
        checkDebtor(bob, bobInterestRate, 0, 0, 0, block.timestamp, 0);
    }

    function test_burn_alice_interestRepayOnly() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);
        uint256 blockTs = block.timestamp;
        vm.warp(block.timestamp + 365 days);

        uint256 aliceExpectedBaseTotal = one_pct_365day;
        uint256 aliceExpectedDebtorInterestOnly = two_pct_365day - amount;
        uint256 aliceExpectedBalanceOf = aliceExpectedBaseTotal + aliceExpectedDebtorInterestOnly;

        checkBaseInterest(defaultBaseInterest, amount, amount, blockTs, aliceExpectedBaseTotal, amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, blockTs, aliceExpectedBalanceOf);

        uint256 repayAmount = 1e18;
        dUSD.burn(alice, repayAmount, false);

        // Expected remaining debtor interest = prior balance minus the repayment amount
        aliceExpectedBalanceOf = aliceExpectedBalanceOf - repayAmount;

        // Expected remaining base interest remains the same - nothing was taken off this because the repayment was small
        checkBaseInterest(defaultBaseInterest, amount, aliceExpectedBaseTotal, block.timestamp, aliceExpectedBaseTotal, amount, aliceExpectedDebtorInterestOnly-repayAmount);
        checkDebtor(alice, aliceInterestRate, amount, amount, aliceExpectedDebtorInterestOnly-repayAmount, block.timestamp, aliceExpectedBalanceOf);
    }

    function test_burn_alice_flippedRates() public {
        // Flip so the base rate is higher than Alice's rate
        // so we can check the order of what gets paid off first.
        vm.startPrank(executor);
        dUSD.setBaseInterestRate(aliceInterestRate);
        dUSD.setRiskPremiumInterestRate(alice, defaultBaseInterest);
        vm.stopPrank();

        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);
        uint256 blockTs = block.timestamp;
        vm.warp(block.timestamp + 365 days);

        uint256 aliceExpectedBaseTotal = two_pct_365day;
        uint256 aliceExpectedDebtorInterestOnly = one_pct_365day - amount;
        uint256 aliceExpectedBalanceOf = aliceExpectedBaseTotal + aliceExpectedDebtorInterestOnly;

        checkBaseInterest(aliceInterestRate, amount, amount, blockTs, aliceExpectedBaseTotal, amount, 0);
        checkDebtor(alice, defaultBaseInterest, amount, amount, 0, blockTs, aliceExpectedBalanceOf);

        uint256 repayAmount = 0.5e18;
        uint256 repayShares = dUSD.baseDebtToShares(repayAmount) + 1;  // Gets rounded up within repay.
        dUSD.burn(alice, repayAmount, false);

        // Expected remaining debtor interest = prior balance minus the repayment amount
        aliceExpectedBalanceOf = aliceExpectedBalanceOf - repayAmount;

        // The base interest and shares goes down by the repay amount, Alice's specific debt is unchanged.
        checkBaseInterest(aliceInterestRate, amount-repayShares, aliceExpectedBaseTotal-repayAmount, block.timestamp, aliceExpectedBaseTotal-repayAmount, amount, aliceExpectedDebtorInterestOnly);
        checkDebtor(alice, defaultBaseInterest, amount, amount-repayShares, aliceExpectedDebtorInterestOnly, block.timestamp, aliceExpectedBalanceOf);
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
            /*base total*/      one_pct_2day,
            /*debtor int only*/ two_pct_2day - amount
        );
        Expected memory bobExpected = makeExpected(
            /*shares*/          second_day_shares,
            /*base total*/      one_pct_1day,
            /*debtor int only*/ five_pct_1day - amount
        );

        checkBaseInterest(defaultBaseInterest, amount+bobExpected.baseShares, amount+bobExpected.baseTotal, block.timestamp-1 days, aliceExpected.baseTotal+bobExpected.baseTotal, 2*amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, amount, 0, block.timestamp-2 days, aliceExpected.balanceOf);
        checkDebtor(bob, bobInterestRate, amount, bobExpected.baseShares, 0, block.timestamp-1 days, bobExpected.balanceOf-1);
        
        // Alice pays 10e18 off
        uint256 repayAmount = 10e18;
        dUSD.burn(alice, repayAmount, false);

        // The repaid amount from the base is the actual repaid amount minus what we paid off from Alice's risk premium interest
        uint256 baseRepayAmount = repayAmount - aliceExpected.debtorInterestOnly;

        checkBaseInterest(
            defaultBaseInterest,
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
        dUSD.burn(alice, aliceExpected.balanceOf-repayAmount, false);

        checkBaseInterest(defaultBaseInterest, bobExpected.baseShares, bobExpected.baseTotal, block.timestamp, bobExpected.baseTotal, amount, 0);
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
            /*base total*/      one_pct_365day_rounding,
            /*debtor int only*/ two_pct_365day - amount
        );
        Expected memory bobExpected = makeExpected(
            /*shares*/          second_day_shares,
            /*base total*/      one_pct_364day,
            /*debtor int only*/ five_pct_364day - amount
        );
        
        checkBaseInterest(defaultBaseInterest, aliceExpected.baseShares+bobExpected.baseShares, one_pct_1day + amount, startBlockTs + 1 days, aliceExpected.baseTotal+bobExpected.baseTotal, 2*amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, aliceExpected.baseShares, 0, startBlockTs, aliceExpected.balanceOf);
        checkDebtor(bob, bobInterestRate, amount, bobExpected.baseShares, 0, startBlockTs + 1 days, bobExpected.balanceOf-1); // balanceOf rounded down

        changePrank(executor);
        uint256 updatedRate = 0.1e18;
        dUSD.setRiskPremiumInterestRate(alice, updatedRate);

        // The rate was updated and a checkpoint was made.
        // bob's extra interest isn't added to the estimatedDebtorInterest because he didn't checkpoint
        checkBaseInterest(defaultBaseInterest, amount+bobExpected.baseShares, one_pct_1day + amount, startBlockTs + 1 days, aliceExpected.baseTotal+bobExpected.baseTotal, 2*amount, aliceExpected.debtorInterestOnly);
        checkDebtor(alice, updatedRate, amount, amount, aliceExpected.debtorInterestOnly, block.timestamp, aliceExpected.balanceOf);
        checkDebtor(bob, bobInterestRate, amount, bobExpected.baseShares, 0, startBlockTs + 1 days, bobExpected.balanceOf-1);

        uint256 ts = block.timestamp;
        vm.warp(block.timestamp + 365 days);

        // The net amount of base interest for Alice is the first day's interest, compounded for another 729 days
        // There are very insignificant rounding diffs if we were to compound in steps
        //  - eg: 1 day => 364 days => 365 days (net 730 days)
        uint256 compoundedAliceBase = CompoundedInterest.continuouslyCompounded(one_pct_1day, 729 days, uint96(defaultBaseInterest));
        // Since alice was checkpoint setRiskPremiumInterestRate, we need to then compound at the new rate for another yr.
        uint256 compoundedAliceDebtorInterest = (
            CompoundedInterest.continuouslyCompounded(aliceExpected.debtorInterestOnly + amount, 365 days, uint96(updatedRate)) -
            amount
        );

        // Similarly for precision, we need to compound Bob in one hit.
        uint256 compoundedBobBase = CompoundedInterest.continuouslyCompounded(amount, 729 days, uint96(defaultBaseInterest));
        uint256 compoundedBobDebtorInterest = (
            CompoundedInterest.continuouslyCompounded(amount, 729 days, uint96(bobInterestRate)) -
            amount
        );

        checkBaseInterest(
            defaultBaseInterest, 
            aliceExpected.baseShares + bobExpected.baseShares, 
            one_pct_1day + amount, 
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

        uint256 bobExpectedShares = second_day_shares;

        // Bob's interest compounds in one hit as there was no checkpoint.
        uint256 compoundedBobBase = CompoundedInterest.continuouslyCompounded(amount, 729 days, uint96(defaultBaseInterest));
        uint256 compoundedBobDebtorInterest = (
            CompoundedInterest.continuouslyCompounded(amount, 729 days, uint96(bobInterestRate)) -
            amount
        );

        changePrank(executor);
        dUSD.burnAll(alice);
        checkBaseInterest(defaultBaseInterest, bobExpectedShares, compoundedBobBase, block.timestamp, compoundedBobBase, amount, 0);
        checkDebtor(alice, 0.1e18, 0, 0, 0, block.timestamp, 0);
        checkDebtor(bob, bobInterestRate, amount, bobExpectedShares, 0, startBlockTs + 1 days, compoundedBobBase + compoundedBobDebtorInterest);

        dUSD.burnAll(bob);
        checkBaseInterest(defaultBaseInterest, 0, 0, block.timestamp, 0, 0, 0);
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
            /*base total*/      one_pct_365day_rounding,
            /*debtor int only*/ two_pct_365day - amount
        );
        Expected memory bobExpected = makeExpected(
            /*shares*/          second_day_shares,
            /*base total*/      one_pct_364day,
            /*debtor int only*/ five_pct_364day - amount
        );

        checkBaseInterest(defaultBaseInterest, aliceExpected.baseShares+bobExpected.baseShares, one_pct_1day + amount, startBlockTs + 1 days, aliceExpected.baseTotal+bobExpected.baseTotal, 2*amount, 0);
        checkDebtor(alice, aliceInterestRate, amount, aliceExpected.baseShares, 0, startBlockTs, aliceExpected.balanceOf);
        checkDebtor(bob, bobInterestRate, amount, bobExpected.baseShares, 0, startBlockTs + 1 days, bobExpected.balanceOf-1); // balanceOf rounded down

        address[] memory ds = new address[](2);
        ds[0] = alice;
        ds[1] = bob;
        dUSD.checkpointDebtorsInterest(ds);

        checkBaseInterest(
            defaultBaseInterest, aliceExpected.baseShares + bobExpected.baseShares, 
            one_pct_1day + amount, startBlockTs + 1 days, 
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

        uint256 compoundedAliceBase = CompoundedInterest.continuouslyCompounded(one_pct_1day, 729 days, uint96(defaultBaseInterest));

        (uint256 principal, uint256 baseInterest, uint256 riskPremiumInterest) = dUSD.currentDebtOf(alice);
        assertEq(principal, amount);
        assertEq(baseInterest, compoundedAliceBase-amount);
        assertEq(riskPremiumInterest, ten_pct_365day_1-amount);
        assertEq(dUSD.balanceOf(alice), principal+baseInterest+riskPremiumInterest);

        uint256 compoundedBobBase = CompoundedInterest.continuouslyCompounded(amount, 729 days, uint96(defaultBaseInterest));
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

        checkBaseInterest(defaultBaseInterest, amount, amount, block.timestamp, amount, amount, 0);
        checkDebtor(account, aliceInterestRate, amount, amount, 0, block.timestamp, amount);
        assertEq(dUSD.totalSupply(), amount);

        vm.warp(block.timestamp + timeGap);

        uint256 expectedTotalBalance = (
            CompoundedInterest.continuouslyCompounded(amount, timeGap, uint96(defaultBaseInterest)) +
            CompoundedInterest.continuouslyCompounded(amount, timeGap, uint96(aliceInterestRate)) - amount
        );

        uint256 balance = dUSD.balanceOf(account);
        assertEq(balance, expectedTotalBalance);

        dUSD.burn(account, balance, false);

        checkBaseInterest(defaultBaseInterest, 0, 0, block.timestamp, 0, 0, 0);
        checkDebtor(account, aliceInterestRate, 0, 0, 0, block.timestamp, 0);
        assertEq(dUSD.totalSupply(), 0);
    }
}