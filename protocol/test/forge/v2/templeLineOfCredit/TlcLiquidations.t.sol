pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TlcBaseTest } from "./TlcBaseTest.t.sol";

import "forge-std/console.sol";

// A very important check - capturing all the permutations.

// @todo fork for oud

contract TempleLineOfCreditTestCheckLiquidityDai is TlcBaseTest {
    // @todo add in tests after liquidation

    function test_computeLiquidity_noBorrowsNoCollateral() external {
        checkLiquidityStatus(alice, true, false, 0, 0, 0);
        checkLiquidityStatus(alice, false, false, 0, 0, 0);
    }

    function test_computeLiquidity_noBorrowsWithCollateral() external {
        uint256 collateralAmount = 100_000;
        addCollateral(alice, collateralAmount);
        checkLiquidityStatus(alice, true, false, collateralAmount, 0, 0);
        checkLiquidityStatus(alice, false, false, collateralAmount, 0, 0);
    }

    function test_computeLiquidity_noBorrowsWithCollateralAndRemoveRequest() external {
        uint256 collateralAmount = 100_000;
        addCollateral(alice, collateralAmount);
        vm.prank(alice);
        tlc.requestRemoveCollateral(50_000);

        checkLiquidityStatus(alice, true, false, 50_000, 0, 0);
        checkLiquidityStatus(alice, false, false, collateralAmount, 0, 0);
    }

    function test_computeLiquidity_withBorrowRequestUnderMaxLTV() external {
        uint256 collateralAmount = 100_000;
        uint256 daiBorrowAmount = 20_000;

        addCollateral(alice, collateralAmount);
        vm.prank(alice);
        tlc.requestBorrow(daiToken, daiBorrowAmount);
        
        checkLiquidityStatus(alice, true, false, collateralAmount, daiBorrowAmount, 0);
        checkLiquidityStatus(alice, false, false, collateralAmount, 0, 0);
    }

    function test_computeLiquidity_withBorrowRequestAtMaxLTV() external {
        uint256 collateralAmount = 100_000;

        addCollateral(alice, collateralAmount);
        vm.prank(alice);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        uint256 daiBorrowAmount = maxBorrowInfo.daiMaxBorrow;
        tlc.requestBorrow(daiToken, daiBorrowAmount);

        checkLiquidityStatus(alice, true, false, collateralAmount, daiBorrowAmount, 0);
        checkLiquidityStatus(alice, false, false, collateralAmount, 0, 0);
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

        checkLiquidityStatus(alice, true, true, collateralAmount, daiBorrowAmount, 0);
        checkLiquidityStatus(alice, false, false, collateralAmount, 0, 0);
    }

    function test_computeLiquidity_withBorrowUnderMaxLTV() external {
        uint256 collateralAmount = 10 ether;
        uint256 daiBorrowAmount = 1 ether;
        borrow(alice, collateralAmount, daiBorrowAmount, 0, FUNDS_REQUEST_MIN_SECS);

        checkLiquidityStatus(alice, true, false, collateralAmount, daiBorrowAmount, 0);
        checkLiquidityStatus(alice, false, false, collateralAmount, daiBorrowAmount, 0);
    }

    function test_computeLiquidity_withBorrowAtMaxLTV() external {
        uint256 collateralAmount = 10 ether;
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        uint256 daiBorrowAmount = maxBorrowInfo.daiMaxBorrow;
        borrow(alice, collateralAmount, daiBorrowAmount, 0, FUNDS_REQUEST_MIN_SECS);

        checkLiquidityStatus(alice, true, false, collateralAmount, daiBorrowAmount, 0);
        checkLiquidityStatus(alice, false, false, collateralAmount, daiBorrowAmount, 0);
    }

    function test_computeLiquidity_withBorrowOverMaxLTV() external {
        uint256 collateralAmount = 10 ether;
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        uint256 daiBorrowAmount = maxBorrowInfo.daiMaxBorrow;
        borrow(alice, collateralAmount, daiBorrowAmount, 0, FUNDS_REQUEST_MIN_SECS);

        vm.prank(executor);
        tlc.setMaxLtvRatio(daiToken, 0.8e18);

        checkLiquidityStatus(alice, true, true, collateralAmount, daiBorrowAmount, 0);
        checkLiquidityStatus(alice, false, true, collateralAmount, daiBorrowAmount, 0);
    }
    
    function test_computeLiquidity_withBorrowAndRequestUnderMaxLTV() external {
        uint256 collateralAmount = 10 ether;
        uint256 daiBorrowAmount = 1 ether;
        borrow(alice, collateralAmount, daiBorrowAmount, 0, FUNDS_REQUEST_MIN_SECS);
        vm.prank(alice);
        tlc.requestBorrow(daiToken, 0.5e18);


        checkLiquidityStatus(alice, true, false, collateralAmount, daiBorrowAmount+0.5e18, 0);
        checkLiquidityStatus(alice, false, false, collateralAmount, daiBorrowAmount, 0);
    }

    function test_computeLiquidity_withBorrowAndRequestAtMaxLTV() external {
        uint256 collateralAmount = 10 ether;
        uint256 daiBorrowAmount = 1 ether;
        borrow(alice, collateralAmount, daiBorrowAmount, 0, FUNDS_REQUEST_MIN_SECS);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        vm.prank(alice);
        tlc.requestBorrow(daiToken, maxBorrowInfo.daiMaxBorrow-daiBorrowAmount);

        checkLiquidityStatus(alice, true, false, collateralAmount, maxBorrowInfo.daiMaxBorrow, 0);
        checkLiquidityStatus(alice, false, false, collateralAmount, daiBorrowAmount, 0);

        // After a day of interest this is now over
        vm.warp(block.timestamp + 86400);
        checkLiquidityStatus(alice, true, true, collateralAmount, 8.245136997206700221e18, 0);
        checkLiquidityStatus(alice, false, false, collateralAmount, 1.000136997206700221e18, 0);
    }

    function test_computeLiquidity_withBorrowAndRequestOverMaxLTV() external {
        uint256 collateralAmount = 10 ether;
        uint256 daiBorrowAmount = 1 ether;
        borrow(alice, collateralAmount, daiBorrowAmount, 0, FUNDS_REQUEST_MIN_SECS);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        vm.prank(alice);
        tlc.requestBorrow(daiToken, maxBorrowInfo.daiMaxBorrow-daiBorrowAmount);

        vm.prank(executor);
        tlc.setMaxLtvRatio(daiToken, 0.8e18);

        checkLiquidityStatus(alice, true, true, collateralAmount, maxBorrowInfo.daiMaxBorrow, 0);
        checkLiquidityStatus(alice, false, false, collateralAmount, daiBorrowAmount, 0);
    }

    function test_computeLiquidity_withBorrowAndRequestOverMaxLTV_afterRepayOK() external {
        uint256 collateralAmount = 10 ether;
        uint256 daiBorrowAmount = 8 ether;
        borrow(alice, collateralAmount, daiBorrowAmount, 0, FUNDS_REQUEST_MIN_SECS);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        vm.prank(alice);
        tlc.requestBorrow(daiToken, maxBorrowInfo.daiMaxBorrow-daiBorrowAmount);

        vm.prank(executor);
        tlc.setMaxLtvRatio(daiToken, 0.8e18);

        vm.startPrank(alice);
        daiToken.approve(address(tlc), maxBorrowInfo.daiMaxBorrow/2);
        tlc.repay(daiToken, maxBorrowInfo.daiMaxBorrow/2, alice);

        checkLiquidityStatus(alice, true, false, collateralAmount, maxBorrowInfo.daiMaxBorrow/2, 0);
        checkLiquidityStatus(alice, false, false, collateralAmount, daiBorrowAmount-maxBorrowInfo.daiMaxBorrow/2, 0);
    }

    function test_computeLiquidity_afterRepayAll() external {
        uint256 collateralAmount = 10 ether;
        uint256 daiBorrowAmount = 8 ether;
        borrow(alice, collateralAmount, daiBorrowAmount, 0, FUNDS_REQUEST_MIN_SECS);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        vm.prank(alice);
        tlc.requestBorrow(daiToken, maxBorrowInfo.daiMaxBorrow-daiBorrowAmount);

        vm.prank(executor);
        tlc.setMaxLtvRatio(daiToken, 0.8e18);

        vm.startPrank(alice);
        daiToken.approve(address(tlc), daiBorrowAmount);
        tlc.repayAll(daiToken, alice);

        checkLiquidityStatus(alice, true, false, collateralAmount, maxBorrowInfo.daiMaxBorrow-daiBorrowAmount, 0);
        checkLiquidityStatus(alice, false, false, collateralAmount, 0, 0);

        tlc.cancelBorrowRequest(alice, daiToken);
        checkLiquidityStatus(alice, true, false, collateralAmount, 0, 0);
        checkLiquidityStatus(alice, false, false, collateralAmount, 0, 0);

        tlc.requestRemoveCollateral(collateralAmount);
        checkLiquidityStatus(alice, true, false, 0, 0, 0);
        checkLiquidityStatus(alice, false, false, collateralAmount, 0, 0);

        vm.warp(block.timestamp + FUNDS_REQUEST_MIN_SECS);
        tlc.removeCollateral(alice);
        checkLiquidityStatus(alice, true, false, 0, 0, 0);
        checkLiquidityStatus(alice, false, false, 0, 0, 0);
    }
}

