pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later

import "./AMO__IPoolHelper.sol";

interface AMO__IRamos {
    function bptToken() external view returns (address);

    function poolHelper() external view returns (address);

    function amoStaking() external view returns (address);
    
    function stable() external view returns (address);

    function addLiquidity(AMO__IBalancerVault.JoinPoolRequest memory request, uint256 minBptOut) external;

    function removeLiquidity(AMO__IBalancerVault.ExitPoolRequest memory request, uint256 bptIn) external;
}