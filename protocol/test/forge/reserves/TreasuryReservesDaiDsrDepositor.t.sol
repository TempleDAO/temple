pragma solidity 0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later

import {TempleTest, IRecoverToken} from "../TempleTest.sol";
import {TreasuryReservesDaiDsrDepositor} from "contracts/reserves/TreasuryReservesDaiDsrDepositor.sol";
import {IMakerDaoDaiJoinLike} from "contracts/interfaces/makerDao/IMakerDaoDaiJoinLike.sol";
import {IMakerDaoPotLike} from "contracts/interfaces/makerDao/IMakerDaoPotLike.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TreasuryReservesDaiDsrDepositorTestBase is TempleTest {
    TreasuryReservesDaiDsrDepositor public depositor;

    IERC20 public dai = IERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);
    IMakerDaoDaiJoinLike public daiJoin = IMakerDaoDaiJoinLike(0x9759A6Ac90977b93B58547b4A71c78317f391A28);
    IMakerDaoPotLike public pot = IMakerDaoPotLike(0x197E90f9FAD81970bA7976f33CbD77088E5D7cf7);

    uint256 public depositThreshold = 10 ether;
    uint256 public withdrawalThreshold = 15 ether;

    function setUp() public {
        fork("mainnet", 16675385);
        depositor = new TreasuryReservesDaiDsrDepositor(address(daiJoin), address(pot), depositThreshold, withdrawalThreshold);
        depositor.addOperator(operator);
    }
}

contract TreasuryReservesDaiDsrDepositorTestAdmin is TreasuryReservesDaiDsrDepositorTestBase {

    // From TreasuryReservesDaiDsrDepositor
    event ThresholdsSet(uint256 depositThreshold, uint256 withdrawalThreshold);

    function test_initialize() public {
        assertEq(depositor.owner(), address(this));
        assertEq(address(depositor.dai()), daiJoin.dai());
        assertEq(address(depositor.pot()), address(pot));
        assertEq(dai.allowance(address(depositor), address(daiJoin)), type(uint256).max);
        assertEq(depositor.approxBalance(), 0);
        assertEq(depositor.depositToken(), address(dai));
    }

    function test_addOperator_onlyOwner() public {
        expectOnlyOwner();
        depositor.addOperator(alice);
    }

    function test_removeOperator_onlyOwner() public {
        expectOnlyOwner();
        depositor.removeOperator(alice);
    }

    function test_setThresholds_onlyOwner() public {
        expectOnlyOwner();
        depositor.setThresholds(5 ether, 5 ether);
    }

    function test_recoverToken_onlyOwner() public {
        expectOnlyOwner();
        depositor.recoverToken(address(dai), alice, 0);
    }

    function test_applyDeposits_onlyOperators() public {
        expectOnlyOperators();
        depositor.applyDeposits();
    }

    function test_withdraw_onlyOperators() public {
        expectOnlyOperators();
        depositor.withdraw(0, alice);
    }

    function test_withdrawAll_onlyOperators() public {
        expectOnlyOperators();
        depositor.withdrawAll(alice);
    }

    function test_addAndRemoveOperator() public {
        check_addAndRemoveOperator(depositor);
    }

    function test_recoverToken() public {
        check_recoverToken(IRecoverToken(address(depositor)));
    }

    function test_setThresholds() public {
        assertEq(depositor.depositThreshold(), depositThreshold);
        assertEq(depositor.withdrawalThreshold(), withdrawalThreshold);

        vm.expectEmit(true, true, true, true);
        emit ThresholdsSet(5 ether, 2 ether);

        depositor.setThresholds(5 ether, 2 ether);
        assertEq(depositor.depositThreshold(), 5 ether);
        assertEq(depositor.withdrawalThreshold(), 2 ether);
    }
}

