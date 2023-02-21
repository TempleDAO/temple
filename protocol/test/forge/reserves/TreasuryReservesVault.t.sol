pragma solidity 0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later

import {TempleTest, IRecoverToken} from "../TempleTest.sol";
import {ITreasuryReservesDepositor} from "contracts/interfaces/reserves/ITreasuryReservesDepositor.sol";
import {TreasuryReservesDaiDsrDepositor} from "contracts/reserves/TreasuryReservesDaiDsrDepositor.sol";
import {TreasuryReservesVault} from "contracts/reserves/TreasuryReservesVault.sol";
import {ITreasuryReservesVault} from "contracts/interfaces/reserves/ITreasuryReservesVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TreasuryReservesVaultTestBase is TempleTest {
    TreasuryReservesDaiDsrDepositor public daiDepositor;
    TreasuryReservesVault public vault;

    address public dai = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
    address public bob = makeAddr("bob");

    function setUp() public {
        fork("mainnet", 16675385);
        vault = new TreasuryReservesVault();

        // A high threshold so it just stays as a balance, not in DSR
        uint256 depositThreshold = 100_000 ether; 
        uint256 withdrawalThreshold = 100_000 ether; 
        address daiJoin = 0x9759A6Ac90977b93B58547b4A71c78317f391A28;
        address pot = 0x197E90f9FAD81970bA7976f33CbD77088E5D7cf7;

        daiDepositor = new TreasuryReservesDaiDsrDepositor(daiJoin, pot, depositThreshold, withdrawalThreshold);
        daiDepositor.addOperator(address(vault));
    }

    function checkTokenPosition(ITreasuryReservesVault.TokenPosition memory actual, ITreasuryReservesVault.TokenPosition memory expected) public {
        assertEq(actual.areDepositsEnabled, expected.areDepositsEnabled);
        assertEq(actual.depositCap, expected.depositCap);
        assertEq(actual.areWithdrawalsEnabled, expected.areWithdrawalsEnabled);
        assertEq(actual.withdrawalCap, expected.withdrawalCap);
        assertEq(address(actual.depositor), address(expected.depositor));
        assertEq(actual.balance, expected.balance);
    }

    function checkAccountPosition(ITreasuryReservesVault.AccountPosition memory actual, ITreasuryReservesVault.AccountPosition memory expected) public {
        assertEq(actual.areDepositsEnabled, expected.areDepositsEnabled);
        assertEq(actual.depositCap, expected.depositCap);
        assertEq(actual.areWithdrawalsEnabled, expected.areWithdrawalsEnabled);
        assertEq(actual.withdrawalCap, expected.withdrawalCap);
        assertEq(actual.balance, expected.balance);
    }
}

