pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later

interface IJoiningFee {
    function hourlyJoiningFee() external view returns (uint256);
}
