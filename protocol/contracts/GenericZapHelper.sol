pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later

interface IUniswapV2Pair {
  function token0() external view returns (address);
  function token1() external view returns (address);
  function getReserves() external view returns (uint112, uint112, uint32);
}


library GenericZapHelper {
  /** 
    * given some amount of an asset and pair reserves, returns an equivalent amount of the other asset
    *
    * Direct copy of UniswapV2Library.quote(amountA, reserveA, reserveB) - can't use as directly as it's built off a different version of solidity
    */
  function quote(uint amountA, uint reserveA, uint reserveB) internal pure returns (uint amountB) {
    require(reserveA > 0 && reserveB > 0, 'Insufficient liquidity');
    amountB = (amountA * reserveB) / reserveA;
  }

  function calculateSwapInAmount(
    uint256 reserveIn,
    uint256 userIn
  ) internal pure returns (uint256) {
    return
        (sqrt(
            reserveIn * ((userIn * 3988000) + (reserveIn * 3988009))
        ) - (reserveIn * 1997)) / 1994;
  }

  function getSwapAmount(uint256 amountA, uint256 reserveA) internal pure returns (uint256) {
    return (sqrt(amountA * ((reserveA * 3988000) + (amountA * 3988009))) - (amountA * 1997)) / 1994;
  }

  // borrowed from Uniswap V2 Core Math library https://github.com/Uniswap/v2-core/blob/master/contracts/libraries/Math.sol
  // babylonian method (https://en.wikipedia.org/wiki/Methods_of_computing_square_roots#Babylonian_method)
  function sqrt(uint y) internal pure returns (uint z) {
    if (y > 3) {
      z = y;
      uint x = y / 2 + 1;
      while (x < z) {
          z = x;
          x = (y / x + x) / 2;
      }
    } else if (y != 0) {
      z = 1;
    }
  }

  function getPairTokens(
    address _pairAddress
  ) internal view returns (address token0, address token1) {
    IUniswapV2Pair pair = IUniswapV2Pair(_pairAddress);
    token0 = pair.token0();
    token1 = pair.token1();
  }
}