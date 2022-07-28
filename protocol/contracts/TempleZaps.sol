pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./GenericZap.sol";
import "hardhat/console.sol";

interface ITempleStableRouter {
  function tokenPair(address token) external view returns (address);
  function swapExactStableForTemple(
    uint amountIn,
    uint amountOutMin,
    address stable,
    address to,
    uint deadline
  ) external returns (uint amountOut);
  function swapExactTempleForStable(
    uint amountIn,
    uint amountOutMin,
    address stable,
    address to,
    uint deadline
  ) external returns (uint);
  function addLiquidity(
    uint amountADesired,
    uint amountBDesired,
    uint amountAMin,
    uint amountBMin,
    address stable,
    address to,
    uint deadline
  ) external returns (uint amountA, uint amountB, uint liquidity);
  function swapExactStableForTempleQuote(address pair, uint amountIn) external view returns (uint amountOut);
  function swapExactTempleForStableQuote(address pair, uint amountIn) external view returns (bool priceBelowIV, uint amountOut);
  function quote(uint amountA, uint reserveA, uint reserveB) external pure returns (uint amountB);
}

interface IVaultProxy {
  function getFaithMultiplier(uint256 _amountFaith, uint256 _amountTemple) pure external returns (uint256);
  function faithClaimEnabled() external view returns (bool);
}

interface IVault {
  function depositFor(address _account, uint256 _amount) external; 
}

interface IFaith {
  // User Faith total and usable balance
  struct FaithBalance {
    uint112 lifeTimeFaith;
    uint112 usableFaith;
  } 

  function balances(address user) external view returns (FaithBalance memory);
  function gain(address to, uint112 amount) external;
  function redeem(address to, uint112 amount) external;
}

interface ILockedOGTemple {
  function OG_TEMPLE() external ;
  function withdrawFor(address _staker, uint256 _idx) external; 
}

interface IGenericZaps {
  function zapIn(
    address fromToken,
    uint256 fromAmount,
    address toToken,
    uint256 amountOutMin,
    address swapTarget,
    bytes calldata swapData
  ) external returns (uint256 amountOut);
  function getSwapInAmount(uint256 reserveIn, uint256 userIn) external pure returns (uint256);
}


