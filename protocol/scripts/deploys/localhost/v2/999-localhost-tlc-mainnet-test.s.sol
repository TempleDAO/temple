pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later

import "forge-std/script.sol";
import "forge-std/console.sol";

import { TempleLineOfCredit } from "contracts/v2/templeLineOfCredit/TempleLineOfCredit.sol";
import { ITlcDataTypes } from "contracts/interfaces/v2/templeLineOfCredit/ITlcDataTypes.sol";
import { ITempleERC20Token } from "contracts/interfaces/core/ITempleERC20Token.sol";


contract Test is Script, ITlcDataTypes {
    // using Strings for uint256;

    address public accTest = 	   0x71e41D0dFeA7ca196c7B104F01EfFd1102af9694;
    address public overlord = 	   0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
    address public tlcAddress =    0xcbc0A8d5C7352Fe3625614ea343019e6d6b89031;
    address public templeAddress = 0x470EBf5f030Ed85Fc1ed4C2d36B9DD02e77CF1b7;

    TempleLineOfCredit public tlc;
    ITempleERC20Token public templeToken;

    function run() external {
        console.log('msg.sender', msg.sender);
        console.log('address(this)', address(this));
        tlc = TempleLineOfCredit(tlcAddress);
        templeToken = ITempleERC20Token(templeAddress);

        address[] memory accounts = new address[](1);
        accounts[0] = accTest;
        
        _checkAccPosition(accTest);
        // vm.warp(block.timestamp + 100000 days);

        // console.log('After 10000 days');
        // _checkAccPosition(accTest);
        
        vm.prank(overlord);
        LiquidationStatus[] memory status = tlc.computeLiquidity(accounts);
        console.log('hasExceededMaxLtv', status[0].hasExceededMaxLtv);
        
        
        vm.prank(overlord);
        (
            uint256 totalCollateralClaimed,
            uint256 totalDaiDebtWiped
        ) = tlc.batchLiquidate(accounts);
        console.log('totalCollateralClaimed', totalCollateralClaimed);
        console.log('totalDaiDebtWiped', totalDaiDebtWiped);
        console.log('After liquidation');
        _checkAccPosition(accTest);

        uint128 collateralAmount = 50_000e18;
        uint128 daiBorrowAmount = 3_000e18;
        _borrow(accTest, collateralAmount, daiBorrowAmount);
        _checkAccPosition(accTest);
    }

    function _addCollateral(address account, uint128 collateralAmount) internal {
        // deal(address(templeToken), account, collateralAmount);
        vm.startPrank(account);
        templeToken.approve(address(tlc), collateralAmount);
        tlc.addCollateral(collateralAmount, account);
        vm.stopPrank();
    }

    function _borrow(
        address _account, 
        uint128 collateralAmount, 
        uint128 daiBorrowAmount
    ) internal {
        if (collateralAmount > 0) {
            _addCollateral(_account, collateralAmount);
        }
        vm.startPrank(_account);

        if (daiBorrowAmount > 0) tlc.borrow(daiBorrowAmount, _account);

        vm.stopPrank();
    }
        
    function _checkAccPosition(address acc) internal view {
        console.log();
        console.log("**Acc to check %s **", acc);
        AccountPosition memory position = tlc.accountPosition(accTest);
        console.log("\t-collateral:       ", position.collateral);
        console.log("\t-currentDebt:      ", position.currentDebt);
        console.log("\t-maxBorrow:        ", position.maxBorrow);
        console.log("\t-healthFactor:     ", position.healthFactor);
        console.log("\t-loanToValueRatio: ", position.loanToValueRatio);
        console.log("\t-block.timestamp:  ", block.timestamp);
        console.log();
    }

}