contract TreasuryReservesDaiDsrDepositorTestDeposits is TreasuryReservesDaiDsrDepositorTestBase {
    // From TreasuryReservesDaiDsrDepositor
    event Deposited(address indexed token, uint256 amount);
    event Withdrawn(address indexed token, uint256 amount, address indexed receiver);

    function test_applyDeposits_underThreshold() public {
        vm.startPrank(operator);

        vm.expectRevert(abi.encodeWithSelector(TreasuryReservesDaiDsrDepositor.ExpectedNonZero.selector));
        depositor.applyDeposits();

        uint256 amount = 5 ether;
        deal(address(dai), address(depositor), amount, true);

        uint256 amountOut = depositor.applyDeposits();
        assertEq(amountOut, amount, "outAmount");
        assertEq(dai.balanceOf(address(depositor)), amount);
        assertEq(pot.pie(address(depositor)), 0);

        // Exact amount
        assertEq(depositor.approxBalance(), amountOut);
    }

    function test_applyDeposits_overThreshold() public {
        vm.startPrank(operator);

        uint256 amount = 100 ether;
        deal(address(dai), address(depositor), amount, true);

        vm.expectEmit(true, true, true, true);
        emit Deposited(address(dai), amount);
        uint256 amountOut = depositor.applyDeposits();
        assertEq(amountOut, amount, "outAmount");
        assertEq(dai.balanceOf(address(depositor)), 0);

        // Slight rounding
        assertApproxEqAbs(depositor.approxBalance(), amountOut, 1);
    }

    function test_applyDeposits_multiple() public {
        vm.startPrank(operator);

        // Under threshold
        {
            uint256 amount = 5 ether;
            deal(address(dai), address(depositor), amount, true);
            uint256 amountOut = depositor.applyDeposits();

            assertEq(amountOut, amount, "outAmount");
            assertEq(dai.balanceOf(address(depositor)), amount);
            assertEq(pot.pie(address(depositor)), 0);
            assertEq(depositor.approxBalance(), amountOut);
        }
        
        // Over threshold
        {
            uint256 amount = 10 ether;
            deal(address(dai), address(depositor), amount, true);
            uint256 amountOut = depositor.applyDeposits();

            assertEq(amountOut, amount, "outAmount");
            assertEq(dai.balanceOf(address(depositor)), 0);
            assertGt(pot.pie(address(depositor)), 0);
            assertApproxEqAbs(depositor.approxBalance(), amount, 1);
        }

        // Exact amount
        {
            uint256 amount = 5 ether;
            deal(address(dai), address(depositor), amount, true);
            uint256 amountOut = depositor.applyDeposits();

            assertEq(amountOut, amount, "outAmount");
            assertEq(dai.balanceOf(address(depositor)), amount);
            assertGt(pot.pie(address(depositor)), 0);
            assertApproxEqAbs(depositor.approxBalance(), 15 ether, 1);
        }
    }    

    function test_withdraw_balanceOnly() public {
        vm.startPrank(operator);

        vm.expectRevert(abi.encodeWithSelector(TreasuryReservesDaiDsrDepositor.ExpectedNonZero.selector));
        depositor.withdraw(0, alice);

        deal(address(dai), address(depositor), 100 ether, true);

        uint256 withdrawAmount = 25 ether;
        vm.expectEmit(true, true, true, true);
        emit Withdrawn(address(dai), withdrawAmount, alice);

        uint256 amountOut = depositor.withdraw(withdrawAmount, alice);

        assertEq(amountOut, withdrawAmount);
        assertEq(dai.balanceOf(alice), withdrawAmount);
        assertEq(dai.balanceOf(address(depositor)), 75 ether);
        assertEq(depositor.approxBalance(), 75 ether);
    }

    uint256 public constant RAY = 10 ** 27;
    function calcDsrShares(uint256 daiAmount) internal returns (uint256) {
        uint256 chi = (block.timestamp > pot.rho()) ? pot.drip() : pot.chi();
        // Match rdivup from Maker
        return ((daiAmount * RAY) + (chi - 1)) / chi;
    }

    function test_withdraw_dsrOnly() public {
        vm.startPrank(operator);

        uint256 amount = 100 ether;
        uint256 sharesToExit = calcDsrShares(amount);
        
        vm.expectRevert(abi.encodeWithSelector(TreasuryReservesDaiDsrDepositor.NotEnoughShares.selector, amount, sharesToExit, 0));
        depositor.withdraw(amount, alice);

        deal(address(dai), address(depositor), amount, true);
        depositor.applyDeposits();

        uint256 withdrawAmount = 50 ether;
        vm.expectEmit(true, true, true, true);
        emit Withdrawn(address(dai), withdrawAmount, alice);
        uint256 amountOut = depositor.withdraw(withdrawAmount, alice);

        assertEq(amountOut, withdrawAmount);
        assertEq(dai.balanceOf(alice), withdrawAmount);

        // Slight rounding
        assertApproxEqAbs(depositor.approxBalance(), 50 ether, 2);
        assertApproxEqAbs(depositor.exactBalance(), 50 ether, 2);
    }

    function test_withdraw_mixedBalanceAndDsr() public {
        vm.startPrank(operator);

        // Add 200 via DSR
        deal(address(dai), address(depositor), 200 ether, true);
        depositor.applyDeposits();

        // Add another 100 direct
        deal(address(dai), address(depositor), 100 ether, true);

        uint256 withdrawAmount = 250 ether;
        vm.expectEmit(true, true, true, true);
        emit Withdrawn(address(dai), withdrawAmount, alice);

        uint256 amountOut = depositor.withdraw(withdrawAmount, alice);

        assertEq(amountOut, withdrawAmount);
        assertEq(dai.balanceOf(alice), withdrawAmount);
        assertEq(dai.balanceOf(address(depositor)), 0);

        assertApproxEqAbs(depositor.approxBalance(), 50 ether, 2);
        assertApproxEqAbs(depositor.exactBalance(), 50 ether, 2);
    }

    function test_withdraw_underThreshold() public {
        vm.startPrank(operator);

        uint256 amount = 100 ether;
        deal(address(dai), address(depositor), amount, true);
        depositor.applyDeposits();

        uint256 amountOut = depositor.withdraw(10 ether, alice);

        assertEq(amountOut, 10 ether);
        assertEq(dai.balanceOf(alice), 10 ether);
        assertEq(dai.balanceOf(address(depositor)), 5 ether);
        assertApproxEqAbs(depositor.approxBalance(), 90 ether, 2);
        assertApproxEqAbs(depositor.exactBalance(), 90 ether, 2);
    }

    function test_withdraw_underThreshold_falback() public {
        vm.startPrank(operator);

        // The threshold is 15 ether. If only 12 is deposited then 
        // this will fallback
        uint256 amount = 12 ether;
        deal(address(dai), address(depositor), amount, true);
        depositor.applyDeposits();

        uint256 amountOut = depositor.withdraw(10 ether, alice);

        assertEq(amountOut, 10 ether);
        assertEq(dai.balanceOf(alice), 10 ether);
        assertEq(dai.balanceOf(address(depositor)), 0);
        assertApproxEqAbs(depositor.approxBalance(), 2 ether, 1);
    }

    function test_withdrawAll_balanceOnly() public {
        vm.startPrank(operator);

        vm.expectRevert(abi.encodeWithSelector(TreasuryReservesDaiDsrDepositor.ExpectedNonZero.selector));
        depositor.withdrawAll(alice);

        deal(address(dai), address(depositor), 100 ether, true);

        uint256 withdrawAmount = 100 ether;
        vm.expectEmit(true, true, true, true);
        emit Withdrawn(address(dai), withdrawAmount, alice);

        uint256 amountOut = depositor.withdrawAll(alice);

        assertEq(amountOut, withdrawAmount);
        assertEq(dai.balanceOf(alice), withdrawAmount);
        assertEq(dai.balanceOf(address(depositor)), 0);
        assertEq(depositor.approxBalance(), 0);
    }

    function test_withdrawAll_dsrOnly() public {
        vm.startPrank(operator);

        uint256 amount = 100 ether;
        deal(address(dai), address(depositor), amount, true);
        depositor.applyDeposits();

        uint256 expectedOut = amount-1; // Slight rounding when depositing in DSR
        vm.expectEmit(true, true, true, true);
        emit Withdrawn(address(dai), expectedOut, alice);
        uint256 amountOut = depositor.withdrawAll(alice);

        assertEq(amountOut, expectedOut);
        assertEq(dai.balanceOf(alice), expectedOut);
        assertEq(depositor.approxBalance(), 0);
    }

    function test_withdrawAll_mixedBalanceAndDsr() public {
        vm.startPrank(operator);

        // Add 200 via DSR
        deal(address(dai), address(depositor), 200 ether, true);
        depositor.applyDeposits();

        // Add another 100 direct
        deal(address(dai), address(depositor), 100 ether, true);
        
        uint256 expectedOut = 300 ether - 1; // Slight rounding when depositing in DSR
        vm.expectEmit(true, true, true, true);
        emit Withdrawn(address(dai), expectedOut, alice);
        uint256 amountOut = depositor.withdrawAll(alice);

        assertEq(amountOut, expectedOut);
        assertEq(dai.balanceOf(alice), expectedOut);
        assertEq(depositor.approxBalance(), 0);
    }

    function test_earning() public {
        vm.startPrank(operator);

        uint256 amount = 100 ether;
        deal(address(dai), address(depositor), amount, true);
        depositor.applyDeposits();

        uint256 balBefore = depositor.approxBalance();

        // Move forward and checkpoint increase.
        vm.warp(block.timestamp + 10 days);
        pot.drip();

        // Make sure it has increased
        uint256 balAfter = depositor.approxBalance();
        assertGt(balAfter, balBefore);
        assertGt(balAfter, amount);

        uint256 withdrawn = depositor.withdrawAll(alice);
        assertEq(withdrawn, balAfter);
        assertEq(dai.balanceOf(alice), withdrawn);
        assertEq(depositor.approxBalance(), 0);
    }

    function test_approxVsExactBalance() public {
        vm.startPrank(operator);
        uint256 amount = 100 ether;
        deal(address(dai), address(depositor), amount, true);
        depositor.applyDeposits();

        assertApproxEqAbs(depositor.approxBalance(), amount, 1);
        assertApproxEqAbs(depositor.exactBalance(), amount, 1);

        // After a warp - the approx balance doesn't update as
        // its not checkpointed
        vm.warp(block.timestamp + 10 days);
        uint256 approxBal = depositor.approxBalance();
        assertApproxEqAbs(approxBal, amount, 1);
        assertGt(depositor.exactBalance(), approxBal);

        // The same after a checkpoint
        pot.drip();
        approxBal = depositor.approxBalance();
        assertEq(depositor.exactBalance(), approxBal);
    }

}