contract TempleLineOfCreditTestCheckLiquidityOud is TlcBaseTest {
    // @todo add in tests after liquidation

    function test_computeLiquidity_noBorrowsNoCollateral() external {
        checkLiquidityStatus(alice, true, false, 0, 0, 0);
        checkLiquidityStatus(alice, false, false, 0, 0, 0);
    }

    function test_computeLiquidity_noBorrowsWithCollateral() external {
        uint256 collateralAmount = 100_000;
        addCollateral(alice, collateralAmount);
        checkLiquidityStatus(alice, true, false, collateralAmount, 0, 0);
        checkLiquidityStatus(alice, false, false, collateralAmount, 0, 0);
    }

    function test_computeLiquidity_noBorrowsWithCollateralAndRemoveRequest() external {
        uint256 collateralAmount = 100_000;
        addCollateral(alice, collateralAmount);
        vm.prank(alice);
        tlc.requestRemoveCollateral(50_000);

        checkLiquidityStatus(alice, true, false, 50_000, 0, 0);
        checkLiquidityStatus(alice, false, false, collateralAmount, 0, 0);
    }

    function test_computeLiquidity_withBorrowRequestUnderMaxLTV() external {
        uint256 collateralAmount = 100_000;
        uint256 oudBorrowAmount = 20_000;

        addCollateral(alice, collateralAmount);
        vm.prank(alice);
        tlc.requestBorrow(oudToken, oudBorrowAmount);
        
        checkLiquidityStatus(alice, true, false, collateralAmount, 0, oudBorrowAmount);
        checkLiquidityStatus(alice, false, false, collateralAmount, 0, 0);
    }

    function test_computeLiquidity_withBorrowRequestAtMaxLTV() external {
        uint256 collateralAmount = 100_000;

        addCollateral(alice, collateralAmount);
        vm.prank(alice);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        uint256 oudBorrowAmount = maxBorrowInfo.oudMaxBorrow;
        tlc.requestBorrow(oudToken, oudBorrowAmount);

        checkLiquidityStatus(alice, true, false, collateralAmount, 0, oudBorrowAmount);
        checkLiquidityStatus(alice, false, false, collateralAmount, 0, 0);
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

        checkLiquidityStatus(alice, true, true, collateralAmount, 0, oudBorrowAmount);
        checkLiquidityStatus(alice, false, false, collateralAmount, 0, 0);
    }

    function test_computeLiquidity_withBorrowUnderMaxLTV() external {
        uint256 collateralAmount = 10 ether;
        uint256 oudBorrowAmount = 1 ether;
        borrow(alice, collateralAmount, 0, oudBorrowAmount, FUNDS_REQUEST_MIN_SECS);

        checkLiquidityStatus(alice, true, false, collateralAmount, 0, oudBorrowAmount);
        checkLiquidityStatus(alice, false, false, collateralAmount, 0, oudBorrowAmount);
    }

    function test_computeLiquidity_withBorrowAtMaxLTV() external {
        uint256 collateralAmount = 10 ether;
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        uint256 oudBorrowAmount = maxBorrowInfo.oudMaxBorrow;
        borrow(alice, collateralAmount, 0, oudBorrowAmount, FUNDS_REQUEST_MIN_SECS);

        checkLiquidityStatus(alice, true, false, collateralAmount, 0, oudBorrowAmount);
        checkLiquidityStatus(alice, false, false, collateralAmount, 0, oudBorrowAmount);
    }

    function test_computeLiquidity_withBorrowOverMaxLTV() external {
        uint256 collateralAmount = 10 ether;
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        uint256 oudBorrowAmount = maxBorrowInfo.oudMaxBorrow;
        borrow(alice, collateralAmount, 0, oudBorrowAmount, FUNDS_REQUEST_MIN_SECS);

        vm.prank(executor);
        tlc.setMaxLtvRatio(oudToken, 0.8e18);

        checkLiquidityStatus(alice, true, true, collateralAmount, 0, oudBorrowAmount);
        checkLiquidityStatus(alice, false, true, collateralAmount, 0, oudBorrowAmount);
    }
    
    function test_computeLiquidity_withBorrowAndRequestUnderMaxLTV() external {
        uint256 collateralAmount = 10 ether;
        uint256 oudBorrowAmount = 1 ether;
        borrow(alice, collateralAmount, 0, oudBorrowAmount, FUNDS_REQUEST_MIN_SECS);
        vm.prank(alice);
        tlc.requestBorrow(oudToken, 0.5e18);


        checkLiquidityStatus(alice, true, false, collateralAmount, 0, oudBorrowAmount+0.5e18);
        checkLiquidityStatus(alice, false, false, collateralAmount, 0, oudBorrowAmount);
    }

    function test_computeLiquidity_withBorrowAndRequestAtMaxLTV() external {
        uint256 collateralAmount = 10 ether;
        uint256 oudBorrowAmount = 1 ether;
        borrow(alice, collateralAmount, 0, oudBorrowAmount, FUNDS_REQUEST_MIN_SECS);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        vm.prank(alice);
        tlc.requestBorrow(oudToken, maxBorrowInfo.oudMaxBorrow-oudBorrowAmount);

        checkLiquidityStatus(alice, true, false, collateralAmount, 0, maxBorrowInfo.oudMaxBorrow);
        checkLiquidityStatus(alice, false, false, collateralAmount, 0, oudBorrowAmount);

        // After a day of interest this is now over
        vm.warp(block.timestamp + 86400);
        checkLiquidityStatus(alice, true, true, collateralAmount, 0, 9.000136995684421689e18);
        checkLiquidityStatus(alice, false, false, collateralAmount, 0, 1.000136995684421689e18);
    }

    function test_computeLiquidity_withBorrowAndRequestOverMaxLTV() external {
        uint256 collateralAmount = 10 ether;
        uint256 oudBorrowAmount = 1 ether;
        borrow(alice, collateralAmount, 0, oudBorrowAmount, FUNDS_REQUEST_MIN_SECS);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        vm.prank(alice);
        tlc.requestBorrow(oudToken, maxBorrowInfo.oudMaxBorrow-oudBorrowAmount);

        vm.prank(executor);
        tlc.setMaxLtvRatio(oudToken, 0.8e18);

        checkLiquidityStatus(alice, true, true, collateralAmount, 0, maxBorrowInfo.oudMaxBorrow);
        checkLiquidityStatus(alice, false, false, collateralAmount, 0, oudBorrowAmount);
    }

    function test_computeLiquidity_withBorrowAndRequestOverMaxLTV_afterRepayOK() external {
        uint256 collateralAmount = 10 ether;
        uint256 oudBorrowAmount = 8 ether;
        borrow(alice, collateralAmount, 0, oudBorrowAmount, FUNDS_REQUEST_MIN_SECS);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        vm.prank(alice);
        tlc.requestBorrow(oudToken, maxBorrowInfo.oudMaxBorrow-oudBorrowAmount);

        vm.prank(executor);
        tlc.setMaxLtvRatio(oudToken, 0.8e18);

        vm.startPrank(alice);
        oudToken.approve(address(tlc), maxBorrowInfo.oudMaxBorrow/2);
        tlc.repay(oudToken, maxBorrowInfo.oudMaxBorrow/2, alice);

        checkLiquidityStatus(alice, true, false, collateralAmount, 0, maxBorrowInfo.oudMaxBorrow/2);
        checkLiquidityStatus(alice, false, false, collateralAmount, 0, oudBorrowAmount-maxBorrowInfo.oudMaxBorrow/2);
    }

    function test_computeLiquidity_afterRepayAll() external {
        uint256 collateralAmount = 10 ether;
        uint256 oudBorrowAmount = 8 ether;
        borrow(alice, collateralAmount, 0, oudBorrowAmount, FUNDS_REQUEST_MIN_SECS);
        MaxBorrowInfo memory maxBorrowInfo = expectedMaxBorrows(collateralAmount);
        vm.prank(alice);
        tlc.requestBorrow(oudToken, maxBorrowInfo.oudMaxBorrow-oudBorrowAmount);

        vm.prank(executor);
        tlc.setMaxLtvRatio(oudToken, 0.8e18);

        vm.startPrank(alice);
        oudToken.approve(address(tlc), oudBorrowAmount);
        tlc.repayAll(oudToken, alice);

        checkLiquidityStatus(alice, true, false, collateralAmount, 0, maxBorrowInfo.oudMaxBorrow-oudBorrowAmount);
        checkLiquidityStatus(alice, false, false, collateralAmount, 0, 0);

        tlc.cancelBorrowRequest(alice, oudToken);
        checkLiquidityStatus(alice, true, false, collateralAmount, 0, 0);
        checkLiquidityStatus(alice, false, false, collateralAmount, 0, 0);

        tlc.requestRemoveCollateral(collateralAmount);
        checkLiquidityStatus(alice, true, false, 0, 0, 0);
        checkLiquidityStatus(alice, false, false, collateralAmount, 0, 0);

        vm.warp(block.timestamp + FUNDS_REQUEST_MIN_SECS);
        tlc.removeCollateral(alice);
        checkLiquidityStatus(alice, true, false, 0, 0, 0);
        checkLiquidityStatus(alice, false, false, 0, 0, 0);
    }
}

