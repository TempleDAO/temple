pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TlcBaseTest } from "./TlcBaseTest.t.sol";

contract TempleLineOfCreditTestCheckLiquidityDai is TlcBaseTest {
    function test_computeLiquidity_noBorrowsNoCollateral() external {
        checkLiquidationStatus(alice, true, false, 0, 0, 0);
        checkLiquidationStatus(alice, false, false, 0, 0, 0);
    }

    function test_computeLiquidity_noBorrowsWithCollateral() external {
        uint256 collateralAmount = 100_000;
        addCollateral(alice, collateralAmount);
        checkLiquidationStatus(alice, true, false, collateralAmount, 0, 0);
        checkLiquidationStatus(alice, false, false, collateralAmount, 0, 0);
    }

    function test_computeLiquidity_noBorrowsWithCollateralAndRemoveRequest() external {
        uint256 collateralAmount = 100_000;
        addCollateral(alice, collateralAmount);
        vm.prank(alice);
        tlc.requestRemoveCollateral(50_000);

        checkLiquidationStatus(alice, true, false, 50_000, 0, 0);
        checkLiquidationStatus(alice, false, false, collateralAmount, 0, 0);
    }

    function test_computeLiquidity_withBorrowRequestUnderMaxLTV() external {
        uint256 collateralAmount = 100_000;
        uint256 daiBorrowAmount = 20_000;

        addCollateral(alice, collateralAmount);
        vm.prank(alice);
        tlc.requestBorrow(daiToken, daiBorrowAmount);
        
        checkLiquidationStatus(alice, true, false, collateralAmount, daiBorrowAmount, 0);
        checkLiquidationStatus(alice, false, false, collateralAmount, 0, 0);
    }

    function test_computeLiquidity_withBorrowRequestAtMaxLTV() external {
        uint256 collateralAmount = 100_000;

        addCollateral(alice, collateralAmount);
        vm.prank(alice);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        uint256 daiBorrowAmount = maxBorrowInfo.daiMaxBorrow;
        tlc.requestBorrow(daiToken, daiBorrowAmount);

        checkLiquidationStatus(alice, true, false, collateralAmount, daiBorrowAmount, 0);
        checkLiquidationStatus(alice, false, false, collateralAmount, 0, 0);
    }

    function test_computeLiquidity_withBorrowRequestOverMaxLTV() external {
        uint256 collateralAmount = 100_000;

        addCollateral(alice, collateralAmount);
        vm.prank(alice);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        uint256 daiBorrowAmount = maxBorrowInfo.daiMaxBorrow;
        tlc.requestBorrow(daiToken, daiBorrowAmount);

        vm.prank(executor);
        tlc.setMaxLtvRatio(daiToken, 0.8e18);

        checkLiquidationStatus(alice, true, true, collateralAmount, daiBorrowAmount, 0);
        checkLiquidationStatus(alice, false, false, collateralAmount, 0, 0);
    }

    function test_computeLiquidity_withBorrowUnderMaxLTV() external {
        uint256 collateralAmount = 10 ether;
        uint256 daiBorrowAmount = 1 ether;
        borrow(alice, collateralAmount, daiBorrowAmount, 0, BORROW_REQUEST_MIN_SECS);

        checkLiquidationStatus(alice, true, false, collateralAmount, daiBorrowAmount, 0);
        checkLiquidationStatus(alice, false, false, collateralAmount, daiBorrowAmount, 0);
    }

    function test_computeLiquidity_withBorrowAtMaxLTV() external {
        uint256 collateralAmount = 10 ether;
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        uint256 daiBorrowAmount = maxBorrowInfo.daiMaxBorrow;
        borrow(alice, collateralAmount, daiBorrowAmount, 0, BORROW_REQUEST_MIN_SECS);

        checkLiquidationStatus(alice, true, false, collateralAmount, daiBorrowAmount, 0);
        checkLiquidationStatus(alice, false, false, collateralAmount, daiBorrowAmount, 0);
    }

    function test_computeLiquidity_withBorrowOverMaxLTV() external {
        uint256 collateralAmount = 10 ether;
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        uint256 daiBorrowAmount = maxBorrowInfo.daiMaxBorrow;
        borrow(alice, collateralAmount, daiBorrowAmount, 0, BORROW_REQUEST_MIN_SECS);

        vm.prank(executor);
        tlc.setMaxLtvRatio(daiToken, 0.8e18);

        checkLiquidationStatus(alice, true, true, collateralAmount, daiBorrowAmount, 0);
        checkLiquidationStatus(alice, false, true, collateralAmount, daiBorrowAmount, 0);
    }
    
    function test_computeLiquidity_withBorrowAndRequestUnderMaxLTV() external {
        uint256 collateralAmount = 10 ether;
        uint256 daiBorrowAmount = 1 ether;
        borrow(alice, collateralAmount, daiBorrowAmount, 0, BORROW_REQUEST_MIN_SECS);
        vm.prank(alice);
        tlc.requestBorrow(daiToken, 0.5e18);


        checkLiquidationStatus(alice, true, false, collateralAmount, daiBorrowAmount+0.5e18, 0);
        checkLiquidationStatus(alice, false, false, collateralAmount, daiBorrowAmount, 0);
    }

    function test_computeLiquidity_withBorrowAndRequestAtMaxLTV() external {
        uint256 collateralAmount = 10 ether;
        uint256 daiBorrowAmount = 1 ether;
        borrow(alice, collateralAmount, daiBorrowAmount, 0, BORROW_REQUEST_MIN_SECS);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        vm.prank(alice);
        tlc.requestBorrow(daiToken, maxBorrowInfo.daiMaxBorrow-daiBorrowAmount);

        checkLiquidationStatus(alice, true, false, collateralAmount, maxBorrowInfo.daiMaxBorrow, 0);
        checkLiquidationStatus(alice, false, false, collateralAmount, daiBorrowAmount, 0);

        // After a day of interest this is now over
        vm.warp(block.timestamp + 86400);
        checkLiquidationStatus(alice, true, true, collateralAmount, 8.245136997206700221e18, 0);
        checkLiquidationStatus(alice, false, false, collateralAmount, 1.000136997206700221e18, 0);
    }

    function test_computeLiquidity_withBorrowAndRequestOverMaxLTV() external {
        uint256 collateralAmount = 10 ether;
        uint256 daiBorrowAmount = 1 ether;
        borrow(alice, collateralAmount, daiBorrowAmount, 0, BORROW_REQUEST_MIN_SECS);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        vm.prank(alice);
        tlc.requestBorrow(daiToken, maxBorrowInfo.daiMaxBorrow-daiBorrowAmount);

        vm.prank(executor);
        tlc.setMaxLtvRatio(daiToken, 0.8e18);

        checkLiquidationStatus(alice, true, true, collateralAmount, maxBorrowInfo.daiMaxBorrow, 0);
        checkLiquidationStatus(alice, false, false, collateralAmount, daiBorrowAmount, 0);
    }

    function test_computeLiquidity_withBorrowAndRequestOverMaxLTV_afterRepayOK() external {
        uint256 collateralAmount = 10 ether;
        uint256 daiBorrowAmount = 8 ether;
        borrow(alice, collateralAmount, daiBorrowAmount, 0, BORROW_REQUEST_MIN_SECS);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        vm.prank(alice);
        tlc.requestBorrow(daiToken, maxBorrowInfo.daiMaxBorrow-daiBorrowAmount);

        vm.prank(executor);
        tlc.setMaxLtvRatio(daiToken, 0.8e18);

        vm.startPrank(alice);
        daiToken.approve(address(tlc), maxBorrowInfo.daiMaxBorrow/2);
        tlc.repay(daiToken, maxBorrowInfo.daiMaxBorrow/2, alice);

        checkLiquidationStatus(alice, true, false, collateralAmount, maxBorrowInfo.daiMaxBorrow/2, 0);
        checkLiquidationStatus(alice, false, false, collateralAmount, daiBorrowAmount-maxBorrowInfo.daiMaxBorrow/2, 0);
    }

    function test_computeLiquidity_afterRepayAll() external {
        uint256 collateralAmount = 10 ether;
        uint256 daiBorrowAmount = 8 ether;
        borrow(alice, collateralAmount, daiBorrowAmount, 0, BORROW_REQUEST_MIN_SECS);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        vm.prank(alice);
        tlc.requestBorrow(daiToken, maxBorrowInfo.daiMaxBorrow-daiBorrowAmount);

        vm.prank(executor);
        tlc.setMaxLtvRatio(daiToken, 0.8e18);

        vm.startPrank(alice);
        daiToken.approve(address(tlc), daiBorrowAmount);
        tlc.repayAll(daiToken, alice);

        checkLiquidationStatus(alice, true, false, collateralAmount, maxBorrowInfo.daiMaxBorrow-daiBorrowAmount, 0);
        checkLiquidationStatus(alice, false, false, collateralAmount, 0, 0);

        tlc.cancelBorrowRequest(alice, daiToken);
        checkLiquidationStatus(alice, true, false, collateralAmount, 0, 0);
        checkLiquidationStatus(alice, false, false, collateralAmount, 0, 0);

        tlc.requestRemoveCollateral(collateralAmount);
        checkLiquidationStatus(alice, true, false, 0, 0, 0);
        checkLiquidationStatus(alice, false, false, collateralAmount, 0, 0);

        vm.warp(block.timestamp + COLLATERAL_REQUEST_MIN_SECS);
        tlc.removeCollateral(alice);
        checkLiquidationStatus(alice, true, false, 0, 0, 0);
        checkLiquidationStatus(alice, false, false, 0, 0, 0);
    }
}

