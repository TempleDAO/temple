pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TempleTest } from "../../TempleTest.sol";
import { ITempleDebtToken, TempleDebtToken } from "contracts/v2/TempleDebtToken.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";
import { console2 } from "forge-std/Test.sol";

/* solhint-disable func-name-mixedcase, contract-name-camelcase, not-rely-on-time */
contract TempleDebtTokenTestBase is TempleTest {
    bool public constant LOG = false;

    TempleDebtToken public dUSD;
    uint96 public constant DEFAULT_BASE_INTEREST = 0.01e18;

    // Continuously compounding rates based on 100e18;
    uint256 public constant ONE_PCT_1DAY = 100002739763558233400;
    uint256 public constant ONE_PCT_2DAY = 100005479602179510350;
    uint256 public constant ONE_PCT_364DAY = 101002249485592403300;
    uint256 public constant ONE_PCT_365DAY = 101005016708416805700;
    
    // The net amount of base interest for 365 days, done in two steps (1 day, then 364 days)
    // There are very insignificant rounding diffs compared to doing it in one go as above
    uint256 public constant ONE_PCT_365DAY_ROUNDING = 101005016708416805542;

    uint256 public constant TWO_PCT_1DAY = 100005479602179510500;
    uint256 public constant TWO_PCT_2DAY = 100010959504619421600;
    uint256 public constant TWO_PCT_365DAY = 102020134002675580900;
    uint256 public constant FIVE_PCT_1DAY = 100013699568442168900;
    uint256 public constant FIVE_PCT_364DAY = 105112709650002483400;
    uint256 public constant FIVE_PCT_365DAY = 105127109637602403900;
    uint256 public constant FIVE_PCT_729DAY = 110501953516812792800;

    // 10% 365 day cont. compounded interest on `ONE_PCT_365DAY_ROUNDING`
    uint256 public constant TEN_PCT_365DAY_1 = 112749685157937566936;

    // A second minter a day later gets slightly less shares (since the first minter accrued a day of extra debt already)
    uint256 public constant SECOND_DAY_SHARES = 99997260311502753656;

    event BaseInterestRateSet(uint256 rate);
    event RiskPremiumInterestRateSet(address indexed debtor, uint256 rate);
    event AddedMinter(address indexed account);
    event RemovedMinter(address indexed account);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event DebtorBalance(address indexed debtor, uint128 principal, uint128 baseInterest, uint128 riskPremiumInterest);

    // Used for testing to avoid stack too deep
    struct Expected {
        uint256 baseShares;
        uint256 baseTotal;
        uint256 debtorInterestOnly;
        uint256 balanceOf;
    }

    function _setUp() internal {
        dUSD = new TempleDebtToken("Temple Debt", "dUSD", rescuer, executor, DEFAULT_BASE_INTEREST);
        vm.prank(executor);
        dUSD.addMinter(executor);
    }

    function setBaseInterest(uint96 r) internal {
        vm.prank(executor);
        dUSD.setBaseInterestRate(r);
    }

    /* solhint-disable no-console */
    function dumpBase() internal view {
        console2.log("BASE block.timestamp:", block.timestamp);

        console2.log("rate:", dUSD.baseRate());
        console2.log("shares:", dUSD.baseShares());
        console2.log("checkpoint:", dUSD.baseCheckpoint());
        console2.log("checkpointTime:", dUSD.baseCheckpointTime());
        ITempleDebtToken.DebtOwed memory debtOwed = dUSD.currentTotalDebt();
        console2.log("totalPrincipal:", debtOwed.principal);
        console2.log("baseInterest:", debtOwed.baseInterest);
        console2.log("principalAndBaseInterest:", debtOwed.principal+debtOwed.baseInterest);
        console2.log("estimatedDebtorInterest:", debtOwed.riskPremiumInterest);
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
    /* solhint-enable no-console */

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

        assertEq(dUSD.baseRate(), expectedInterestRateBps, "baseRate");
        assertEq(dUSD.baseShares(), expectedBaseShares, "baseShares");
        assertEq(dUSD.baseCheckpoint(), expectedBaseCheckpoint, "baseCheckpoint");
        assertEq(dUSD.baseCheckpointTime(), expectedBaseCheckpointTime, "baseCheckpointTime");

        ITempleDebtToken.DebtOwed memory debtOwed = dUSD.currentTotalDebt();
        assertEq(debtOwed.principal+debtOwed.baseInterest, expectedCurrentBasePrincipalAndInterest, "PrincipalAndInterest");
        assertEq(debtOwed.riskPremiumInterest, expectedCurrentEstimatedDebtorInterest, "estimatedDebtorInterest");
        assertEq(debtOwed.principal, expectedTotalPrincipal, "totalPrincipal");
        assertEq(dUSD.totalPrincipal(), debtOwed.principal, "totalPrincipal 2");
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
        assertEq(rate, expectedInterestRateBps, "rate");
        assertEq(principal, expectedPrincipal, "principal");
        assertEq(baseShares, expectedBaseInterestShares, "baseShares");
        assertEq(checkpoint, expectedCheckpoint, "checkpoint");
        assertEq(checkpointTime, expectedCheckpointTime, "checkpointTime");

        assertEq(dUSD.balanceOf(debtor), expectedBalancedOf, "dusd balance");
    }

    function makeExpected(
        uint256 baseShares, 
        uint256 baseTotal, 
        uint256 debtorInterestOnly,
        bool roundUp
    ) internal pure returns (Expected memory) {
        return Expected({
            baseShares: baseShares,
            baseTotal: baseTotal,
            debtorInterestOnly: debtorInterestOnly,
            balanceOf: baseTotal + debtorInterestOnly + (roundUp ? 1 : 0)
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
        dUSD.burn(alice, 100);
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

contract TempleDebtTokenTestZeroInterest is TempleDebtTokenTestBase {
    uint96 internal constant ZERO_INTEREST = 0;

    function setUp() public {
        dUSD = new TempleDebtToken("Temple Debt", "dUSD", rescuer, executor, ZERO_INTEREST);
        vm.prank(executor);
        dUSD.addMinter(executor);
    }

    function test_mint_aliceAndBob_inDifferentBlock() public {
        vm.startPrank(executor);
        uint256 amount = 100e18;
        dUSD.mint(alice, amount);

        // Bob borrows 1 day later
        uint256 blockTs = block.timestamp;
        vm.warp(blockTs + 1 days);
        dUSD.mint(bob, amount);

        // Just the amounts given zero interest
        checkBaseInterest(ZERO_INTEREST, 2*amount, 2*amount, block.timestamp, 2*amount, 2*amount, 0);
        checkDebtor(alice, 0, amount, amount, 0, blockTs, amount);
        checkDebtor(bob, 0, amount, amount, 0, block.timestamp, amount);

        vm.warp(block.timestamp + 364 days);
        dUSD.checkpointBaseInterest();
        dUSD.checkpointDebtorInterest(alice);
        dUSD.checkpointDebtorInterest(bob);

        // Just the amounts given zero interest
        checkBaseInterest(ZERO_INTEREST, 2*amount, 2*amount, block.timestamp, 2*amount, 2*amount, 0);
        checkDebtor(alice, 0, amount, amount, 0, block.timestamp, amount);
        checkDebtor(bob, 0, amount, amount, 0, block.timestamp, amount);
    }
}