contract TreasuryReservesVaultTestAdmin is TreasuryReservesVaultTestBase {
    // From TreasuryReservesVault
    event TokenPositionDetailsSet(address indexed token, ITreasuryReservesVault.TokenPosition updatedTokenPosition);
    event AccountPositionDetailsSet(address indexed account, address indexed token, ITreasuryReservesVault.AccountPosition updatedAccountPosition);

    event TokenPositionBalanceSet(address indexed token, int256 oldBalance, int256 newBalance);
    event AccountPositionBalanceSet(address indexed account, address indexed token, int256 oldBalance, int256 newBalance);

    function test_initialize() public {
        assertEq(vault.owner(), address(this));
    }

    function test_setTokenPositionDetails_onlyOwner() public {
        expectOnlyOwner();
        vault.setTokenPositionDetails(dai, true, 100 ether, false, 200 ether, address(daiDepositor));
    }

    function test_setAccountPositionDetails_onlyOwner() public {
        expectOnlyOwner();
        vault.setAccountPositionDetails(alice, dai, true, 100 ether, true, 100 ether);
    }

    function test_setTokenPositionBalance_onlyOwner() public {
        expectOnlyOwner();
        vault.setTokenPositionBalance(dai, 100);
    }

    function test_setAccountPositionBalance_onlyOwner() public {
        expectOnlyOwner();
        vault.setAccountPositionBalance(alice, dai, 100);
    }
    
    function test_recoverToken_onlyOwner() public {
        expectOnlyOwner();
        vault.recoverToken(dai, alice, 0);
    }

    function test_recoverToken() public {
        check_recoverToken(IRecoverToken(address(vault)));
    }

    function test_setTokenPositionDetails() public {
        // Nothing by default
        ITreasuryReservesVault.TokenPosition memory expected = ITreasuryReservesVault.TokenPosition(
            false, 0, false, 0, ITreasuryReservesDepositor(address(0)), 0
        );
        checkTokenPosition(vault.tokenPositions(dai), expected);

        // Fail with 0x depositor
        vm.expectRevert(abi.encodeWithSelector(TreasuryReservesVault.InvalidAddress.selector, address(0)));
        vault.setTokenPositionDetails(dai, true, 100 ether, false, 200 ether, address(0));

        // Works
        vm.expectEmit(true, false, false, false);
        emit TokenPositionDetailsSet(dai, expected); // note position here isn't checked.
        vault.setTokenPositionDetails(dai, true, 100 ether, false, 200 ether, address(daiDepositor));

        // Matches
        expected = ITreasuryReservesVault.TokenPosition(
            true, 100 ether, false, 200 ether, daiDepositor, 0
        );
        checkTokenPosition(vault.tokenPositions(dai), expected);
    }

    function test_setAccountPositionDetails() public {
        // Nothing by default
        ITreasuryReservesVault.AccountPosition memory expected = ITreasuryReservesVault.AccountPosition(
            false, 0, false, 0, 0
        );
        checkAccountPosition(vault.accountPositions(alice, dai), expected);

        // Works
        vm.expectEmit(true, true, false, false);
        emit AccountPositionDetailsSet(alice, dai, expected); // note position here isn't checked.
        vault.setAccountPositionDetails(alice, dai, true, 100 ether, false, 200 ether);

        // Matches
        expected = ITreasuryReservesVault.AccountPosition(
            true, 100 ether, false, 200 ether, 0
        );
        checkAccountPosition(vault.accountPositions(alice, dai), expected);
    }

    function test_setTokenPositionBalance() public {
        vault.setTokenPositionDetails(dai, true, 50 ether, false, 0, address(daiDepositor));

        vm.expectEmit(true, true, true, true);
        emit TokenPositionBalanceSet(dai, 0, 100 ether);
        vault.setTokenPositionBalance(dai, 100 ether);

        ITreasuryReservesVault.TokenPosition memory expected = ITreasuryReservesVault.TokenPosition(
            true, 50 ether, false, 0 ether, daiDepositor, 100 ether
        );
        checkTokenPosition(vault.tokenPositions(dai), expected);
    }

    function test_setAccountPositionBalance() public {
        vault.setAccountPositionDetails(alice, dai, true, 50 ether, false, 0);

        vm.expectEmit(true, true, true, true);
        emit AccountPositionBalanceSet(alice, dai, 0, 100 ether);
        vault.setAccountPositionBalance(alice, dai, 100 ether);

        ITreasuryReservesVault.AccountPosition memory expected = ITreasuryReservesVault.AccountPosition(
            true, 50 ether, false, 0 ether, 100 ether
        );
        checkAccountPosition(vault.accountPositions(alice, dai), expected);
    }

}

