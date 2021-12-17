
pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later

interface ITempleFraxAMMRouter {

    function pair() external returns(address);

    function dynamicThresholdDecayPerBlock() external returns(uint);

    function checkPointBlock() external returns(uint blockNumber);
    
    function addLiquidity(
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB, uint liquidity);


    function swapExactFraxForTemple(
        uint amountIn,
        uint amountOutMin,
        address to,
        uint deadline
    ) external returns (uint amountOut);


    function swapExactTempleForFrax(
        uint amountIn,
        uint amountOutMin,
        address to,
        uint deadline
    ) external returns (uint amountOut);


    function quote(uint amountA, uint reserveA, uint reserveB) external pure returns (uint amountB);

    function mintRatioAt(uint temple, uint frax) external pure returns (uint numerator, uint denominator);

    function dynamicThresholdPriceWithDecay() external view returns (uint frax, uint temple);

}