pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later


interface AMO__IBalancerVotingEscrow {
    function create_lock(uint256 _value, uint256 _unlock_time) external;
}