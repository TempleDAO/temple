pragma solidity ^0.8.4;

import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol';
import '@uniswap/lib/contracts/libraries/TransferHelper.sol';
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract TempleFraxAMMRouter {
    // precondition token0/tokenA is temple. token1/tokenB is frax
    IUniswapV2Pair public pair;

    IERC20 public templeToken;
    IERC20 public fraxToken;

    modifier ensure(uint deadline) {
        require(deadline >= block.timestamp, 'TempleFraxAMMRouter: EXPIRED');
        _;
    }

    constructor(IUniswapV2Pair _pair, IERC20 _templeToken, IERC20 _fraxToken) public {
        pair = _pair;
        templeToken = _templeToken;
        fraxToken = _fraxToken;
    }

    // **** ADD LIQUIDITY ****
    function _addLiquidity(
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin
    ) internal virtual returns (uint amountA, uint amountB) {
        (uint reserveA, uint reserveB) = pair.getReserves();
        if (reserveA == 0 && reserveB == 0) {
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            uint amountBOptimal = quote(amountADesired, reserveA, reserveB);
            if (amountBOptimal <= amountBDesired) {
                require(amountBOptimal >= amountBMin, 'TempleFraxAMMRouter: INSUFFICIENT_FRAX');
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint amountAOptimal = quote(amountBDesired, reserveB, reserveA);
                assert(amountAOptimal <= amountADesired);
                require(amountAOptimal >= amountAMin, 'TempleFraxAMMRouter: INSUFFICIENT_TEMPLE');
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }
    }
    function addLiquidity(
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external virtual override ensure(deadline) returns (uint amountA, uint amountB, uint liquidity) {
        (amountA, amountB) = _addLiquidity(amountADesired, amountBDesired, amountAMin, amountBMin);
        SafeERC20.safeTransferFrom(templeToken, msg.sender, pair, amountA);
        SafeERC20.safeTransferFrom(fraxToken, msg.sender, pair, amountB);
        liquidity = pair.mint(to);
    }

    // **** REMOVE LIQUIDITY ****
    function removeLiquidity(
        uint liquidity,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) public virtual override ensure(deadline) returns (uint amountA, uint amountB) {
        SafeERC20.safeTransferFrom(pair, msg.sender, pair, liquidity);
        (uint amount0, uint amount1) = pair.burn(to);
        require(amountA >= amountAMin, 'TempleFraxAMMRouter: INSUFFICIENT_TEMPLE');
        require(amountB >= amountBMin, 'TempleFraxAMMRouter: INSUFFICIENT_FRAX');
    }

    function swapExactFraxForTemple(
        uint amountIn,
        uint amountOutMin,
        address to,
        uint deadline
    ) external virtual override ensure(deadline) returns (uint amountOut) {
        (uint reserveA, uint reserveB) = pair.getReserves();
        amountOut = getAmountOut(amountIn, reserveB, reserveA);
        require(amountOut >= amountOutMin, 'TempleFraxAMMRouter: INSUFFICIENT_OUTPUT_AMOUNT');
        SafeERC20.safeTransferFrom(fraxToken, msg.sender, pair, amountIn);
        pair.swap(amountOut, 0, to, new bytes(0));
    }

    // function swapFraxForExactTemple(
    //     uint amountOut,
    //     uint amountInMax,
    //     address to,
    //     uint deadline
    // ) external virtual override ensure(deadline) returns (uint amountIn) {
    //     (uint reserveA, uint reserveB) = pair.getReserves();
    //     amountIn = getAmountIn(amountOut, reserveB, reserveA);
    //     require(amountIn <= amountInMax, 'TempleFraxAMMRouter: EXCESSIVE_INPUT_AMOUNT');
    //     SafeERC20.safeTransferFrom(fraxToken, msg.sender, pair, amountIn);
    //     pair.swap(amountOut, 0, to, new bytes(0));
    // }

    function swapExactTempleForFrax(
        uint amountIn,
        uint amountOutMin,
        address to,
        uint deadline
    ) external virtual override ensure(deadline) returns (uint amountOut) {
        (uint reserveA, uint reserveB) = pair.getReserves();
        amountOut = getAmountOut(amountIn, reserveA, reserveB);
        require(amountOut >= amountOutMin, 'TempleFraxAMMRouter: INSUFFICIENT_OUTPUT_AMOUNT');
        SafeERC20.safeTransferFrom(templeToken, msg.sender, pair, amountIn);
        pair.swap(0, amountOut, to, new bytes(0));
    }

    // function swapTempleForExactFrax(
    //     uint amountOut,
    //     uint amountInMax,
    //     address to,
    //     uint deadline
    // ) external virtual override ensure(deadline) returns (uint amountIn) {
    //     (uint reserveA, uint reserveB) = pair.getReserves();
    //     amountIn = getAmountIn(amountOut, reserveA, reserveB);
    //     require(amountIn <= amountInMax, 'TempleFraxAMMRouter: EXCESSIVE_INPUT_AMOUNT');
    //     SafeERC20.safeTransferFrom(templeToken, msg.sender, pair, amountIn);
    //     pair.swap(0, amountOut, 0, to, new bytes(0));
    // }

    // **** LIBRARY FUNCTIONS ****

    /** 
     * given some amount of an asset and pair reserves, returns an equivalent amount of the other asset
     *
     * Direct copy of UniswapV2Library.quote(amountA, reserveA, reserveB) - can't use as directly as it's built off a different version of solidity
     */
    function quote(uint amountA, uint reserveA, uint reserveB) public pure returns (uint amountB) {
        require(amountA > 0, 'UniswapV2Library: INSUFFICIENT_AMOUNT');
        require(reserveA > 0 && reserveB > 0, 'UniswapV2Library: INSUFFICIENT_LIQUIDITY');
        amountB = amountA.mul(reserveB) / reserveA;

    }

    /**
     * given an input amount of an asset and pair reserves, returns the maximum output amount of the other asset
     *
     * Direct copy of UniswapV2Library.quote(amountA, reserveA, reserveB) - can't use as directly as it's built off a different version of solidity
     */
    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut)
        public
        pure
        returns (uint amountOut)
    {
        require(amountIn > 0, 'UniswapV2Library: INSUFFICIENT_INPUT_AMOUNT');
        require(reserveIn > 0 && reserveOut > 0, 'UniswapV2Library: INSUFFICIENT_LIQUIDITY');
        uint amountInWithFee = amountIn.mul(997);
        uint numerator = amountInWithFee.mul(reserveOut);
        uint denominator = reserveIn.mul(1000).add(amountInWithFee);
        amountOut = numerator / denominator;
    }

    // /**
    //  * given an output amount of an asset and pair reserves, returns a required input amount of the other asset
    //  *
    //  * Direct copy of UniswapV2Library.quote(amountA, reserveA, reserveB) - can't use as directly as it's built off a different version of solidity
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
}