contract TempleLineOfCreditTestCheckLiquidityOud is TlcBaseTest {
    function test_computeLiquidity_noBorrowsNoCollateral() external {
        checkLiquidationStatus(alice, true, false, 0, 0, 0);
        checkLiquidationStatus(alice, false, false, 0, 0, 0);
    }

    function test_computeLiquidity_noBorrowsWithCollateral() external {
        uint256 collateralAmount = 100_000;
        addCollateral(alice, collateralAmount);
        checkLiquidationStatus(alice, true, false, collateralAmount, 0, 0);
        checkLiquidationStatus(alice, false, false, collateralAmount, 0, 0);
    }

    function test_computeLiquidity_noBorrowsWithCollateralAndRemoveRequest() external {
        uint256 collateralAmount = 100_000;
        addCollateral(alice, collateralAmount);
        vm.prank(alice);
        tlc.requestRemoveCollateral(50_000);

        checkLiquidationStatus(alice, true, false, 50_000, 0, 0);
        checkLiquidationStatus(alice, false, false, collateralAmount, 0, 0);
    }

    function test_computeLiquidity_withBorrowRequestUnderMaxLTV() external {
        uint256 collateralAmount = 100_000;
        uint256 oudBorrowAmount = 20_000;

        addCollateral(alice, collateralAmount);
        vm.prank(alice);
        tlc.requestBorrow(oudToken, oudBorrowAmount);
        
        checkLiquidationStatus(alice, true, false, collateralAmount, 0, oudBorrowAmount);
        checkLiquidationStatus(alice, false, false, collateralAmount, 0, 0);
    }

    function test_computeLiquidity_withBorrowRequestAtMaxLTV() external {
        uint256 collateralAmount = 100_000;

        addCollateral(alice, collateralAmount);
        vm.prank(alice);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        uint256 oudBorrowAmount = maxBorrowInfo.oudMaxBorrow;
        tlc.requestBorrow(oudToken, oudBorrowAmount);

        checkLiquidationStatus(alice, true, false, collateralAmount, 0, oudBorrowAmount);
        checkLiquidationStatus(alice, false, false, collateralAmount, 0, 0);
    }

    function test_computeLiquidity_withBorrowRequestOverMaxLTV() external {
        uint256 collateralAmount = 100_000;

        addCollateral(alice, collateralAmount);
        vm.prank(alice);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        uint256 oudBorrowAmount = maxBorrowInfo.oudMaxBorrow;
        tlc.requestBorrow(oudToken, oudBorrowAmount);

        vm.prank(executor);
        tlc.setMaxLtvRatio(oudToken, 0.8e18);

        checkLiquidationStatus(alice, true, true, collateralAmount, 0, oudBorrowAmount);
        checkLiquidationStatus(alice, false, false, collateralAmount, 0, 0);
    }

    function test_computeLiquidity_withBorrowUnderMaxLTV() external {
        uint256 collateralAmount = 10 ether;
        uint256 oudBorrowAmount = 1 ether;
        borrow(alice, collateralAmount, 0, oudBorrowAmount, BORROW_REQUEST_MIN_SECS);

        checkLiquidationStatus(alice, true, false, collateralAmount, 0, oudBorrowAmount);
        checkLiquidationStatus(alice, false, false, collateralAmount, 0, oudBorrowAmount);
    }

    function test_computeLiquidity_withBorrowAtMaxLTV() external {
        uint256 collateralAmount = 10 ether;
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        uint256 oudBorrowAmount = maxBorrowInfo.oudMaxBorrow;
        borrow(alice, collateralAmount, 0, oudBorrowAmount, BORROW_REQUEST_MIN_SECS);

        checkLiquidationStatus(alice, true, false, collateralAmount, 0, oudBorrowAmount);
        checkLiquidationStatus(alice, false, false, collateralAmount, 0, oudBorrowAmount);
    }

    function test_computeLiquidity_withBorrowOverMaxLTV() external {
        uint256 collateralAmount = 10 ether;
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        uint256 oudBorrowAmount = maxBorrowInfo.oudMaxBorrow;
        borrow(alice, collateralAmount, 0, oudBorrowAmount, BORROW_REQUEST_MIN_SECS);

        vm.prank(executor);
        tlc.setMaxLtvRatio(oudToken, 0.8e18);

        checkLiquidationStatus(alice, true, true, collateralAmount, 0, oudBorrowAmount);
        checkLiquidationStatus(alice, false, true, collateralAmount, 0, oudBorrowAmount);
    }
    
    function test_computeLiquidity_withBorrowAndRequestUnderMaxLTV() external {
        uint256 collateralAmount = 10 ether;
        uint256 oudBorrowAmount = 1 ether;
        borrow(alice, collateralAmount, 0, oudBorrowAmount, BORROW_REQUEST_MIN_SECS);
        vm.prank(alice);
        tlc.requestBorrow(oudToken, 0.5e18);


        checkLiquidationStatus(alice, true, false, collateralAmount, 0, oudBorrowAmount+0.5e18);
        checkLiquidationStatus(alice, false, false, collateralAmount, 0, oudBorrowAmount);
    }

    function test_computeLiquidity_withBorrowAndRequestAtMaxLTV() external {
        uint256 collateralAmount = 10 ether;
        uint256 oudBorrowAmount = 1 ether;
        borrow(alice, collateralAmount, 0, oudBorrowAmount, BORROW_REQUEST_MIN_SECS);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        vm.prank(alice);
        tlc.requestBorrow(oudToken, maxBorrowInfo.oudMaxBorrow-oudBorrowAmount);

        checkLiquidationStatus(alice, true, false, collateralAmount, 0, maxBorrowInfo.oudMaxBorrow);
        checkLiquidationStatus(alice, false, false, collateralAmount, 0, oudBorrowAmount);

        // After a day of interest this is now over
        vm.warp(block.timestamp + 86400);
        checkLiquidationStatus(alice, true, true, collateralAmount, 0, 9.000136995684421689e18);
        checkLiquidationStatus(alice, false, false, collateralAmount, 0, 1.000136995684421689e18);
    }

    function test_computeLiquidity_withBorrowAndRequestOverMaxLTV() external {
        uint256 collateralAmount = 10 ether;
        uint256 oudBorrowAmount = 1 ether;
        borrow(alice, collateralAmount, 0, oudBorrowAmount, BORROW_REQUEST_MIN_SECS);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        vm.prank(alice);
        tlc.requestBorrow(oudToken, maxBorrowInfo.oudMaxBorrow-oudBorrowAmount);

        vm.prank(executor);
        tlc.setMaxLtvRatio(oudToken, 0.8e18);

        checkLiquidationStatus(alice, true, true, collateralAmount, 0, maxBorrowInfo.oudMaxBorrow);
        checkLiquidationStatus(alice, false, false, collateralAmount, 0, oudBorrowAmount);
    }

    function test_computeLiquidity_withBorrowAndRequestOverMaxLTV_afterRepayOK() external {
        uint256 collateralAmount = 10 ether;
        uint256 oudBorrowAmount = 8 ether;
        borrow(alice, collateralAmount, 0, oudBorrowAmount, BORROW_REQUEST_MIN_SECS);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        vm.prank(alice);
        tlc.requestBorrow(oudToken, maxBorrowInfo.oudMaxBorrow-oudBorrowAmount);

        vm.prank(executor);
        tlc.setMaxLtvRatio(oudToken, 0.8e18);

        vm.startPrank(alice);
        oudToken.approve(address(tlc), maxBorrowInfo.oudMaxBorrow/2);
        tlc.repay(oudToken, maxBorrowInfo.oudMaxBorrow/2, alice);

        checkLiquidationStatus(alice, true, false, collateralAmount, 0, maxBorrowInfo.oudMaxBorrow/2);
        checkLiquidationStatus(alice, false, false, collateralAmount, 0, oudBorrowAmount-maxBorrowInfo.oudMaxBorrow/2);
    }

    function test_computeLiquidity_afterRepayAll() external {
        uint256 collateralAmount = 10 ether;
        uint256 oudBorrowAmount = 8 ether;
        borrow(alice, collateralAmount, 0, oudBorrowAmount, BORROW_REQUEST_MIN_SECS);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        vm.prank(alice);
        tlc.requestBorrow(oudToken, maxBorrowInfo.oudMaxBorrow-oudBorrowAmount);

        vm.prank(executor);
        tlc.setMaxLtvRatio(oudToken, 0.8e18);

        vm.startPrank(alice);
        oudToken.approve(address(tlc), oudBorrowAmount);
        tlc.repayAll(oudToken, alice);

        checkLiquidationStatus(alice, true, false, collateralAmount, 0, maxBorrowInfo.oudMaxBorrow-oudBorrowAmount);
        checkLiquidationStatus(alice, false, false, collateralAmount, 0, 0);

        tlc.cancelBorrowRequest(alice, oudToken);
        checkLiquidationStatus(alice, true, false, collateralAmount, 0, 0);
        checkLiquidationStatus(alice, false, false, collateralAmount, 0, 0);

        tlc.requestRemoveCollateral(collateralAmount);
        checkLiquidationStatus(alice, true, false, 0, 0, 0);
        checkLiquidationStatus(alice, false, false, collateralAmount, 0, 0);

        vm.warp(block.timestamp + COLLATERAL_REQUEST_MIN_SECS);
        tlc.removeCollateral(alice);
        checkLiquidationStatus(alice, true, false, 0, 0, 0);
        checkLiquidationStatus(alice, false, false, 0, 0, 0);
    }
}

