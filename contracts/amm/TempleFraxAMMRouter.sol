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

contract TempleFraxAMMRouter is Ownable, AccessControl {
    bytes32 public constant CAN_ADD_ALLOWED_USER = keccak256("CAN_ADD_ALLOWED_USER");

    // precondition token0/tokenA is temple. token1/tokenB is frax
    IUniswapV2Pair public immutable pair;

    TempleERC20Token public immutable templeToken;
    IERC20 public immutable fraxToken;
    ITempleTreasury public immutable templeTreasury;

    // Address all frax earned via protocol mint is sent
    address protocolMintEarningsAccount;

    struct Price {
        uint frax;
        uint temple;
    }

    // some portion of all buys above threshold get minted on protocol
    Price public dynamicThresholdPrice; 

    // Rate at which threshold decays, when AMM price is below the dynamicThresholdPrice
    uint256 public dynamicThresholdDecayPerBlock;

    // Checkpoint for when price fell below threshold
    uint public priceCrossedBelowDynamicThresholdBlock;

    // Percentage (represented as an int from 0 to 100) 
    uint constant public DYNAMIC_THRESHOLD_INCREASE_DENOMINATOR = 10000;
    uint public dynamicThresholdIncreasePct = DYNAMIC_THRESHOLD_INCREASE_DENOMINATOR;

    // To decide how much we mint on protocol, we linearly interp between these two price points, only when the 
    // market is trading above the dynamicThresholdPrice;
    Price public interpolateFromPrice;
    Price public interpolateToPrice;

    // who's allowed to swap on the AMM. Only used if openAccessEnabled is false;
    mapping(address => bool) public allowed;
    bool public openAccessEnabled = false;

    modifier ensure(uint deadline) {
        require(deadline >= block.timestamp, 'TempleFraxAMMRouter: EXPIRED');
        _;
    }

    event PriceCrossedBelowDynamicThreshold(uint256 blockNumber);
    event DynamicThresholdChange(uint256 currDynamicThresholdTemple);

    constructor(
            IUniswapV2Pair _pair,
            TempleERC20Token _templeToken,
            IERC20 _fraxToken,
            ITempleTreasury _templeTreasury,
            address _protocolMintEarningsAccount,
            Price memory _dynamicThresholdPrice,
            uint256 _dynamicThresholdDecayPerBlock,
            Price memory _interpolateFromPrice,
            Price memory _interpolateToPrice
            ) {

        pair = _pair;
        templeToken = _templeToken;
        fraxToken = _fraxToken;
        templeTreasury = _templeTreasury;
        protocolMintEarningsAccount = _protocolMintEarningsAccount;
        dynamicThresholdPrice = _dynamicThresholdPrice;
        dynamicThresholdDecayPerBlock = _dynamicThresholdDecayPerBlock;
        interpolateFromPrice = _interpolateFromPrice;
        interpolateToPrice = _interpolateToPrice;

        priceCrossedBelowDynamicThresholdBlock = 0;

        _setupRole(DEFAULT_ADMIN_ROLE, owner());
    }

    function setDynamicThresholdDecayPerBlock(uint256 _dynamicThresholdDecayPerBlock) external onlyOwner {
        dynamicThresholdDecayPerBlock = _dynamicThresholdDecayPerBlock;
    }

    // Percentage (represented as an int from 0 to DYNAMIC_THRESHOLD_INCREASE_DENOMINATOR) 
    function setDynamicThresholdIncreasePct(uint256 _dynamicThresholdIncreasePct) external onlyOwner {
        require(_dynamicThresholdIncreasePct > 0 && _dynamicThresholdIncreasePct <= DYNAMIC_THRESHOLD_INCREASE_DENOMINATOR, "Increase is a pct represented as an integer between 0 and 100");
        dynamicThresholdIncreasePct = _dynamicThresholdIncreasePct;
    }

    // To decide how much we mint on protocol, we linearly interp between these two price points, only when the 
    // market is trading above the dynamicThresholdPrice;
    function setInterpolateFromPrice(uint256 frax, uint256 temple) external onlyOwner {
        interpolateFromPrice.frax = frax;
        interpolateFromPrice.temple = temple;
    }

    function setInterpolateToPrice(uint256 frax, uint256 temple) external onlyOwner {
        interpolateToPrice.frax = frax;
        interpolateToPrice.temple = temple;
    }

    function toggleOpenAccess() external onlyOwner {
        openAccessEnabled = !openAccessEnabled;
    }

    function addAllowedUser(address userAddress) external onlyRole(CAN_ADD_ALLOWED_USER) {
      allowed[userAddress] = true;
    }

    function removeAllowedUser(address userAddress) external onlyOwner {
      allowed[userAddress] = false;
    }

    function setProtocolMintEarningsAccount(address _protocolMintEarningsAccount) external onlyOwner {
      protocolMintEarningsAccount = _protocolMintEarningsAccount;
    }

    // **** ADD LIQUIDITY ****
    function _addLiquidity(
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin
    ) internal virtual returns (uint amountA, uint amountB) {
        (uint reserveA, uint reserveB,) = pair.getReserves();
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
    ) external virtual ensure(deadline) returns (uint amountA, uint amountB, uint liquidity) {
        (amountA, amountB) = _addLiquidity(amountADesired, amountBDesired, amountAMin, amountBMin);
        SafeERC20.safeTransferFrom(templeToken, msg.sender, address(pair), amountA);
        SafeERC20.safeTransferFrom(fraxToken, msg.sender, address(pair), amountB);
        liquidity = pair.mint(to);
    }

    // **** REMOVE LIQUIDITY ****
    function removeLiquidity(
        uint liquidity,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) public virtual ensure(deadline) returns (uint amountA, uint amountB) {
        SafeERC20.safeTransferFrom(IERC20(address(pair)), msg.sender, address(pair), liquidity);
        (amountA, amountB) = pair.burn(to);
        require(amountA >= amountAMin, 'TempleFraxAMMRouter: INSUFFICIENT_TEMPLE');
        require(amountB >= amountBMin, 'TempleFraxAMMRouter: INSUFFICIENT_FRAX');
    }

    function swapExactFraxForTemple(
        uint amountIn,
        uint amountOutMin,
        address to,
        uint deadline
    ) external virtual ensure(deadline) returns (uint amountOut) {
        require(allowed[msg.sender] || openAccessEnabled, "Router isn't open access and caller isn't in the allowed list");

        // Check temple out is witamountOutAMMhin acceptable user bounds
        (uint amountInAMM, uint amountInProtocol, uint amountOutAMM, uint amountOutProtocol) = swapExactFraxForTempleQuote(amountIn);
        amountOut = amountOutAMM + amountOutProtocol;

        require(amountOut >= amountOutMin, 'TempleFraxAMMRouter: INSUFFICIENT_OUTPUT_AMOUNT');

        // Swap on AMM
        if (amountInAMM > 0) {
            SafeERC20.safeTransferFrom(fraxToken, msg.sender, address(pair), amountInAMM);
            pair.swap(amountOutAMM, 0, to, new bytes(0));
        }

        // Mint on protocol
        if (amountInProtocol > 0) {
            SafeERC20.safeTransferFrom(fraxToken, msg.sender, protocolMintEarningsAccount, amountInProtocol);
            templeToken.mint(to, amountOutProtocol);

            // gas optimisation. Only update the temple component of the threshold price, keeping the frax component constant
            (uint rt, uint rf,) = pair.getReserves();

            uint newDynamicThresholdPriceTemple = (rt * dynamicThresholdPrice.frax * DYNAMIC_THRESHOLD_INCREASE_DENOMINATOR) / (rf * dynamicThresholdIncreasePct);

            if (priceCrossedBelowDynamicThresholdBlock > 0) { // decay mode
                dynamicThresholdPrice.temple = newDynamicThresholdPriceTemple;
                priceCrossedBelowDynamicThresholdBlock = 0;
            } else if (newDynamicThresholdPriceTemple < dynamicThresholdPrice.temple) { // when not decaying, ensure DTP only ever increases
                dynamicThresholdPrice.temple = newDynamicThresholdPriceTemple;
                emit DynamicThresholdChange(newDynamicThresholdPriceTemple);
            }
        }
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
    ) external virtual ensure(deadline) returns (uint) {
        require(allowed[msg.sender] || openAccessEnabled, "Router isn't open access and caller isn't in the allowed list");

        (bool priceBelowIV, bool willCrossDynamicThreshold, uint amountOut) = swapExactTempleForFraxQuote(amountIn);
        if (priceBelowIV) {
            require(amountOut >= amountOutMin, 'TempleFraxAMMRouter: INSUFFICIENT_OUTPUT_AMOUNT');
            templeToken.burnFrom(msg.sender, amountIn);
            SafeERC20.safeTransfer(fraxToken, to, amountOut);
        } else {
            // only set the threshold price decay if we aren't already in decay mode
            if (willCrossDynamicThreshold && priceCrossedBelowDynamicThresholdBlock == 0) {
                priceCrossedBelowDynamicThresholdBlock = block.number;
                emit PriceCrossedBelowDynamicThreshold(priceCrossedBelowDynamicThresholdBlock);
            }
            
            require(amountOut >= amountOutMin, 'TempleFraxAMMRouter: INSUFFICIENT_OUTPUT_AMOUNT');
            SafeERC20.safeTransferFrom(templeToken, msg.sender, address(pair), amountIn);
            pair.swap(0, amountOut, to, new bytes(0));
        }

        return amountOut;
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

    function mintRatioAt(uint temple, uint frax)
        public
        view
        returns (uint numerator, uint denominator)
    {
        /*
         * Formula used to calculate ratio
         * 
         * ts,fs = temple,frax spot
         * t1,f1 = temple,frax start
         * t2,f2 = temple,frax end
         *
         * (fs/ts - f1/t1) / (f2/t2 - f1/t1)
         *
         * with some algebra this works out to be
         * 
         * ((fs*t1 - f1*ts) * t2) / ((f2*t1 - f1*t2) * ts)
        */

        (uint ts, uint fs, uint t1, uint f1, uint t2, uint f2) = (temple, frax, interpolateFromPrice.temple, interpolateFromPrice.frax, interpolateToPrice.temple, interpolateToPrice.frax);

        uint n1 = fs*t1;
        uint n2 = f1*ts;

        // if spot is below the from price, we don't mint on protocol
        if (n2 > n1) {
            return (0,1);
        }

        numerator = (n1 - n2) * t2;
        denominator = (f2*t1 - f1*t2) * ts; // pre-condition, no overflow as fromPrice will be < toPrice

        if ((numerator * 1000 / 800) >= denominator) {
            return (800,1000); // once we are above the interpolateToPrice, we 100% mint on protocol
        } else {
            return (numerator, denominator);
        }
    }

    function dynamicThresholdPriceWithDecay() public view returns (uint frax, uint temple) {
        uint thresholdDecay = 0;

        if (priceCrossedBelowDynamicThresholdBlock > 0) {
            thresholdDecay = (block.number - priceCrossedBelowDynamicThresholdBlock) * dynamicThresholdDecayPerBlock;
        }

        return (dynamicThresholdPrice.frax, dynamicThresholdPrice.temple + thresholdDecay);
    }

    function swapExactFraxForTempleQuote(uint amountIn) public view returns (uint amountInAMM, uint amountInProtocol, uint amountOutAMM, uint amountOutProtocol) {
        (uint reserveTemple, uint reserveFrax,) = pair.getReserves();
        (uint thresholdPriceFrax, uint thresholdPriceTemple) = dynamicThresholdPriceWithDecay();

        // if AMM is currently trading above target, route some portion to mint on protocol
        if (thresholdPriceTemple * reserveFrax >= thresholdPriceFrax * reserveTemple) {
            (uint numerator, uint denominator) = mintRatioAt(reserveTemple, reserveFrax);
            amountInProtocol = (amountIn * numerator) / denominator;
        }

        amountInAMM = amountIn - amountInProtocol;

        // Allocate a portion of temple to the AMM
        amountOutAMM = 0;
        if (amountInAMM > 0) {
            amountOutAMM = getAmountOut(amountInAMM, reserveFrax, reserveTemple);
        }

        // Allocate a portion of temple to the protocol
        amountOutProtocol = 0;
        if (amountInAMM > 0) {
            amountOutProtocol = (amountInProtocol * amountOutAMM) / amountInAMM;
        } else {
            amountOutProtocol = (amountInProtocol * reserveTemple) / reserveFrax;
        }
    }

    function swapExactTempleForFraxQuote(uint amountIn) public view returns (bool priceBelowIV, bool willCrossDynamicThreshold, uint amountOut) {
        (uint reserveTemple, uint reserveFrax,) = pair.getReserves();
  
        // if AMM is currently trading above target, route some portion to mint on protocol
        (uint256 ivFrax, uint256 ivTemple) = templeTreasury.intrinsicValueRatio();
        priceBelowIV = ivTemple * reserveFrax <= reserveTemple * ivFrax;

        if (priceBelowIV) {
            amountOut = (amountIn * ivFrax) / ivTemple;
        } else {
            amountOut = getAmountOut(amountIn, reserveTemple, reserveFrax);
        }

        // Will this sell move the price from above to below the dynamic threshold?

        if (!priceBelowIV) {
            (uint thresholdPriceFrax, uint thresholdPriceTemple) = dynamicThresholdPriceWithDecay();

            bool currentPriceIsAboveThreshold = thresholdPriceTemple * reserveFrax > thresholdPriceFrax * reserveTemple;
            bool postSellPrieIsBelowThreshold = thresholdPriceTemple * (reserveFrax - amountOut) < thresholdPriceFrax * (reserveTemple + amountIn);
            willCrossDynamicThreshold = currentPriceIsAboveThreshold && postSellPrieIsBelowThreshold;
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