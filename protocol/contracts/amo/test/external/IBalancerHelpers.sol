pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later


interface IBalancerHelpers {
    struct JoinPoolRequest {
        address[] assets;
        uint256[] maxAmountsIn;
        bytes userData;
        bool fromInternalBalance;
    }

    struct ExitPoolRequest {
        address[] assets;
        uint256[] minAmountsOut;
        bytes userData;
        bool toInternalBalance;
    }
    function queryJoin(
        bytes32 poolId,
        address sender,
        address recipient,
        JoinPoolRequest memory request
    ) external view returns (uint256 bptOut, uint256[] memory amountsIn);

    function queryExit(
        bytes32 poolId,
        address sender,
        address recipient,
        ExitPoolRequest memory request
    ) external view returns (uint256 bptIn, uint256[] memory amountsOut);
}