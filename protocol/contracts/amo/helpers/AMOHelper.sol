pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later


import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/AMO__IBalancerVault.sol";


library AMOHelper {
    function createPoolExitRequest(
        address temple,
        address stable,
        uint256 bptAmountIn,
        uint256 tokenIndex,
        uint256 minAmountOut,
        uint256 exitTokenIndex,
        uint256 templeBalancerPoolIndex
    ) internal pure returns (AMO__IBalancerVault.ExitPoolRequest memory request) {
        address[] memory assets = new address[](2);
        uint256[] memory minAmountsOut = new uint256[](2);
        if (templeBalancerPoolIndex == 0) {
            assets[0] = temple;
            assets[1] = stable;
            minAmountsOut[0] = tokenIndex == 0 ? minAmountOut: 0;
            minAmountsOut[1] = tokenIndex == 0 ? 0: minAmountOut;
        } else {
            assets[0] = stable;
            assets[1] = temple;
            minAmountsOut[0] = tokenIndex == 1 ? 0 : minAmountOut;
            minAmountsOut[1] = tokenIndex == 1 ? minAmountOut: 0;
        }
        // EXACT_BPT_IN_FOR_ONE_TOKEN_OUT index is 0 for exitKind
        //uint256 exitTokenIndex = uint256(templeBalancerPoolIndex);
        bytes memory encodedUserdata = abi.encode(uint256(0), bptAmountIn, exitTokenIndex);
        request.assets = assets;
        request.minAmountsOut = minAmountsOut;
        request.userData = encodedUserdata;
        request.toInternalBalance = false;
    }

    function createPoolJoinRequest(
        IERC20 temple,
        IERC20 stable,
        uint256 amountIn,
        uint256 tokenIndex,
        uint256 minTokenOut,
        uint256 templeBalancerPoolIndex
    ) internal pure returns (AMO__IBalancerVault.JoinPoolRequest memory request) {
        IERC20[] memory assets = new IERC20[](2);
        uint256[] memory maxAmountsIn = new uint256[](2);
        if (templeBalancerPoolIndex == 0) {
            assets[0] = temple;
            assets[1] = stable;
            maxAmountsIn[0] = tokenIndex == 0 ? amountIn: 0;
            maxAmountsIn[1] = tokenIndex == 0 ? 0 : amountIn;
        } else {
            assets[0] = stable;
            assets[1] = temple;
            maxAmountsIn[0] = tokenIndex == 1 ? 0 : amountIn;
            maxAmountsIn[1] = tokenIndex == 1 ? amountIn : 0;
        }
        //uint256 joinKind = 1; //EXACT_TOKENS_IN_FOR_BPT_OUT
        bytes memory encodedUserdata = abi.encode(uint256(1), maxAmountsIn, minTokenOut);
        request.assets = assets;
        request.maxAmountsIn = maxAmountsIn;
        request.userData = encodedUserdata;
        request.fromInternalBalance = false;
    }
}