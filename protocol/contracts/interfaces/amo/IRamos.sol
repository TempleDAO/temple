pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/amo/IRamos.sol)

import { IBalancerVault } from "contracts/interfaces/external/balancer/IBalancerVault.sol";

interface IRamos {
    function setOperator(address operator) external; 

    function bptToken() external view returns (address);

    function poolHelper() external view returns (address);

    function amoStaking() external view returns (address);
    
    function stable() external view returns (address);

    /// @notice Get the quote used to add liquidity proportionally
    /// @dev Since this is not the view function, this should be called with `callStatic`
    function proportionalAddLiquidityQuote(
        uint256 stablesAmount,
        uint256 slippageBps
    ) external returns (
        uint256 templeAmount,
        uint256 expectedBptAmount,
        uint256 minBptAmount,
        IBalancerVault.JoinPoolRequest memory requestData
    );

    function addLiquidity(IBalancerVault.JoinPoolRequest memory request) external;

    /// @notice Get the quote used to remove liquidity
    /// @dev Since this is not the view function, this should be called with `callStatic`
    function proportionalRemoveLiquidityQuote(
        uint256 bptAmount,
        uint256 slippageBps
    ) external returns (
        uint256 expectedTempleAmount,
        uint256 expectedStablesAmount,
        uint256 minTempleAmount,
        uint256 minStablesAmount,
        IBalancerVault.ExitPoolRequest memory requestData
    );
    
    function removeLiquidity(IBalancerVault.ExitPoolRequest memory request, uint256 bptIn, address to) external;

    /**
     * @notice The total amount of Temple and Stables that Ramos holds via it's 
     * staked and unstaked BPT.
     * @dev Calculated by pulling the total balances of each token in the pool
     * and getting RAMOS proportion of the owned BPT's
     */
    function positions() external view returns (
        uint256 bptBalance, 
        uint256 templeBalance, 
        uint256 stableBalance
    );
}