contract TempleLineOfCreditTestCheckLiquidityBoth is TlcBaseTest {
    // @todo add in tests after liquidation

    function test_computeLiquidity_eitherOver_thenCanLiquidate() external {
        uint256 collateralAmount = 10 ether;
        uint256 daiBorrowAmount = 7 ether;
        borrow(alice, collateralAmount, daiBorrowAmount, 0, FUNDS_REQUEST_MIN_SECS);

        uint256 oudBorrowAmount = 7 ether;
        vm.startPrank(alice);
        tlc.requestBorrow(oudToken, oudBorrowAmount);
        vm.warp(block.timestamp + FUNDS_REQUEST_MIN_SECS);
        tlc.borrow(oudToken, alice);

        // A few seconds of interest on DAI as time was warped in the OUD borrow request.
        uint256 expectedDaiDebt = 7.000000665957455989e18;
        checkLiquidityStatus(alice, true, false, collateralAmount, expectedDaiDebt, oudBorrowAmount);
        checkLiquidityStatus(alice, false, false, collateralAmount, expectedDaiDebt, oudBorrowAmount);


        tlc.requestBorrow(daiToken, 1 ether);
        tlc.requestBorrow(oudToken, 1 ether);
        checkLiquidityStatus(alice, true, false, collateralAmount, expectedDaiDebt+1e18, oudBorrowAmount+1e18);
        checkLiquidityStatus(alice, false, false, collateralAmount, expectedDaiDebt, oudBorrowAmount);

        // Lower the DAI LTV
        changePrank(executor);
        tlc.setMaxLtvRatio(daiToken, 0.75e18);
        checkLiquidityStatus(alice, true, true, collateralAmount, expectedDaiDebt+1e18, oudBorrowAmount+1e18);
        checkLiquidityStatus(alice, false, false, collateralAmount, expectedDaiDebt, oudBorrowAmount);
        tlc.setMaxLtvRatio(daiToken, daiMaxLtvRatio);

        // Lower the OUD LTV
        tlc.setMaxLtvRatio(oudToken, 0.75e18);
        checkLiquidityStatus(alice, true, true, collateralAmount, expectedDaiDebt+1e18, oudBorrowAmount+1e18);
        checkLiquidityStatus(alice, false, false, collateralAmount, expectedDaiDebt, oudBorrowAmount);
        tlc.setMaxLtvRatio(oudToken, oudMaxLtvRatio);

        // Back healthy after the LTV was put back
        checkLiquidityStatus(alice, true, false, collateralAmount, expectedDaiDebt+1e18, oudBorrowAmount+1e18);
        checkLiquidityStatus(alice, false, false, collateralAmount, expectedDaiDebt, oudBorrowAmount);
    }

}