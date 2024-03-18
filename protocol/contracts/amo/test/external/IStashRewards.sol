pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later


interface AMO__IAuraStashRewards {
    function stashRewards() external returns (bool);
    function processStash() external returns (bool);
    function claimRewards() external returns (bool);
    function initialize(uint256 _pid, address _operator, address _staker, address _gauge, address _rewardFactory) external;
}