contract TreasuryReservesVaultTestDeposits is TreasuryReservesVaultTestBase {
    event ReservesDeposited(address indexed account, address indexed token, uint256 amount);

    function test_deposit_errorChecks() public {
        vm.startPrank(alice);

        // 0 amount
        vm.expectRevert(abi.encodeWithSelector(TreasuryReservesVault.ExpectedNonZero.selector));
        vault.deposit(dai, 0);

        // No definition for DAI
        vm.expectRevert(abi.encodeWithSelector(TreasuryReservesVault.NotEnabled.selector, address(0), dai));
        vault.deposit(dai, 100);

        // Now enable the token, but small token level deposit cap
        vm.stopPrank();
        vault.setTokenPositionDetails(dai, true, 50 ether, false, 0, address(daiDepositor));
        vm.startPrank(alice);

        // Token level cap breached
        vm.expectRevert(abi.encodeWithSelector(TreasuryReservesVault.DepositCapBreached.selector, address(0), dai, 50 ether, 0, 100 ether));
        vault.deposit(dai, 100 ether);

        // No definition for Alice
        vm.expectRevert(abi.encodeWithSelector(TreasuryReservesVault.NotEnabled.selector, alice, dai));
        vault.deposit(dai, 100);

        // Now enable Alice's account for DAI, but small token level deposit cap
        vm.stopPrank();
        vault.setAccountPositionDetails(alice, dai, true, 20 ether, false, 0);
        vm.startPrank(alice);

        // Account level cap breached
        vm.expectRevert(abi.encodeWithSelector(TreasuryReservesVault.DepositCapBreached.selector, alice, dai, 20 ether, 0, 30 ether));
        vault.deposit(dai, 30 ether);

        // Now it all works
        deal(address(dai), alice, 20 ether, true);
        IERC20(dai).approve(address(vault), 20 ether);

        vm.expectEmit(true, true, true, true);
        emit ReservesDeposited(alice, dai, 20 ether);
        vault.deposit(dai, 20 ether);

        // Success
        assertEq(daiDepositor.approxBalance(), 20 ether);

        // Check balances are updated
        ITreasuryReservesVault.TokenPosition memory expectedTokenPosition = ITreasuryReservesVault.TokenPosition(
            true, 50 ether, false, 0, daiDepositor, 20 ether
        );
        checkTokenPosition(vault.tokenPositions(dai), expectedTokenPosition);

        ITreasuryReservesVault.AccountPosition memory expected = ITreasuryReservesVault.AccountPosition(
            true, 20 ether, false, 0, 20 ether
        );
        checkAccountPosition(vault.accountPositions(alice, dai), expected);
    }

    function test_deposit_multiTokenCapBreached() public {
        vault.setTokenPositionDetails(dai, true, 50 ether, false, 0, address(daiDepositor));
        vault.setAccountPositionDetails(alice, dai, true, 200 ether, false, 0);

        deal(address(dai), alice, 200 ether, true);

        vm.startPrank(alice);
        IERC20(dai).approve(address(vault), 200 ether);

        // Works up to and including the cap
        vault.deposit(dai, 20 ether);
        vault.deposit(dai, 30 ether);

        // Fails
        vm.expectRevert(abi.encodeWithSelector(TreasuryReservesVault.DepositCapBreached.selector, address(0), dai, 50 ether, 50 ether, 1));
        vault.deposit(dai, 1);

        // Check positions
        assertEq(daiDepositor.approxBalance(), 50 ether);

        ITreasuryReservesVault.TokenPosition memory expectedTokenPosition = ITreasuryReservesVault.TokenPosition(
            true, 50 ether, false, 0, daiDepositor, 50 ether
        );
        checkTokenPosition(vault.tokenPositions(dai), expectedTokenPosition);

        ITreasuryReservesVault.AccountPosition memory expected = ITreasuryReservesVault.AccountPosition(
            true, 200 ether, false, 0, 50 ether
        );
        checkAccountPosition(vault.accountPositions(alice, dai), expected);
    }

    function test_deposit_multiAccountCapBreached() public {
        vault.setTokenPositionDetails(dai, true, 200 ether, false, 0, address(daiDepositor));
        vault.setAccountPositionDetails(alice, dai, true, 50 ether, false, 0);

        deal(address(dai), alice, 200 ether, true);

        vm.startPrank(alice);
        IERC20(dai).approve(address(vault), 200 ether);

        // Works up to and including the cap
        vault.deposit(dai, 20 ether);
        vault.deposit(dai, 30 ether);

        // Fails
        vm.expectRevert(abi.encodeWithSelector(TreasuryReservesVault.DepositCapBreached.selector, alice, dai, 50 ether, 50 ether, 1));
        vault.deposit(dai, 1);

        // Check positions
        assertEq(daiDepositor.approxBalance(), 50 ether);

        ITreasuryReservesVault.TokenPosition memory expectedTokenPosition = ITreasuryReservesVault.TokenPosition(
            true, 200 ether, false, 0, daiDepositor, 50 ether
        );
        checkTokenPosition(vault.tokenPositions(dai), expectedTokenPosition);

        ITreasuryReservesVault.AccountPosition memory expected = ITreasuryReservesVault.AccountPosition(
            true, 50 ether, false, 0, 50 ether
        );
        checkAccountPosition(vault.accountPositions(alice, dai), expected);
    }
}