contract TempleZaps is Ownable {
  using SafeERC20 for IERC20;

  address private constant FRAX = 0x853d955aCEf822Db058eb8505911ED77F175b99e;
  address private constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
  address public immutable temple;
  IFaith public immutable faith;
  IVaultProxy public immutable vaultProxy;
  ITempleStableRouter public templeRouter;
  IGenericZaps public zaps;

  uint256 private constant DEADLINE = 0xf000000000000000000000000000000000000000000000000000000000000000;

  mapping(address => bool) public supportedStables;

  struct TempleLiquidityParams {
    uint256 amountAMin;
    uint256 amountBMin;
    uint256 lpSwapMinAmountOut;
    address stableToken;
    bool transferResidual;
  }

  event SetZaps(address zaps);
  event SetTempleRouter(address router);
  event ZappedTemplePlusFaithInVault(address indexed sender, address fromToken, uint256 fromAmount, uint112 faithAmount, uint256 boostedAmount);
  event ZappedTempleInVault(address indexed sender, address fromToken, uint256 fromAmount, uint256 templeAmount);
  event TokenRecovered(address token, address to, uint256 amount);
  event ZappedInTempleLP(address indexed recipient, address fromAddress, uint256 fromAmount, uint256 amountA, uint256 amountB);

  constructor(
    address _temple,
    address _faith,
    address _templeRouter,
    address _vaultProxy,
    address _zaps
  ) {
    temple = _temple;
    templeRouter = ITempleStableRouter(_templeRouter);
    faith = IFaith(_faith);
    vaultProxy = IVaultProxy(_vaultProxy);
    zaps = IGenericZaps(_zaps);
  }

  function setZaps(address _zaps) external onlyOwner {
    zaps = IGenericZaps(_zaps);

    emit SetZaps(_zaps);
  }

  function setTempleRouter(address _router) external onlyOwner {
    templeRouter = ITempleStableRouter(_router);

    emit SetTempleRouter(_router);
  }

  /**
   * set supported stables. by default these are the stable amm supported stable tokens
   * @param _stables stable tokens to permit
   * @param _supported to support or not
   */
  function setSupportedStables(
    address[] calldata _stables,
    bool[] calldata _supported
  ) external onlyOwner {
    uint _length = _stables.length;
    require(_supported.length == _length, "Invalid Input length");
    for (uint i=0; i<_length; i++) {
      supportedStables[_stables[i]] = _supported[i];
    }
  }

  function zapInTempleFor(
    address _fromToken,
    uint256 _fromAmount,
    uint256 _minTempleReceived,
    address _stableToken,
    uint256 _minStableReceived,
    address _recipient,
    address _swapTarget,
    bytes calldata _swapData
  ) public payable {
    require(supportedStables[_stableToken] == true, "Unsupported stable token");
    // todo: handle when fromToken == ETH. i.e. deposit into weth and update
    SafeERC20.safeTransferFrom(IERC20(_fromToken), msg.sender, address(this), _fromAmount);
    
    // todo: check if _fromToken is ETH and send msg.value
    SafeERC20.safeIncreaseAllowance(IERC20(_fromToken), address(zaps), _fromAmount);
    uint256 amountOut = zaps.zapIn(_fromToken, _fromAmount, _stableToken, _minStableReceived, _swapTarget, _swapData);

    _enterTemple(_stableToken, _recipient, amountOut, _minTempleReceived);
  }

  function zapInTemple(
    address _fromToken,
    uint256 _fromAmount,
    uint256 _minTempleReceived,
    address _stableToken,
    uint256 _minStableReceived,
    address _swapTarget,
    bytes calldata _swapData
  ) external payable {
    zapInTempleFor(_fromToken, _fromAmount, _minTempleReceived, _stableToken, _minStableReceived, msg.sender, _swapTarget, _swapData);
  }

  function zapInTempleLP(
    address _fromAddress,
    uint256 _fromAmount,
    address _swapTarget,
    TempleLiquidityParams memory _params,
    bytes memory _swapData
  ) external payable {
    zapInTempleLPFor(_fromAddress, _fromAmount, msg.sender, _swapTarget, _params, _swapData);
  }

  function zapInTempleLPFor(
    address _fromAddress,
    uint256 _fromAmount,
    address _for,
    address _swapTarget,
    TempleLiquidityParams memory _params,
    bytes memory _swapData
  ) public payable {
    require(supportedStables[_params.stableToken] == true, "Unsupported stable token");
    // pull tokens
    SafeERC20.safeTransferFrom(IERC20(_fromAddress), msg.sender, address(this), _fromAmount);

    // get pair tokens supporting stable coin
    address pair = templeRouter.tokenPair(_params.stableToken);
    address token0 = IUniswapV2Pair(pair).token0();
    address token1 = IUniswapV2Pair(pair).token1();

    if (_fromAddress != token0 && _fromAddress != token1) {
      // swap to intermediate. uses stable token
      // reuse vars

      console.logString("before fill quote");
      console.log("_fromAddress:", _fromAddress);
      console.log("_fromAmount:", _fromAmount);
      console.log("_params.stableToken:", _params.stableToken);
      console.log("_swapTarget:", _swapTarget);
      console.log("balance of from token:", IERC20(_fromAddress).balanceOf(address(this)));
      console.log("balance of stable:", IERC20(_params.stableToken).balanceOf(address(this)));
      _fromAmount = _fillQuote(
        _fromAddress,
        _fromAmount,
        _params.stableToken,
        _swapTarget,
        _swapData
      );
      console.logString("after fillQuote");
      console.log("balance of from token:", IERC20(_fromAddress).balanceOf(address(this)));
      console.log("balance of stable:", IERC20(_params.stableToken).balanceOf(address(this)));

      // Moved this to *after* we've swapped from user provided token (eg FXS) to AMM stable (eg FRAX)
      // The stable token is now the intermediate token.
      _fromAddress = _params.stableToken;
    }
    (uint256 amountA, uint256 amountB) = _swapAMMTokens(pair, _params.stableToken, _fromAddress, _fromAmount, _params.lpSwapMinAmountOut);

    // approve tokens and add liquidity
    {
      _approveToken(token0, address(templeRouter), amountA);
      _approveToken(token1, address(templeRouter), amountB);
    }
  
    _addLiquidity(pair, _for, amountA, amountB, _params);

    emit ZappedInTempleLP(_for, _fromAddress, _fromAmount, amountA, amountB);
  }

  function zapInVaultFor(
    address _fromToken,
    uint256 _fromAmount,
    uint256 _minTempleReceived,
    address _stableToken,
    uint256 _minStableReceived,
    address _vault,
    address _for,
    address _swapTarget,
    bytes calldata _swapData
  ) public payable {
    //require(_for != address(0), "Invalid for address");
    console.logString("stable token zapinvaultfor");
    console.logAddress(_stableToken);
    console.logBool(supportedStables[_stableToken]);

    SafeERC20.safeTransferFrom(IERC20(_fromToken), msg.sender, address(this), _fromAmount);
    uint256 receivedTempleAmount;
    if (_fromToken == temple) {
      receivedTempleAmount = _fromAmount;
    } else if (supportedStables[_fromToken]) {
      // if fromToken is supported stable, enter temple directly
      receivedTempleAmount = _enterTemple(_stableToken, address(this), _fromAmount, _minTempleReceived);
    } else {
      require(supportedStables[_stableToken] == true, "Unsupported stable token");
      IERC20(_fromToken).safeIncreaseAllowance(address(zaps), _fromAmount);

      // after zap in, enter temple from stable token
      uint256 receivedStableAmount = zaps.zapIn(
        _fromToken,
        _fromAmount,
        _stableToken,
        _minStableReceived,
        _swapTarget,
        _swapData
      );
      receivedTempleAmount = _enterTemple(_stableToken, address(this), receivedStableAmount, _minTempleReceived);
    }

    // approve and deposit for user
    if (receivedTempleAmount > 0) {
      IERC20(temple).safeIncreaseAllowance(_vault, receivedTempleAmount);
      IVault(_vault).depositFor(_for, receivedTempleAmount);
      emit ZappedTempleInVault(_for, _fromToken, _fromAmount, receivedTempleAmount);
    }
  }

  function zapInVault(
    address _fromToken,
    uint256 _fromAmount,
    uint256 _minTempleReceived,
    address _stableToken,
    uint256 _minStableReceived,
    address _vault,
    address _swapTarget,
    bytes calldata _swapData
  ) external payable {
    zapInVaultFor(_fromToken, _fromAmount, _minTempleReceived, _stableToken, _minStableReceived, _vault, msg.sender, _swapTarget, _swapData);
  }

  function zapTempleFaithInVault(
    address _vault,
    address _fromToken,
    uint256 _fromAmount,
    uint256 _minTempleReceived,
    address _stableToken,
    uint256 _minStableReceived,
    address _swapTarget,
    bytes calldata _swapData
  ) external {
    require(vaultProxy.faithClaimEnabled(), "VaultProxy: Faith claim no longer enabled");

    SafeERC20.safeTransferFrom(IERC20(_fromToken), msg.sender, address(this), _fromAmount);

    uint256 receivedTempleAmount;
    if (_fromToken == temple) {
      receivedTempleAmount = _fromAmount;
    } else if (supportedStables[_fromToken]) {
      // if fromToken is supported stable, enter temple directly
      receivedTempleAmount = _enterTemple(_stableToken, address(this), _fromAmount, _minTempleReceived);
    } else {
      require(supportedStables[_stableToken] == true, "Unsupported stable token");
      IERC20(_fromToken).safeIncreaseAllowance(address(zaps), _fromAmount);

      // after zap in, enter temple from stable token
      uint256 receivedStableAmount = zaps.zapIn(
        _fromToken,
        _fromAmount,
        _stableToken,
        _minStableReceived,
        _swapTarget,
        _swapData
      );
      receivedTempleAmount = _enterTemple(_stableToken, address(this), receivedStableAmount, _minTempleReceived);
    }

    // using user's total available faith
    uint112 faithAmount = (faith.balances(msg.sender)).usableFaith;
    faith.redeem(msg.sender, faithAmount);

    // approve boosted amount
    // note: requires this contract is prefunded to account for boost amounts, similar to vault proxy
    uint256 boostedAmount = vaultProxy.getFaithMultiplier(faithAmount, receivedTempleAmount);
    require(boostedAmount <= IERC20(temple).balanceOf(address(this)));
    SafeERC20.safeIncreaseAllowance(IERC20(temple), _vault, boostedAmount);

    // deposit for user
    IVault(_vault).depositFor(msg.sender, boostedAmount);

    emit ZappedTemplePlusFaithInVault(msg.sender, _fromToken, _fromAmount, faithAmount, boostedAmount);
  }

  /**
   * @notice recover token or ETH
   * @param _token token to recover
   * @param _to receiver of recovered token
   * @param _amount amount to recover
   */
  function recoverToken(address _token, address _to, uint256 _amount) external onlyOwner {
    require(_to != address(0), "Invalid receiver");
    if (_token == address(0)) {
      // this is effectively how OpenZeppelin transfers eth
      require(address(this).balance >= _amount, "Address: insufficient balance");
      (bool success,) = _to.call{value: _amount}(""); 
      require(success, "Address: unable to send value");
    } else {
      _transferToken(IERC20(_token), _to, _amount);
    }
    
    emit TokenRecovered(_token, _to, _amount);
  }

  function _fillQuote(
    address _fromToken,
    uint256 _fromAmount,
    address _toToken,
    address _swapTarget,
    bytes memory _swapData
  ) internal returns (uint256) {
    if (_swapTarget == WETH) {
      require(_fromToken == WETH, "Invalid from token and WETH target");
      require(
        _fromAmount > 0 && msg.value == _fromAmount,
        "Invalid _amount: Input ETH mismatch"
      );
      IWETH(WETH).deposit{value: _fromAmount}();
      // amountBought = _fromAmount;
      return _fromAmount;
    }

    uint256 amountBought;
    uint256 valueToSend;
    if (_fromToken == address(0)) {
      require(
        _fromAmount > 0 && msg.value == _fromAmount,
        "Invalid _amount: Input ETH mismatch"
      );
      valueToSend = _fromAmount;
    } else {
      // get impl contract as allowance target

      // https://protocol.0x.org/en/latest/advanced/uniswap.html
      //   > This function does not use allowances set on 0x. The msg.sender must have allowances set on Uniswap (or SushiSwap).
      // 
      // This has me confused, because the allowance required or you get an error.
      // Here _swapTarget == 0xdef1c0ded9bec7f1a1670819833240f027b25eff
      // which is the 0x exchange contract
      SafeERC20.safeIncreaseAllowance(IERC20(_fromToken), _swapTarget, _fromAmount);
      //SafeERC20.safeIncreaseAllowance(IERC20(_fromToken), address(0xf9b30557AfcF76eA82C04015D80057Fa2147Dfa9), _fromAmount);
    }

    // to calculate amount received
    uint256 initialBalance = IERC20(_toToken).balanceOf(address(this));
    console.log("_fromToken:", _fromToken);
    console.log("allowance to _swapTarget:", IERC20(_fromToken).allowance(address(this), _swapTarget));
    console.log("balance:", IERC20(_fromToken).balanceOf(address(this)));
    console.log("amount:", _fromAmount);
    (bool success, bytes memory returndata) = _swapTarget.call{value:valueToSend}(_swapData);
    //require(success, "Execute swap failed");
    if (success) {
        //return returndata;
    } else {
        // Look for revert reason and bubble it up if present
        if (returndata.length > 0) {
          // The easiest way to bubble the revert reason is using memory via assembly
          console.logString("return data > 0");
          assembly {
            let returndata_size := mload(returndata)
            revert(add(32, returndata), returndata_size)
          }
        } else {
          revert("Execute swap failed");
        }
      }
    unchecked {
      amountBought = IERC20(_toToken).balanceOf(address(this)) - initialBalance;
    }

    return amountBought;
  }

  function _addLiquidity(
    address _pair,
    address _for,
    uint256 _amountA,
    uint256 _amountB,
    TempleLiquidityParams memory _params
  ) internal {
    console.log("addLiquidity:", _amountA, _amountB);
    console.log("addLiquidity min:", _params.amountAMin, _params.amountBMin);
    (uint256 amountAActual, uint256 amountBActual,) = templeRouter.addLiquidity(
      _amountA,
      _amountB,
      _params.amountAMin,
      _params.amountBMin,
      _params.stableToken,
      _for,
      DEADLINE
    );

    if (_params.transferResidual) {
      if (amountAActual < _amountA) {
        _transferToken(IERC20(IUniswapV2Pair(_pair).token0()), _for, _amountA - amountAActual);
      }

      if(amountBActual < _amountB) {
        _transferToken(IERC20(IUniswapV2Pair(_pair).token1()), _for, _amountB - amountBActual);
      }
    }
  }

  function _approveToken(
    address _token,
    address _spender,
    uint256 _amount
  ) internal {
    SafeERC20.safeIncreaseAllowance(IERC20(_token), _spender, _amount);
  }

  function _swapAMMTokens(
    address _pair,
    address _stableToken,
    address _intermediateToken,
    uint256 _intermediateAmount,
    uint256 _lpSwapMinAmountOut
  ) internal returns (uint256 amountA, uint256 amountB) {
    address token0 = IUniswapV2Pair(_pair).token0();
    uint256 amountToSwap = _getAmountToSwap(_intermediateToken, _pair, _intermediateAmount);
    uint256 remainder = _intermediateAmount - amountToSwap;
    console.log("_swapAMMTokens:", _intermediateAmount, amountToSwap, remainder);

    uint256 amountOut;
    if (_intermediateToken == temple) {
      SafeERC20.safeIncreaseAllowance(IERC20(temple), address(templeRouter), amountToSwap);

      amountOut = templeRouter.swapExactTempleForStable(amountToSwap, _lpSwapMinAmountOut, _stableToken, address(this), type(uint128).max);
      amountA = token0 == _stableToken ? amountOut : remainder;
      amountB = token0 == _stableToken ? remainder : amountOut;
    } else if (_intermediateToken == _stableToken) {
      SafeERC20.safeIncreaseAllowance(IERC20(_stableToken), address(templeRouter), amountToSwap);

      // There's currently a bug in the AMM Router where amountOut is always zero.
      // So have to resort to getting the balance before/after.
      uint256 balBefore = IERC20(temple).balanceOf(address(this));
      /*amountOut = */ templeRouter.swapExactStableForTemple(amountToSwap, _lpSwapMinAmountOut, _stableToken, address(this), type(uint128).max);
      amountOut = IERC20(temple).balanceOf(address(this)) - balBefore;

      amountA = token0 == _stableToken ? remainder : amountOut;
      amountB = token0 == _stableToken ? amountOut : remainder;
    } else {
      revert("Unsupported token of liquidity pool");
    }
  }

  function _getAmountToSwap(
    address _token,
    address _pair,
    uint256 _amount
  ) internal view returns (uint256) {
    address token0 = IUniswapV2Pair(_pair).token0();
    (uint112 reserveA, uint112 reserveB,) = IUniswapV2Pair(_pair).getReserves();
    uint256 reserveIn = token0 == _token ? reserveA : reserveB;
    uint256 amountToSwap = zaps.getSwapInAmount(reserveIn, _amount);
    return amountToSwap;
  }

  /**
   * @notice This function swaps stables for TEMPLE
   * @param _stableToken stable token 
   * @param _amountStable The amount of stable to swap
   * @param _minTempleReceived The minimum acceptable quantity of TEMPLE to receive
   * @return templeAmountReceived Quantity of TEMPLE received
   */
  function _enterTemple(
    address _stableToken,
    address _templeReceiver,
    uint256 _amountStable,
    uint256 _minTempleReceived
  ) internal returns (uint256 templeAmountReceived) {
    uint256 templeBefore = IERC20(temple).balanceOf(address(this));
    SafeERC20.safeIncreaseAllowance(IERC20(_stableToken), address(templeRouter), _amountStable);

    templeRouter
      .swapExactStableForTemple(
        _amountStable,
        _minTempleReceived,
        _stableToken,
        _templeReceiver,
        DEADLINE
      );
    // stableswap amm router has a shadowed declaration and so no value is returned after swapExactStableForTemple
    // using calculation below instead
    if (_templeReceiver == address(this)) {
      templeAmountReceived = IERC20(temple).balanceOf(address(this)) - templeBefore;
      require(templeAmountReceived >= _minTempleReceived, "Not enough temple tokens received");
    }
  }

  function _transferToken(IERC20 _token, address _to, uint256 _amount) internal {
    uint256 balance = _token.balanceOf(address(this));
    require(_amount <= balance, "not enough tokens");
    SafeERC20.safeTransfer(_token, _to, _amount);
  }
}