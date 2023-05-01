pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later

import "./AMO__IBalancerVault.sol";

interface AMO__IBalancerHelpers {
    function queryJoin(
        bytes32 poolId,
        address sender,
        address recipient,
        AMO__IBalancerVault.JoinPoolRequest memory request
    ) external returns (uint256 bptOut, uint256[] memory amountsIn);

    function queryExit(
        bytes32 poolId,
        address sender,
        address recipient,
        AMO__IBalancerVault.ExitPoolRequest memory request
    ) external returns (uint256 bptIn, uint256[] memory amountsOut);
}