pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later


interface IPoolHelper {

    function getBalances() external view returns (uint256[] memory balances);

    function spotPriceUsingLPRatio() external view returns (uint256 templeBalance, uint256 stableBalance);

    function getSpotPriceScaled() external view returns (uint256 spotPriceScaled);

    function isSpotPriceBelowTPF() external view returns (bool);

    function isSpotPriceBelowTPF(uint256 slippage) external view returns (bool);

    function isSpotPriceAboveTPF(uint256 slippage) external view returns (bool);

    function isSpotPriceAboveTPF() external view returns (bool);

    function getMax(uint256 a, uint256 b) external pure returns (uint256 maxValue);

    // function createPoolExitRequest(
    //     uint256 bptAmountIn,
    //     uint256 tokenIndex,
    //     uint256 minAmountOut
    // ) external view returns (AMO__IBalancerVault.ExitPoolRequest memory request)
}