contract TempleLineOfCreditTestCheckLiquidityBoth is TlcBaseTest {
    function test_computeLiquidity_eitherOver_thenCanLiquidate() external {
        uint256 collateralAmount = 10 ether;
        uint256 daiBorrowAmount = 7 ether;
        borrow(alice, collateralAmount, daiBorrowAmount, 0, BORROW_REQUEST_MIN_SECS);

        uint256 oudBorrowAmount = 7 ether;
        vm.startPrank(alice);
        tlc.requestBorrow(oudToken, oudBorrowAmount);
        vm.warp(block.timestamp + BORROW_REQUEST_MIN_SECS);
        tlc.borrow(oudToken, alice);

        // A few seconds of interest on DAI as time was warped in the OUD borrow request.
        uint256 expectedDaiDebt = 7.000000665957455989e18;
        checkLiquidationStatus(alice, true, false, collateralAmount, expectedDaiDebt, oudBorrowAmount);
        checkLiquidationStatus(alice, false, false, collateralAmount, expectedDaiDebt, oudBorrowAmount);


        tlc.requestBorrow(daiToken, 1 ether);
        tlc.requestBorrow(oudToken, 1 ether);
        checkLiquidationStatus(alice, true, false, collateralAmount, expectedDaiDebt+1e18, oudBorrowAmount+1e18);
        checkLiquidationStatus(alice, false, false, collateralAmount, expectedDaiDebt, oudBorrowAmount);

        // Lower the DAI LTV
        changePrank(executor);
        tlc.setMaxLtvRatio(daiToken, 0.75e18);
        checkLiquidationStatus(alice, true, true, collateralAmount, expectedDaiDebt+1e18, oudBorrowAmount+1e18);
        checkLiquidationStatus(alice, false, false, collateralAmount, expectedDaiDebt, oudBorrowAmount);
        tlc.setMaxLtvRatio(daiToken, daiMaxLtvRatio);

        // Lower the OUD LTV
        tlc.setMaxLtvRatio(oudToken, 0.75e18);
        checkLiquidationStatus(alice, true, true, collateralAmount, expectedDaiDebt+1e18, oudBorrowAmount+1e18);
        checkLiquidationStatus(alice, false, false, collateralAmount, expectedDaiDebt, oudBorrowAmount);
        tlc.setMaxLtvRatio(oudToken, oudMaxLtvRatio);

        // Back healthy after the LTV was put back
        checkLiquidationStatus(alice, true, false, collateralAmount, expectedDaiDebt+1e18, oudBorrowAmount+1e18);
        checkLiquidationStatus(alice, false, false, collateralAmount, expectedDaiDebt, oudBorrowAmount);
    }

}

