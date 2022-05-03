pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later

import "@openzeppelin/contracts/access/Ownable.sol";

import "hardhat/console.sol";

/**
 * @title Configurable joining fee per vault
 * @notice Implementation assumes a default, we can then tweak on a 
 * vault by vault basis
 */
contract JoiningFee is Ownable {
    uint256 public defaultHourlyJoiningFee;
    mapping(address => uint256) public hourlyJoiningFeeFor;

    constructor(uint256 _defaultHourlyJoiningFee) {
        defaultHourlyJoiningFee = _defaultHourlyJoiningFee;
    }

    function calc(
        uint256 firstPeriodStartTimestamp,
        uint256 periodDuration,
        address vault) external view returns (uint256) 
    {
        uint256 feePerHour = hourlyJoiningFeeFor[vault];
        if (feePerHour == 0) { 
            feePerHour = defaultHourlyJoiningFee;
        }

        uint256 numCycles = (block.timestamp - firstPeriodStartTimestamp) / periodDuration;
        // NOTE: divide before fee is the correct setup here, as the fee should be discrete per hour
        return (block.timestamp - (numCycles * periodDuration) - firstPeriodStartTimestamp) / 3600 * feePerHour;
    }

    function setHourlyJoiningFeeFor(address vault, uint256 amount) external onlyOwner {
        if (vault == address(0x0)) {
            defaultHourlyJoiningFee = amount;
        } else {
            hourlyJoiningFeeFor[vault] = amount;
        }

        emit SetJoiningFee(vault, amount);
    }

    event SetJoiningFee(address vault, uint256 amount);
}