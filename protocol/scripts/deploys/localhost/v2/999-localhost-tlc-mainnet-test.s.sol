pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import "forge-std/script.sol";
import "forge-std/console.sol";
import "forge-std/StdCheats.sol";

import { TempleLineOfCredit } from "contracts/v2/templeLineOfCredit/TempleLineOfCredit.sol";
import { ITlcDataTypes } from "contracts/interfaces/v2/templeLineOfCredit/ITlcDataTypes.sol";
import { ITempleERC20Token } from "contracts/interfaces/core/ITempleERC20Token.sol";

import "@openzeppelin/contracts/utils/Strings.sol";


contract Test is Script, ITlcDataTypes, StdCheats {
    // using Strings for uint256;

    address public accTest = 	   0x71e41D0dFeA7ca196c7B104F01EfFd1102af9694;
    address public overlord = 	   0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
    address public tlcAddress =    0xcbc0A8d5C7352Fe3625614ea343019e6d6b89031;
    address public templeAddress = 0x470EBf5f030Ed85Fc1ed4C2d36B9DD02e77CF1b7;
    address public daiAddress =    0x6B175474E89094C44Da98b954EedeAC495271d0F;
    address public tvAddress =      0xf359Bae7b6AD295724e798A3Ef6Fa5109919F399;

    TempleLineOfCredit public tlc;
    ITempleERC20Token public templeToken;

    address[] public accsToLiquidate; // storage var to track current accounts to be liquidated

    function run() external {
        tlc = TempleLineOfCredit(tlcAddress);
        templeToken = ITempleERC20Token(templeAddress);

        address[] memory allAccounts = _setupAccsToLiquidate(100);

        _accsToLiq(allAccounts);
        // _checkAccPosition(accsToLiquidate[0]);
        _batchLiquidate(accsToLiquidate);

        vm.warp(block.timestamp + 1 days);
        console.log("\n  *Move forward 1 day to trigger liquidations*\n");
        
        _accsToLiq(allAccounts);
        _batchLiquidate(accsToLiquidate);
    }

    function _addCollateral(address account, uint128 collateralAmount) internal {
        vm.startPrank(account);
        templeToken.approve(address(tlc), collateralAmount);
        tlc.addCollateral(collateralAmount, account);
        vm.stopPrank();
    }


    function _batchLiquidate(address[] memory accs) internal {
        vm.prank(overlord);
        uint256 totalGas;
        uint256 gasStart;
        console.log("\tRunning tlc.batchLiquidate...");
        gasStart = gasleft();
        (
            uint256 totalCollateralClaimed,
            uint256 totalDaiDebtWiped
        ) = tlc.batchLiquidate(accs);
        
        // remove already liquidated accounts from storage var
        delete accsToLiquidate;

        totalGas += (gasStart-gasleft());
        console.log("\t-total gas used          ", totalGas);
        console.log("\t-totalCollateralClaimed  ", totalCollateralClaimed);
        console.log("\t-totalDaiDebtWiped       ", totalDaiDebtWiped);
    }
    function _setupAccsToLiquidate(uint8 qty) internal returns (address[] memory accounts) {
        accounts = new address[](qty+1); // additional array length to add one real acc
        uint128 collateralAmount = 5_000e18;
        uint128 daiBorrowAmount = 4_280e18; // maxLtv
        // mint sufficient dai funds for treasury vault to be able to lend
        deal(daiAddress, tvAddress, daiBorrowAmount*qty);

        for(uint8 i = 0; i < qty; i++) {
            address newAcc = makeAddr(string.concat("testAcc_",Strings.toString(i)));
            // mint temple for newAcc so it can borrow
            deal(templeAddress, newAcc, collateralAmount, true);
            _borrow(newAcc, collateralAmount, daiBorrowAmount);
            accounts[i] = newAcc;
        }
        // add real accTest at the end of array
        accounts[accounts.length-1] = accTest;
    } 

    function _accsToLiq(address[] memory allAccs) internal {
        LiquidationStatus[] memory status = tlc.computeLiquidity(allAccs);
        // console.log("hasExceededMaxLtv acc 0', status[0].hasExceededMaxLt");
        for(uint8 i=0; i<allAccs.length; i++){
            if(status[i].hasExceededMaxLtv){
                accsToLiquidate.push(allAccs[i]);
            }
        }
        console.log("No of accounts to be liquidated", accsToLiquidate.length);
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
        AccountPosition memory position = tlc.accountPosition(acc);
        console.log("\t-collateral:       ", position.collateral);
        console.log("\t-currentDebt:      ", position.currentDebt);
        console.log("\t-maxBorrow:        ", position.maxBorrow);
        console.log("\t-healthFactor:     ", position.healthFactor);
        console.log("\t-loanToValueRatio: ", position.loanToValueRatio);
        console.log("\t-block.timestamp:  ", block.timestamp);
        console.log();
    }

}