contract TreasuryReservesVaultTestWithdrawals is TreasuryReservesVaultTestBase {
    event ReservesWithdrawn(address indexed account, address indexed token, uint256 amount, address indexed receiver);

    function test_withdraw_errorChecks() public {
        vm.startPrank(alice);

        // 0 amount
        vm.expectRevert(abi.encodeWithSelector(TreasuryReservesVault.ExpectedNonZero.selector));
        vault.withdraw(dai, 0, bob);

        // No definition for DAI
        vm.expectRevert(abi.encodeWithSelector(TreasuryReservesVault.NotEnabled.selector, address(0), dai));
        vault.withdraw(dai, 100, bob);

        // Now enable the token, but small token level deposit cap
        vm.stopPrank();
        vault.setTokenPositionDetails(dai, false, 0, true, 50 ether, address(daiDepositor));
        vm.startPrank(alice);

        // Token level cap breached
        vm.expectRevert(abi.encodeWithSelector(TreasuryReservesVault.WithdrawalCapBreached.selector, address(0), dai, 50 ether, 0, 100 ether));
        vault.withdraw(dai, 100 ether, bob);

        // No definition for Alice
        vm.expectRevert(abi.encodeWithSelector(TreasuryReservesVault.NotEnabled.selector, alice, dai));
        vault.withdraw(dai, 100, bob);

        // Now enable Alice's account for DAI, but small token level deposit cap
        vm.stopPrank();
        vault.setAccountPositionDetails(alice, dai, false, 0, true, 20 ether);
        vm.startPrank(alice);

        // Account level cap breached
        vm.expectRevert(abi.encodeWithSelector(TreasuryReservesVault.WithdrawalCapBreached.selector, alice, dai, 20 ether, 0, 30 ether));
        vault.withdraw(dai, 30 ether, bob);

        // Now it all works
        deal(dai, address(daiDepositor), 20 ether, true);

        vm.expectEmit(true, true, true, true);
        emit ReservesWithdrawn(alice, dai, 20 ether, bob);
        vault.withdraw(dai, 20 ether, bob);

        // Success
        assertEq(daiDepositor.approxBalance(), 0 ether);
        assertEq(IERC20(dai).balanceOf(bob), 20 ether);

        // Check balances are updated
        ITreasuryReservesVault.TokenPosition memory expectedTokenPosition = ITreasuryReservesVault.TokenPosition(
            false, 0, true, 50 ether, daiDepositor, -20 ether
        );
        checkTokenPosition(vault.tokenPositions(dai), expectedTokenPosition);

        ITreasuryReservesVault.AccountPosition memory expected = ITreasuryReservesVault.AccountPosition(
            false, 0, true, 20 ether, -20 ether
        );
        checkAccountPosition(vault.accountPositions(alice, dai), expected);
    }

    function test_withdraw_noFunds() public {
        vault.setTokenPositionDetails(dai, false, 0, true, 50 ether, address(daiDepositor));
        vault.setAccountPositionDetails(alice, dai, false, 0, true, 200 ether);

        deal(dai, address(daiDepositor), 50, true);

        vm.startPrank(alice);

        // Fails as there's not enough DSR shares held by dai depositor upstream in the DSR pot
        vm.expectRevert();
        vault.withdraw(dai, 100, bob);
    }

    function test_withdraw_multiTokenCapBreached() public {
        vault.setTokenPositionDetails(dai, false, 0, true, 50 ether, address(daiDepositor));
        vault.setAccountPositionDetails(alice, dai, false, 0, true, 200 ether);

        deal(address(dai), address(daiDepositor), 200 ether, true);

        vm.startPrank(alice);

        // Works up to and including the cap
        vault.withdraw(dai, 20 ether, bob);
        vault.withdraw(dai, 30 ether, bob);

        // Fails
        vm.expectRevert(abi.encodeWithSelector(TreasuryReservesVault.WithdrawalCapBreached.selector, address(0), dai, 50 ether, -50 ether, 1));
        vault.withdraw(dai, 1, bob);

        // Check positions
        assertEq(daiDepositor.approxBalance(), 150 ether);
        assertEq(IERC20(dai).balanceOf(bob), 50 ether);

        ITreasuryReservesVault.TokenPosition memory expectedTokenPosition = ITreasuryReservesVault.TokenPosition(
            false, 0, true, 50 ether, daiDepositor, -50 ether
        );
        checkTokenPosition(vault.tokenPositions(dai), expectedTokenPosition);

        ITreasuryReservesVault.AccountPosition memory expected = ITreasuryReservesVault.AccountPosition(
            false, 0, true, 200 ether, -50 ether
        );
        checkAccountPosition(vault.accountPositions(alice, dai), expected);
    }

    function test_withdraw_multiAccountCapBreached() public {
        vault.setTokenPositionDetails(dai, false, 0, true, 200 ether, address(daiDepositor));
        vault.setAccountPositionDetails(alice, dai, false, 0, true, 50 ether);

        deal(address(dai), address(daiDepositor), 200 ether, true);

        vm.startPrank(alice);

        // Works up to and including the cap
        vault.withdraw(dai, 20 ether, bob);
        vault.withdraw(dai, 30 ether, bob);

        // Fails
        vm.expectRevert(abi.encodeWithSelector(TreasuryReservesVault.WithdrawalCapBreached.selector, alice, dai, 50 ether, -50 ether, 1));
        vault.withdraw(dai, 1, bob);

        // Check positions
        assertEq(daiDepositor.approxBalance(), 150 ether);
        assertEq(IERC20(dai).balanceOf(bob), 50 ether);

        ITreasuryReservesVault.TokenPosition memory expectedTokenPosition = ITreasuryReservesVault.TokenPosition(
            false, 0, true, 200 ether, daiDepositor, -50 ether
        );
        checkTokenPosition(vault.tokenPositions(dai), expectedTokenPosition);

        ITreasuryReservesVault.AccountPosition memory expected = ITreasuryReservesVault.AccountPosition(
            false, 0, true, 50 ether, -50 ether
        );
        checkAccountPosition(vault.accountPositions(alice, dai), expected);
    }

    function test_depositAndWithdraw() public {
        vault.setTokenPositionDetails(dai, true, 10_000 ether, true, 10_000 ether, address(daiDepositor));
        vault.setAccountPositionDetails(alice, dai, true, 500 ether, true, 500 ether);
        vault.setAccountPositionDetails(bob, dai, true, 500 ether, true, 500 ether);

        deal(address(dai), alice, 500 ether, true);
        deal(address(dai), bob, 500 ether, true);
        deal(address(dai), address(daiDepositor), 500 ether, true);

        {
            vm.startPrank(alice);
            IERC20(dai).approve(address(vault), 10_000 ether);
            vault.deposit(dai, 20 ether);

            changePrank(bob);
            IERC20(dai).approve(address(vault), 10_000 ether);
            vault.withdraw(dai, 30 ether, bob);

            // Net 0
            checkTokenPosition(
                vault.tokenPositions(dai), 
                ITreasuryReservesVault.TokenPosition(true, 10_000 ether, true, 10_000 ether, daiDepositor, -10 ether)
            );
            checkAccountPosition(
                vault.accountPositions(alice, dai), 
                ITreasuryReservesVault.AccountPosition(true, 500 ether, true, 500 ether, 20 ether)
            );
            checkAccountPosition(
                vault.accountPositions(bob, dai), 
                ITreasuryReservesVault.AccountPosition(true, 500 ether, true, 500 ether, -30 ether)
            );
        }

        {
            changePrank(alice);
            vault.deposit(dai, 100 ether);

            changePrank(bob);
            vault.deposit(dai, 530 ether);

            checkTokenPosition(
                vault.tokenPositions(dai), 
                ITreasuryReservesVault.TokenPosition(true, 10_000 ether, true, 10_000 ether, daiDepositor, 620 ether)
            );
            checkAccountPosition(
                vault.accountPositions(alice, dai), 
                ITreasuryReservesVault.AccountPosition(true, 500 ether, true, 500 ether, 120 ether)
            );
            checkAccountPosition(
                vault.accountPositions(bob, dai), 
                ITreasuryReservesVault.AccountPosition(true, 500 ether, true, 500 ether, 500 ether)
            );
        }

        {
            changePrank(alice);
            vault.deposit(dai, 100 ether);

            // Fails for bob - at cap
            changePrank(bob);
            vm.expectRevert(abi.encodeWithSelector(TreasuryReservesVault.DepositCapBreached.selector, bob, dai, 500 ether, 500 ether, 1));
            vault.deposit(dai, 1);

            checkTokenPosition(
                vault.tokenPositions(dai), 
                ITreasuryReservesVault.TokenPosition(true, 10_000 ether, true, 10_000 ether, daiDepositor, 720 ether)
            );
            checkAccountPosition(
                vault.accountPositions(alice, dai), 
                ITreasuryReservesVault.AccountPosition(true, 500 ether, true, 500 ether, 220 ether)
            );
            checkAccountPosition(
                vault.accountPositions(bob, dai), 
                ITreasuryReservesVault.AccountPosition(true, 500 ether, true, 500 ether, 500 ether)
            );
        }

        {
            changePrank(alice);
            vault.deposit(dai, 100 ether);

            // Can still withdraw
            changePrank(bob);
            vault.withdraw(dai, 30 ether, bob);

            checkTokenPosition(
                vault.tokenPositions(dai), 
                ITreasuryReservesVault.TokenPosition(true, 10_000 ether, true, 10_000 ether, daiDepositor, 790 ether)
            );
            checkAccountPosition(
                vault.accountPositions(alice, dai), 
                ITreasuryReservesVault.AccountPosition(true, 500 ether, true, 500 ether, 320 ether)
            );
            checkAccountPosition(
                vault.accountPositions(bob, dai), 
                ITreasuryReservesVault.AccountPosition(true, 500 ether, true, 500 ether, 470 ether)
            );
        }

    }
}