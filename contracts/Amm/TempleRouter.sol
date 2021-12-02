pragma solidity ^0.8.4;

import './interfaces/IUniswapV2Pair.sol';
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/ITempleTreasury.sol";
import "../TempleERC20Token.sol";

contract TempleRouter {

    IUniswapV2Pair public pairContract;
    ITempleTreasury public templeTreasury;

    IERC20 public  templeToken;
    IERC20 public  pairToken;

    struct Price {
      uint256 numerator;
      uint256 denominator;
    } 
    
    Price public targetPrice;

    uint256 public aboveTargetTreasuryDistributeRatio;

    modifier ensure(uint deadline) {
        require(deadline >= block.timestamp, 'AmmRouter: EXPIRED');
        _;
    }

    constructor(IUniswapV2Pair _pairContract, 
                ITempleTreasury _templeTreasury,
                Price memory _targetPrice,
                uint256  _aboveTargetTreasuryDistributeRatio) public {

        pairContract = _pairContract;
        templeTreasury = _templeTreasury;
        targetPrice = _targetPrice;
        aboveTargetTreasuryDistributeRatio = _aboveTargetTreasuryDistributeRatio;

        templeToken = IERC20(pairContract.token0());
        pairToken = IERC20(pairContract.token1());
    }

    function addLiquidity(
        uint256 amountTempleDesired,
        uint256 amountPairDesired,
        uint256 amountTempleMin,
        uint256 amountPairMin,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint amountA, uint amountB, uint liquidity) {
        (uint256 amountTemple, uint256 amountPair) = _addLiquidity(address(templeToken), address(pairToken), amountTempleDesired, amountPairDesired, amountTempleMin, amountPairMin);
        SafeERC20.safeTransferFrom(templeToken, msg.sender, address(pairContract), amountTemple);
        SafeERC20.safeTransferFrom(pairToken, msg.sender, address(pairContract), amountPair);
        liquidity = pairContract.mint(to);
    }

    function removeLiquidity(
        uint256 liquidity,
        uint256 amountTempleMin,
        uint256 amountPairMin,
        address to,
        uint256 deadline
    ) public virtual ensure(deadline) returns (uint256 amountA, uint256 amountB) {
        pairContract.transferFrom(msg.sender, address(pairContract), liquidity); // send liquidity to pair
        (uint256 amountTemple, uint256 amountPair) = pairContract.burn(to);
        require(amountTemple >= amountTempleMin, 'TempleRouter: INSUFFICIENT_A_AMOUNT');
        require(amountPair >= amountPairMin, 'TempleRouter: INSUFFICIENT_B_AMOUNT');
    }

    function _addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin
    ) private returns (uint256 amountA, uint256 amountB) {
   
        (uint256 reserveA, uint256 reserveB, ) = pairContract.getReserves();
        
        if (reserveA == 0 && reserveB == 0) {
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            uint256 amountBOptimal = quote(amountADesired, reserveA, reserveB);
            if (amountBOptimal <= amountBDesired) {
                require(amountBOptimal >= amountBMin, 'TempleRouter: INSUFFICIENT_B_AMOUNT');
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint256 amountAOptimal = quote(amountBDesired, reserveB, reserveA);
                assert(amountAOptimal <= amountADesired);
                require(amountAOptimal >= amountAMin, 'TempleRouter: INSUFFICIENT_A_AMOUNT');
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }
    }

    function buyTemple(
        uint256 amountIn, // Stablec
        uint256 amountOutMin,
        address to,
        uint256 deadline
    ) ensure(deadline) external {

        (uint256 templeReserve, uint256 pairReserve, ) = pairContract.getReserves();
        if (pairReserve * targetPrice.denominator >= templeReserve * targetPrice.numerator) {
            uint256 treasuryAllocation = amountIn * aboveTargetTreasuryDistributeRatio / 100;
            // Allocate a portion of temple to treasury
            SafeERC20.safeTransferFrom(pairToken, msg.sender, address(templeTreasury), treasuryAllocation);
            uint256 pairOwed = treasuryAllocation * targetPrice.denominator / targetPrice.numerator;
            TempleERC20Token(address(templeToken)).mint(to, pairOwed);

            // Remaining towards amm
            uint256 remainingAllocation = amountIn - treasuryAllocation;
            SafeERC20.safeTransferFrom(pairToken, msg.sender, address(pairContract), remainingAllocation);
            uint256 templeOut = getAmountOut(remainingAllocation, pairReserve, templeReserve);
            require(templeOut + pairOwed >= amountOutMin, 'AmmRouter: HIGH SLIPPAGE');
            pairContract.swap(templeOut, uint256(0), to, new bytes(0));
        } else {
             // Transfer to the pair
            uint256 templeOut = getAmountOut(amountIn, pairReserve, templeReserve);
            require(templeOut >= amountOutMin, 'AmmRouter: HIGH SLIPPAGE');
            SafeERC20.safeTransferFrom(pairToken, msg.sender, address(pairContract), amountIn);
            pairContract.swap(templeOut, uint256(0), to, new bytes(0));
        }
    }

    function sellTemple(
        uint256 amountIn, // Temple
        uint256 amountOutMin,
        address to,
        uint256 deadline
    ) ensure(deadline) external {

        (uint256 templeReserve, uint256 pairReserve, ) = pairContract.getReserves();
        (uint256 _pair, uint256 _temple) = templeTreasury.intrinsicValueRatio();
        if (pairReserve * _temple <= templeReserve * _pair) {
            SafeERC20.safeTransfer(pairToken, to, amountIn * _pair / _temple);
        } else {
             // Transfer to AMM
            uint256 pairOut = getAmountOut(amountIn, templeReserve, pairReserve);
            require(pairOut >= amountOutMin, 'AmmRouter: HIGH SLIPPAGE');
            SafeERC20.safeTransferFrom(pairToken, msg.sender, address(pairContract), amountIn);
            pairContract.swap(uint256(0), pairOut, to, new bytes(0));
        }
    }

    function setTargetPrice(Price memory _targetPrice) external {
        targetPrice  = _targetPrice;
    }

    function setAboveTargetTreasuryDistributeRatio(uint256 _aboveTargetTreasuryDistributeRatio) external {
        aboveTargetTreasuryDistributeRatio  = _aboveTargetTreasuryDistributeRatio;
    }

    // given an input amount of an asset and pair reserves, returns the maximum output amount of the other asset
    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) internal view returns (uint amountOut) {
        require(amountIn > 0, 'UniswapV2Library: INSUFFICIENT_INPUT_AMOUNT');
        require(reserveIn > 0 && reserveOut > 0, 'AmmRouter: INSUFFICIENT_LIQUIDITY');
        uint amountInWithFee = amountIn * 997 ;
        uint numerator = amountInWithFee * reserveOut;
        uint denominator = (reserveIn * 1000) + amountInWithFee;
        amountOut = numerator / denominator;
    }

    // given an output amount of an asset and pair reserves, returns a required input amount of the other asset
    function getAmountIn(uint amountOut, uint reserveIn, uint reserveOut) internal pure returns (uint amountIn) {
        require(amountOut > 0, 'TempleRouter: INSUFFICIENT_OUTPUT_AMOUNT');
        require(reserveIn > 0 && reserveOut > 0, 'TempleRouter: INSUFFICIENT_LIQUIDITY');
        uint numerator = reserveIn * amountOut * 1000;
        uint denominator = (reserveOut - amountOut) * 997;
        amountIn = (numerator / denominator) + 1 ;
    }

    // given some amount of an asset and pair reserves, returns an equivalent amount of the other asset
    function quote(uint amountA, uint reserveA, uint reserveB) internal pure returns (uint amountB) {
        require(amountA > 0, 'TempleRouter: INSUFFICIENT_AMOUNT');
        require(reserveA > 0 && reserveB > 0, 'TempleRouter: INSUFFICIENT_LIQUIDITY');
        amountB = amountA * reserveB  / reserveA;
    }
}