contract TempleLineOfCreditTestBatchLiquidate is TlcBaseTest {
    function test_batchLiquidate_noAccounts() external {
        uint256 collateralAmount = 10e18;
        borrow(alice, collateralAmount, 1e18, 1e18, BORROW_REQUEST_MIN_SECS);

        // After borrow
        assertEq(tlc.totalCollateral(), collateralAmount);
        checkDebtTokenDetails(daiToken, 1e18, 50000555555555555, INITIAL_INTEREST_ACCUMULATOR, block.timestamp);
        checkDebtTokenDetails(oudToken, 1e18, oudInterestRate, INITIAL_INTEREST_ACCUMULATOR, block.timestamp);

        address[] memory accounts = new address[](0);
        checkBatchLiquidate(accounts, 0, 0, 0);

        // No change
        assertEq(tlc.totalCollateral(), collateralAmount);
        checkDebtTokenDetails(daiToken, 1e18, 50000555555555555, INITIAL_INTEREST_ACCUMULATOR, block.timestamp);
        checkDebtTokenDetails(oudToken, 1e18, oudInterestRate, INITIAL_INTEREST_ACCUMULATOR, block.timestamp);
    }

    function test_batchLiquidate_oneAccount_noLiquidate() external {
        uint256 collateralAmount = 10e18;
        borrow(alice, collateralAmount, 1e18, 1e18, BORROW_REQUEST_MIN_SECS);

        // After borrow
        assertEq(tlc.totalCollateral(), collateralAmount);
        checkDebtTokenDetails(daiToken, 1e18, 50000555555555555, INITIAL_INTEREST_ACCUMULATOR, block.timestamp);
        checkDebtTokenDetails(oudToken, 1e18, oudInterestRate, INITIAL_INTEREST_ACCUMULATOR, block.timestamp);

        address[] memory accounts = new address[](1);
        accounts[0] = alice;
        checkBatchLiquidate(accounts, 0, 0, 0);

        // No change
        assertEq(tlc.totalCollateral(), collateralAmount);
        checkDebtTokenDetails(daiToken, 1e18, 50000555555555555, INITIAL_INTEREST_ACCUMULATOR, block.timestamp);
        checkDebtTokenDetails(oudToken, 1e18, oudInterestRate, INITIAL_INTEREST_ACCUMULATOR, block.timestamp);
    }

    function test_batchLiquidate_oneAccount_noLiquidateAtMax() external {
        uint256 collateralAmount = 10e18;
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        borrow(alice, collateralAmount, maxBorrowInfo.daiMaxBorrow, 1e18, BORROW_REQUEST_MIN_SECS);

        // After borrow
        assertEq(tlc.totalCollateral(), collateralAmount);
        checkDebtTokenDetails(daiToken, maxBorrowInfo.daiMaxBorrow, 50004580555555555, INITIAL_INTEREST_ACCUMULATOR, block.timestamp);
        checkDebtTokenDetails(oudToken, 1e18, oudInterestRate, INITIAL_INTEREST_ACCUMULATOR, block.timestamp);

        address[] memory accounts = new address[](1);
        accounts[0] = alice;
        checkBatchLiquidate(accounts, 0, 0, 0);

        // No change
        assertEq(tlc.totalCollateral(), 10e18);
        checkDebtTokenDetails(daiToken, maxBorrowInfo.daiMaxBorrow, 50004580555555555, INITIAL_INTEREST_ACCUMULATOR, block.timestamp);
        checkDebtTokenDetails(oudToken, 1e18, oudInterestRate, INITIAL_INTEREST_ACCUMULATOR, block.timestamp);
    }

    struct Balances {
        uint256 aliceTemple;
        uint256 bobTemple;
        uint256 tlcTemple;
        uint256 dUsd;
    }

    function getBalances() internal view returns (Balances memory) {
        return Balances({
            aliceTemple: templeToken.balanceOf(alice),
            bobTemple: templeToken.balanceOf(bob),
            tlcTemple: templeToken.balanceOf(address(tlc)),
            dUsd: dUSD.balanceOf(address(tlcStrategy))
        });
    }

    function test_batchLiquidate_oneAccount_liquidateDai() external {
        uint256 collateralAmount = 10e18;
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        uint256 daiBorrowAmount = maxBorrowInfo.daiMaxBorrow;
        uint256 oudBorrowAmount = 1e18;
        borrow(alice, collateralAmount, daiBorrowAmount, oudBorrowAmount, BORROW_REQUEST_MIN_SECS);

        // 1 second later...
        vm.warp(block.timestamp + 1);

        // After borrow
        assertEq(tlc.totalCollateral(), collateralAmount);
        uint96 expectedDaiInterestRate = 50004580555555555;
        checkDebtTokenDetails(daiToken, daiBorrowAmount, expectedDaiInterestRate, INITIAL_INTEREST_ACCUMULATOR, block.timestamp-1);
        checkDebtTokenDetails(oudToken, oudBorrowAmount, oudInterestRate, INITIAL_INTEREST_ACCUMULATOR, block.timestamp-1);

        uint256 expectedDaiDebt = approxInterest(daiBorrowAmount, expectedDaiInterestRate, 1);
        uint256 expectedOudDebt = approxInterest(oudBorrowAmount, oudInterestRate, 1);

        address[] memory accounts = new address[](1);
        accounts[0] = alice;
        checkBatchLiquidate(accounts, collateralAmount, expectedDaiDebt, expectedOudDebt);

        // Amounts were claimed, state and rates updated.
        assertEq(tlc.totalCollateral(), 0);
        checkDebtTokenDetails(daiToken, 0, 0.05e18, INITIAL_INTEREST_ACCUMULATOR, block.timestamp);
        checkDebtTokenDetails(oudToken, 0, oudInterestRate, INITIAL_INTEREST_ACCUMULATOR, block.timestamp);

        // Check balances - Alice keeps the DAI/OUD, the rest is liquidated.
        Balances memory balances = getBalances();
        assertEq(balances.aliceTemple, 0);
        assertEq(balances.tlcTemple, 0);
        assertEq(balances.dUsd, 0);

        // Account data was wiped
        maxBorrowInfo = expectedMaxBorrows(0);
        checkAccountPosition(
            CheckAccountPositionParams({
                account: alice,
                expectedDaiBalance: daiBorrowAmount,
                expectedOudBalance: oudBorrowAmount,
                expectedAccountPosition: AccountPosition({
                    collateralPosted: 0,
                    daiDebtPosition: createDebtPosition(daiToken, 0, maxBorrowInfo),
                    oudDebtPosition: createDebtPosition(oudToken, 0, maxBorrowInfo)
                }),
                expectedDaiDebtCheckpoint: 0,
                expectedDaiAccumulatorCheckpoint: 0,
                expectedOudDebtCheckpoint: 0,
                expectedOudAccumulatorCheckpoint: 0,
                expectedRemoveCollateralRequest: 0,
                expectedRemoveCollateralRequestAt: 0
            }),
            true
        );
    }

    function test_batchLiquidate_oneAccount_liquidateOud() external {
        uint256 collateralAmount = 10e18;
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        uint256 daiBorrowAmount = 1e18;
        uint256 oudBorrowAmount = maxBorrowInfo.oudMaxBorrow;
        borrow(alice, collateralAmount, daiBorrowAmount, oudBorrowAmount, BORROW_REQUEST_MIN_SECS);

        // 1 second later...
        vm.warp(block.timestamp + 1);

        // After borrow
        assertEq(tlc.totalCollateral(), collateralAmount);
        uint96 expectedDaiInterestRate = 50000555555555555;
        checkDebtTokenDetails(daiToken, daiBorrowAmount, expectedDaiInterestRate, INITIAL_INTEREST_ACCUMULATOR, block.timestamp-1);
        checkDebtTokenDetails(oudToken, oudBorrowAmount, oudInterestRate, INITIAL_INTEREST_ACCUMULATOR, block.timestamp-1);

        uint256 expectedDaiDebt = approxInterest(daiBorrowAmount, expectedDaiInterestRate, 1);
        uint256 expectedOudDebt = approxInterest(oudBorrowAmount, oudInterestRate, 1);

        address[] memory accounts = new address[](1);
        accounts[0] = alice;
        checkBatchLiquidate(accounts, collateralAmount, expectedDaiDebt, expectedOudDebt);

        // Amounts were claimed, state and rates updated.
        assertEq(tlc.totalCollateral(), 0);
        checkDebtTokenDetails(daiToken, 0, 0.05e18, INITIAL_INTEREST_ACCUMULATOR, block.timestamp);
        checkDebtTokenDetails(oudToken, 0, oudInterestRate, INITIAL_INTEREST_ACCUMULATOR, block.timestamp);

        // Check balances - Alice keeps the DAI/OUD, the rest is liquidated.
        Balances memory balances = getBalances();
        assertEq(balances.aliceTemple, 0);
        assertEq(balances.tlcTemple, 0);
        assertEq(balances.dUsd, 0);

        // Account data was wiped
        maxBorrowInfo = expectedMaxBorrows(0);
        checkAccountPosition(
            CheckAccountPositionParams({
                account: alice,
                expectedDaiBalance: daiBorrowAmount,
                expectedOudBalance: oudBorrowAmount,
                expectedAccountPosition: AccountPosition({
                    collateralPosted: 0,
                    daiDebtPosition: createDebtPosition(daiToken, 0, maxBorrowInfo),
                    oudDebtPosition: createDebtPosition(oudToken, 0, maxBorrowInfo)
                }),
                expectedDaiDebtCheckpoint: 0,
                expectedDaiAccumulatorCheckpoint: 0,
                expectedOudDebtCheckpoint: 0,
                expectedOudAccumulatorCheckpoint: 0,
                expectedRemoveCollateralRequest: 0,
                expectedRemoveCollateralRequestAt: 0
            }),
            true
        );
    }

    function test_batchLiquidate_oneAccount_liquidateBoth() external {
        uint256 collateralAmount = 10e18;
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        uint256 daiBorrowAmount = maxBorrowInfo.daiMaxBorrow;
        uint256 oudBorrowAmount = maxBorrowInfo.oudMaxBorrow;
        borrow(alice, collateralAmount, daiBorrowAmount, oudBorrowAmount, BORROW_REQUEST_MIN_SECS);

        // 1 second later...
        vm.warp(block.timestamp + 1);

        // After borrow
        assertEq(tlc.totalCollateral(), collateralAmount);
        uint96 expectedDaiInterestRate = 50004580555555555;
        checkDebtTokenDetails(daiToken, daiBorrowAmount, expectedDaiInterestRate, INITIAL_INTEREST_ACCUMULATOR, block.timestamp-1);
        checkDebtTokenDetails(oudToken, oudBorrowAmount, oudInterestRate, INITIAL_INTEREST_ACCUMULATOR, block.timestamp-1);

        uint256 expectedDaiDebt = approxInterest(daiBorrowAmount, expectedDaiInterestRate, 1);
        uint256 expectedOudDebt = approxInterest(oudBorrowAmount, oudInterestRate, 1);

        address[] memory accounts = new address[](1);
        accounts[0] = alice;
        checkBatchLiquidate(accounts, collateralAmount, expectedDaiDebt, expectedOudDebt);

        // Amounts were claimed, state and rates updated.
        assertEq(tlc.totalCollateral(), 0);
        checkDebtTokenDetails(daiToken, 0, 0.05e18, INITIAL_INTEREST_ACCUMULATOR, block.timestamp);
        checkDebtTokenDetails(oudToken, 0, oudInterestRate, INITIAL_INTEREST_ACCUMULATOR, block.timestamp);

        // Check balances - Alice keeps the DAI/OUD, the rest is liquidated.
        Balances memory balances = getBalances();
        assertEq(balances.aliceTemple, 0);
        assertEq(balances.tlcTemple, 0);
        assertEq(balances.dUsd, 0);

        // Account data was wiped
        maxBorrowInfo = expectedMaxBorrows(0);
        checkAccountPosition(
            CheckAccountPositionParams({
                account: alice,
                expectedDaiBalance: daiBorrowAmount,
                expectedOudBalance: oudBorrowAmount,
                expectedAccountPosition: AccountPosition({
                    collateralPosted: 0,
                    daiDebtPosition: createDebtPosition(daiToken, 0, maxBorrowInfo),
                    oudDebtPosition: createDebtPosition(oudToken, 0, maxBorrowInfo)
                }),
                expectedDaiDebtCheckpoint: 0,
                expectedDaiAccumulatorCheckpoint: 0,
                expectedOudDebtCheckpoint: 0,
                expectedOudAccumulatorCheckpoint: 0,
                expectedRemoveCollateralRequest: 0,
                expectedRemoveCollateralRequestAt: 0
            }),
            true
        );
    }

    event RealisedGain(address indexed strategy, uint256 amount);

    function test_batchLiquidate_twoAccounts_oneLiquidate() external {
        uint256 collateralAmount = 10e18;
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        uint256 daiBorrowAmount = maxBorrowInfo.daiMaxBorrow;
        uint256 oudBorrowAmount = 1e18;
        borrow(alice, collateralAmount, daiBorrowAmount, oudBorrowAmount, BORROW_REQUEST_MIN_SECS);
        borrow(bob, collateralAmount, 1e18, oudBorrowAmount, BORROW_REQUEST_MIN_SECS);

        // 1 second later...
        vm.warp(block.timestamp + 1);

        // After borrow
        assertEq(tlc.totalCollateral(), 2*collateralAmount);

        uint256 expectedDaiDebt;
        uint256 expectedOudDebt;
        {
            uint96 expectedDaiInterestRate = 50005136111546896;
            expectedDaiDebt = approxInterest(daiBorrowAmount, expectedDaiInterestRate, BORROW_REQUEST_MIN_SECS+1);
            expectedOudDebt = approxInterest(oudBorrowAmount, oudInterestRate, BORROW_REQUEST_MIN_SECS+1);
            checkDebtTokenDetails(daiToken, expectedDaiDebt+1e18, expectedDaiInterestRate, INITIAL_INTEREST_ACCUMULATOR, block.timestamp-1);
            checkDebtTokenDetails(oudToken, 2*oudBorrowAmount, oudInterestRate, INITIAL_INTEREST_ACCUMULATOR, block.timestamp-1);
        }

        address[] memory accounts = new address[](2);
        accounts[0] = alice;
        accounts[1] = bob;

        // 10 Temple was repaid to TRV, which is more DAI worth than the dUSD debt.
        // Gain = (10 Temple burned * 0.97 TPI) - (total dai borrowed + interest);
        {
            uint256 expectedRealisedGain = 454999840200087274;
            vm.expectEmit(address(trv));
            emit RealisedGain(address(tlcStrategy), expectedRealisedGain);
        }

        checkBatchLiquidate(accounts, collateralAmount, expectedDaiDebt, expectedOudDebt);

        // Amounts were claimed, state and rates updated.
        assertEq(tlc.totalCollateral(), collateralAmount);
        checkDebtTokenDetails(daiToken, 1e18, 50000555555556436, INITIAL_INTEREST_ACCUMULATOR, block.timestamp);
        checkDebtTokenDetails(oudToken, 1e18, oudInterestRate, INITIAL_INTEREST_ACCUMULATOR, block.timestamp);

        // Check balances - Alice keeps the DAI/OUD, the rest is liquidated.
        {
            Balances memory balances = getBalances();
            assertEq(balances.aliceTemple, 0);
            assertEq(balances.tlcTemple, collateralAmount);
            // The dUSD debt is now zero since there was a realised gain.
            assertEq(balances.dUsd, 0);
        }

        // Account data was wiped for Alice
        maxBorrowInfo = expectedMaxBorrows(0);
        checkAccountPosition(
            CheckAccountPositionParams({
                account: alice,
                expectedDaiBalance: daiBorrowAmount,
                expectedOudBalance: oudBorrowAmount,
                expectedAccountPosition: AccountPosition({
                    collateralPosted: 0,
                    daiDebtPosition: createDebtPosition(daiToken, 0, maxBorrowInfo),
                    oudDebtPosition: createDebtPosition(oudToken, 0, maxBorrowInfo)
                }),
                expectedDaiDebtCheckpoint: 0,
                expectedDaiAccumulatorCheckpoint: 0,
                expectedOudDebtCheckpoint: 0,
                expectedOudAccumulatorCheckpoint: 0,
                expectedRemoveCollateralRequest: 0,
                expectedRemoveCollateralRequestAt: 0
            }),
            true
        );
        checkLiquidationStatus(alice, true, false, 0, 0, 0);
        checkLiquidationStatus(alice, false, false, 0, 0, 0);

        // Not for Bob
        maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        expectedDaiDebt = approxInterest(1e18, 50000555555556436, 1);
        expectedOudDebt = approxInterest(oudBorrowAmount, oudInterestRate, 1);

        checkAccountPosition(
            CheckAccountPositionParams({
                account: bob,
                expectedDaiBalance: 1e18,
                expectedOudBalance: oudBorrowAmount,
                expectedAccountPosition: AccountPosition({
                    collateralPosted: collateralAmount,
                    daiDebtPosition: createDebtPosition(daiToken, expectedDaiDebt, maxBorrowInfo),
                    oudDebtPosition: createDebtPosition(oudToken, expectedOudDebt, maxBorrowInfo)
                }),
                expectedDaiDebtCheckpoint: 1e18,
                expectedDaiAccumulatorCheckpoint: approxInterest(INITIAL_INTEREST_ACCUMULATOR, 50000555555556436, BORROW_REQUEST_MIN_SECS),
                expectedOudDebtCheckpoint: oudBorrowAmount,
                expectedOudAccumulatorCheckpoint: approxInterest(INITIAL_INTEREST_ACCUMULATOR, oudInterestRate, BORROW_REQUEST_MIN_SECS),
                expectedRemoveCollateralRequest: 0,
                expectedRemoveCollateralRequestAt: 0
            }),
            true
        );

        checkLiquidationStatus(bob, true, false, collateralAmount, expectedDaiDebt, expectedOudDebt);
        checkLiquidationStatus(bob, false, false, collateralAmount, expectedDaiDebt, expectedOudDebt);
    }

    function test_batchLiquidate_twoAccounts_twoLiquidate() external {
        uint256 collateralAmount = 10e18;
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        uint256 daiBorrowAmount = maxBorrowInfo.daiMaxBorrow;
        uint256 oudBorrowAmount = maxBorrowInfo.oudMaxBorrow;
        borrow(alice, collateralAmount, daiBorrowAmount, 1e18, BORROW_REQUEST_MIN_SECS);
        borrow(bob, collateralAmount, 1e18, oudBorrowAmount, BORROW_REQUEST_MIN_SECS);

        // 1 second later...
        vm.warp(block.timestamp + 1);

        // After borrow
        assertEq(tlc.totalCollateral(), 2*collateralAmount);

        uint256 expectedDaiDebt;
        uint256 expectedOudDebt;
        {
            uint96 expectedDaiInterestRate = 50005136111546896;
            expectedDaiDebt = approxInterest(daiBorrowAmount, expectedDaiInterestRate, BORROW_REQUEST_MIN_SECS+1);
            expectedOudDebt = approxInterest(oudBorrowAmount, oudInterestRate, 1);
            checkDebtTokenDetails(daiToken, expectedDaiDebt+1e18, expectedDaiInterestRate, INITIAL_INTEREST_ACCUMULATOR, block.timestamp-1);
            checkDebtTokenDetails(oudToken, expectedOudDebt+1e18, oudInterestRate, INITIAL_INTEREST_ACCUMULATOR, block.timestamp-1);
        }

        address[] memory accounts = new address[](2);
        accounts[0] = alice;
        accounts[1] = bob;

        // 10 Temple was repaid to TRV, which is more DAI worth than the dUSD debt.
        // Gain = (20 Temple burned * 0.97 TPI) - (total dai borrowed + interest);
        {
            uint256 expectedRealisedGain = 10154999840200087274;
            vm.expectEmit(address(trv));
            emit RealisedGain(address(tlcStrategy), expectedRealisedGain);
        }

        checkBatchLiquidate(accounts, 2*collateralAmount, expectedDaiDebt+1e18, expectedOudDebt+1e18);

        // Amounts were claimed, state and rates updated.
        assertEq(tlc.totalCollateral(), 0);
        checkDebtTokenDetails(daiToken, 0, 0.05e18, INITIAL_INTEREST_ACCUMULATOR, block.timestamp);
        checkDebtTokenDetails(oudToken, 0, oudInterestRate, INITIAL_INTEREST_ACCUMULATOR, block.timestamp);

        // Check balances - Alice keeps the DAI/OUD, the rest is liquidated.
        {
            Balances memory balances = getBalances();
            assertEq(balances.aliceTemple, 0);
            assertEq(balances.tlcTemple, 0);
            // The dUSD debt is now zero since there was a realised gain.
            assertEq(balances.dUsd, 0);
        }

        // Account data was wiped for Alice and Bob
        maxBorrowInfo = expectedMaxBorrows(0);
        checkAccountPosition(
            CheckAccountPositionParams({
                account: alice,
                expectedDaiBalance: daiBorrowAmount,
                expectedOudBalance: 1e18,
                expectedAccountPosition: AccountPosition({
                    collateralPosted: 0,
                    daiDebtPosition: createDebtPosition(daiToken, 0, maxBorrowInfo),
                    oudDebtPosition: createDebtPosition(oudToken, 0, maxBorrowInfo)
                }),
                expectedDaiDebtCheckpoint: 0,
                expectedDaiAccumulatorCheckpoint: 0,
                expectedOudDebtCheckpoint: 0,
                expectedOudAccumulatorCheckpoint: 0,
                expectedRemoveCollateralRequest: 0,
                expectedRemoveCollateralRequestAt: 0
            }),
            true
        );
        checkAccountPosition(
            CheckAccountPositionParams({
                account: bob,
                expectedDaiBalance: 1e18,
                expectedOudBalance: oudBorrowAmount,
                expectedAccountPosition: AccountPosition({
                    collateralPosted: 0,
                    daiDebtPosition: createDebtPosition(daiToken, 0, maxBorrowInfo),
                    oudDebtPosition: createDebtPosition(oudToken, 0, maxBorrowInfo)
                }),
                expectedDaiDebtCheckpoint: 0,
                expectedDaiAccumulatorCheckpoint: 0,
                expectedOudDebtCheckpoint: 0,
                expectedOudAccumulatorCheckpoint: 0,
                expectedRemoveCollateralRequest: 0,
                expectedRemoveCollateralRequestAt: 0
            }),
            true
        );
    }

    function test_batchLiquidate_requestDoesntLiquidate() external {
        uint256 collateralAmount = 10 ether;
        uint256 oudBorrowAmount = 1 ether;
        borrow(alice, collateralAmount, 0, oudBorrowAmount, BORROW_REQUEST_MIN_SECS);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        vm.prank(alice);
        tlc.requestBorrow(oudToken, maxBorrowInfo.oudMaxBorrow-oudBorrowAmount);

        vm.prank(executor);
        tlc.setMaxLtvRatio(oudToken, 0.8e18);

        address[] memory accounts = new address[](1);
        accounts[0] = alice;

        checkLiquidationStatus(alice, true, true, collateralAmount, 0, maxBorrowInfo.oudMaxBorrow);
        checkLiquidationStatus(alice, false, false, collateralAmount, 0, oudBorrowAmount);
        checkBatchLiquidate(accounts, 0, 0, 0);
    }
}