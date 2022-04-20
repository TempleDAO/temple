pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later

import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol';
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

import "../TempleERC20Token.sol";

import "hardhat/console.sol";

interface ITempleTWAP {
    function update() external;
    function consult(uint amountIn) external view;
}

interface ITempleTreasury {
    function intrinsicValueRatio() external view returns (uint256 frax, uint256 temple);
}

contract TempleStableAMMRouter is Ownable {

    // Token to uniswap pair contract mapping
    mapping(address => address) public tokenPair; 

    TempleERC20Token public immutable templeToken;
    IERC20 public immutable fraxToken;
    IERC20 public immutable feiToken;
    ITempleTreasury public immutable templeTreasury;

    modifier ensure(uint deadline) {
        require(deadline >= block.timestamp, 'TempleStableAMMRouter: EXPIRED');
        _;
    }

    constructor(
            TempleERC20Token _templeToken,
            IERC20 _fraxToken,
            IERC20 _feiToken,
            ITempleTreasury _templeTreasury
            ) {

        templeToken = _templeToken;
        fraxToken = _fraxToken;
        feiToken = _feiToken;
        templeTreasury = _templeTreasury;

    }

    function addPair(address _token, address _pair) external onlyOwner {
        tokenPair[_token] = _pair;
    }


    // **** ADD LIQUIDITY ****
    function _addLiquidity(
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        IUniswapV2Pair pair
    ) internal virtual returns (uint amountA, uint amountB) {
        (uint reserveA, uint reserveB,) = pair.getReserves();
        if (reserveA == 0 && reserveB == 0) {
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            uint amountBOptimal = quote(amountADesired, reserveA, reserveB);
            if (amountBOptimal <= amountBDesired) {
                require(amountBOptimal >= amountBMin, 'TempleStableAMMRouter: INSUFFICIENT_STABLE');
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint amountAOptimal = quote(amountBDesired, reserveB, reserveA);
                assert(amountAOptimal <= amountADesired);
                require(amountAOptimal >= amountAMin, 'TempleStableAMMRouter: INSUFFICIENT_TEMPLE');
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }
    }
    function addLiquidity(
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address stablec,
        address to,
        uint deadline
    ) external virtual ensure(deadline) returns (uint amountA, uint amountB, uint liquidity) {
        require(tokenPair[stablec] != address(0), 'TempleStableAMMRouter: UNSUPPORTED_PAIR');
        IUniswapV2Pair pair = IUniswapV2Pair(tokenPair[stablec]);
        (amountA, amountB) = _addLiquidity(amountADesired, amountBDesired, amountAMin, amountBMin, pair);
        SafeERC20.safeTransferFrom(templeToken, msg.sender, address(pair), amountA);
        SafeERC20.safeTransferFrom(IERC20(stablec), msg.sender, address(pair), amountB);
        liquidity = pair.mint(to);
    }

    // **** REMOVE LIQUIDITY ****
    function removeLiquidity(
        uint liquidity,
        uint amountAMin,
        uint amountBMin,
        address stablec,
        address to,
        uint deadline
    ) public virtual ensure(deadline) returns (uint amountA, uint amountB) {
        require(tokenPair[stablec] != address(0), 'TempleStableAMMRouter: UNSUPPORTED_PAIR');
        IUniswapV2Pair pair = IUniswapV2Pair(tokenPair[stablec]);
        SafeERC20.safeTransferFrom(IERC20(address(pair)), msg.sender, address(pair), liquidity);
        (amountA, amountB) = pair.burn(to);
        require(amountA >= amountAMin, 'TempleStableAMMRouter: INSUFFICIENT_TEMPLE');
        require(amountB >= amountBMin, 'TempleFraxAMMRouter: INSUFFICIENT_FRAX');
    }

    function swapExactStablecForTemple(
        uint amountIn,
        uint amountOutMin,
        address stablec,
        address to,
        uint deadline
    ) external virtual ensure(deadline) returns (uint amountOut) {

        require(tokenPair[stablec] != address(0), 'TempleStableAMMRouter: UNSUPPORTED_PAIR');
        address pair = tokenPair[stablec];

        uint amountOut = swapExactStableForTempleQuote(pair, amountIn);
        require(amountOut >= amountOutMin, 'TempleStableAMMRouter: INSUFFICIENT_OUTPUT_AMOUNT');

        // Swap on AMM
        SafeERC20.safeTransferFrom(fraxToken, msg.sender, pair, amountIn);
        IUniswapV2Pair(pair).swap(amountOut, 0, to, new bytes(0));
    }


    function swapExactTempleForStablec(
        uint amountIn,
        uint amountOutMin,
        address stablec,
        address to,
        uint deadline
    ) external virtual ensure(deadline) returns (uint) {
        
        require(tokenPair[stablec] != address(0), 'TempleStableAMMRouter: UNSUPPORTED_PAIR');
        address pair = tokenPair[stablec];


        (bool priceBelowIV, uint amountOut) = swapExactTempleForStableQuote(pair, amountIn);
        if (priceBelowIV) {
            require(amountOut >= amountOutMin, 'TempleStableAMMRouter: INSUFFICIENT_OUTPUT_AMOUNT');
            templeToken.burnFrom(msg.sender, amountIn);
            SafeERC20.safeTransfer(feiToken, to, amountOut); // Send FEI instead of frax if price below IV
        } else {
            
            require(amountOut >= amountOutMin, 'TempleStableAMMRouter: INSUFFICIENT_OUTPUT_AMOUNT');
            SafeERC20.safeTransferFrom(templeToken, msg.sender, pair, amountIn);
            IUniswapV2Pair(pair).swap(0, amountOut, to, new bytes(0));
        }

        return amountOut;
    }


    // **** LIBRARY FUNCTIONS ****

    /** 
     * given some amount of an asset and pair reserves, returns an equivalent amount of the other asset
     *
     * Direct copy of UniswapV2Library.quote(amountA, reserveA, reserveB) - can't use as directly as it's built off a different version of solidity
     */
    function quote(uint amountA, uint reserveA, uint reserveB) public pure returns (uint amountB) {
        require(amountA > 0, 'UniswapV2Library: INSUFFICIENT_AMOUNT');
        require(reserveA > 0 && reserveB > 0, 'UniswapV2Library: INSUFFICIENT_LIQUIDITY');
        amountB = (amountA * reserveB) / reserveA;

    }

    /**
     * given an input amount of an asset and pair reserves, returns the maximum output amount of the other asset
     *
     * Direct copy of UniswapV2Library.getAmountOut
     */
    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut)
        public
        pure
        returns (uint amountOut)
    {
        require(amountIn > 0, 'UniswapV2Library: INSUFFICIENT_INPUT_AMOUNT');
        require(reserveIn > 0 && reserveOut > 0, 'UniswapV2Library: INSUFFICIENT_LIQUIDITY');
        uint amountInWithFee = amountIn * 995;
        uint numerator = amountInWithFee * reserveOut;
        uint denominator = (reserveIn * 1000) + amountInWithFee;
        amountOut = numerator / denominator;
    }

    // /**
    //  * given an output amount of an asset and pair reserves, returns a required input amount of the other asset
    //  *
    //  * Direct copy of UniswapV2Library.getAmountIn
    //  * NOTE: Currently unused (copied in as we need for the swapTokenForTokens variants)
    //  */
    // function getAmountIn(uint amountOut, uint reserveIn, uint reserveOut)
    //     public
    //     pure
    //     returns (uint amountIn)
    // {
    //     require(amountOut > 0, 'UniswapV2Library: INSUFFICIENT_OUTPUT_AMOUNT');
    //     require(reserveIn > 0 && reserveOut > 0, 'UniswapV2Library: INSUFFICIENT_LIQUIDITY');
    //     uint numerator = reserveIn.mul(amountOut).mul(1000);
    //     uint denominator = reserveOut.sub(amountOut).mul(997);
    //     amountIn = (numerator / denominator).add(1);
    // }

    function swapExactStableForTempleQuote(address pair, uint amountIn) public view returns (uint amountOut ) {
        (uint reserveTemple, uint reserveFrax,) = IUniswapV2Pair(pair).getReserves();
        amountOut = getAmountOut(amountIn, reserveFrax, reserveTemple);
    }

    function swapExactTempleForStableQuote(address pair, uint amountIn) public view returns (bool priceBelowIV, uint amountOut) {
        (uint reserveTemple, uint reserveFrax,) = IUniswapV2Pair(pair).getReserves();
  
        // if AMM is currently trading above target, route some portion to mint on protocol
        (uint256 ivFrax, uint256 ivTemple) = templeTreasury.intrinsicValueRatio();

        uint256 amountOutAmm = getAmountOut(amountIn, reserveTemple, reserveFrax);
        uint256 amountOutIvSwap = (amountIn * ivFrax) / ivTemple;

        if (amountOutIvSwap > amountOutAmm) {
            amountOut = amountOutIvSwap;
            priceBelowIV = true;
        } else {
            amountOut = amountOutAmm;
        }
    }

  /**
   * transfer out amount of token to provided address
   */
  function withdraw(address token, address to, uint256 amount) external onlyOwner {
    require(to != address(0), "to address zero");
    if (token == address(0)) {
      (bool sent,) = payable(to).call{value: amount}("");
      require(sent, "send failed");
    } else {
      SafeERC20.safeTransfer(IERC20(token), to, amount);
    }
  }
}