pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later


interface AMO_IAuraStakingProxy {
    function distribute() external;
    function distributeOther(address _token) external;
    function distribute(uint256 _minOut) external;
}