pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later

import "./ZapBaseV2_3.sol";

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

interface IUniswapV2Pair {
  function token0() external view returns (address);
  function token1() external view returns (address);
  function getReserves() external view returns (uint112, uint112, uint32);
}


contract TempleCoreStaxZaps is ZapBaseV2_3 {
  
  address public constant FRAX = 0x853d955aCEf822Db058eb8505911ED77F175b99e;
  address public immutable temple;
  IFaith public immutable faith;
  IVaultProxy public immutable vaultProxy;
  ITempleStableRouter public templeRouter;

  uint256 private constant DEADLINE = 0xf000000000000000000000000000000000000000000000000000000000000000;

  mapping(address => bool) public permittableTokens;
  mapping(address => bool) public supportedStables;

  event ZappedIn(address indexed sender, address fromToken, uint256 fromAmount, uint256 amountReceived);
  event TempleRouterSet(address router);
  event ZappedInLP(address indexed sender, address fromToken, uint256 fromAmount, uint256 amountA, uint256 amountB);
  event ZappedTemplePlusFaithInVault(address indexed sender, address fromToken, uint256 fromAmount, uint112 faithAmount, uint256 boostedAmount);
  event TokenRecovered(address token, address to, uint256 amount);
  event ZappedTempleInVault(address indexed sender, address fromToken, uint256 fromAmount, uint256 templeAmount);

  constructor(
    address _temple,
    address _faith,
    address _templeRouter,
    address _vaultProxy
  ) {
    temple = _temple;
    templeRouter = ITempleStableRouter(_templeRouter);
    faith = IFaith(_faith);
    vaultProxy = IVaultProxy(_vaultProxy);
  }

  /**
   * @dev set temple router
   * @param _router router to set
   */
  function setTempleRouter(address _router) external onlyOwner {
    templeRouter = ITempleStableRouter(_router);

    emit TempleRouterSet(_router);
  }

  /**
   * @dev set permittable tokens
   * @param _tokens tokens to permit
   * @param _isPermittable to permit or not
   */
  function setPermittableTokens(
    address[] calldata _tokens,
    bool[] calldata _isPermittable
  ) external onlyOwner {
    uint256 _length = _isPermittable.length;
    require(_tokens.length == _length, 'Invalid Input length');

    for (uint256 i = 0; i < _length; i++) {
      permittableTokens[_tokens[i]] = _isPermittable[i];
    }
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

  /**
   * @notice This function zaps ETH and ERC20 tokens to Temple token
   * @param fromToken The token used for entry (address(0) if ether)
   * @param fromAmount The amount of fromToken to zap
   * @param minTempleReceived The minimum acceptable quantity of TEMPLE to receive
   * @param swapTarget Execution target for the swap
   * @param swapData DEX data
   * @return amountTemple Quantity of Temple received
   */
  function zapIn(
    address fromToken,
    uint256 fromAmount,
    uint256 minTempleReceived,
    address stableToken,
    address swapTarget,
    bytes calldata swapData
  ) external payable whenNotPaused returns (uint256 amountTemple) {
    require(permittableTokens[fromToken] == true, "Zaps unsupported for this token");
    amountTemple = _zapIn(
      fromToken,
      fromAmount,
      minTempleReceived,
      DEADLINE,
      stableToken,
      msg.sender,
      swapTarget,
      swapData
    );
  }

  /**
   * @notice zap to temple and deposit in vault
   * @param _fromToken token to zap from
   * @param _fromAmount amount of fromToken to zap
   * @param _stableToken stable token
   * @param _swapTarget target to execute swap data
   * @param _swapData swap data to execute
   */
  function zapInLP(
    address _fromToken,
    uint256 _fromAmount,
    address _stableToken,
    address _swapTarget,
    bytes memory _swapData
  ) external payable whenNotPaused {
    require(permittableTokens[_fromToken] == true, "Zaps unsupported for this token");
    require(supportedStables[_stableToken], "Unsupported stable token");
    // pull tokens
    _pullTokens(_fromToken, _fromAmount);

    (uint256 amountA, uint256 amountB) = _performZapInLP(
      _fromToken,
      _fromAmount,
      _stableToken,
      msg.sender,
      _swapTarget,
      _swapData
    );

    emit ZappedInLP(msg.sender, _fromToken, _fromAmount, amountA, amountB);
  }

  /**
   * @notice zap to temple and deposit in vault
   * @param _fromToken token to zap from
   * @param _fromAmount amount of fromToken to zap
   * @param _minTempleReceived The minimum acceptable quantity of TEMPLE to receive
   * @param _stableToken stable token 
   * @param _vault deposit vault
   * @param _swapTarget target to execute swap data
   * @param _swapData swap data to execute
   */
  function zapInVault(
    address _fromToken,
    uint256 _fromAmount,
    uint256 _minTempleReceived,
    address _stableToken,
    address _vault,
    address _swapTarget,
    bytes calldata _swapData
  ) external payable whenNotPaused {
    require(permittableTokens[_fromToken] == true, "Zaps unsupported for this token");
    require(supportedStables[_stableToken], "Unsupported stable token");
    uint256 templeBefore = IERC20(temple).balanceOf(address(this));
    _zapIn(
      _fromToken,
      _fromAmount,
      _minTempleReceived,
      DEADLINE,
      _stableToken,
      address(this),
      _swapTarget,
      _swapData
    );

    uint256 templeReceived = IERC20(temple).balanceOf(address(this)) - templeBefore;
    require(templeReceived >= _minTempleReceived, "Not enough temple received");

    // approve and deposit for user
    _approveToken(temple, _vault, templeReceived);
    IVault(_vault).depositFor(msg.sender, templeReceived);

    emit ZappedTempleInVault(msg.sender, _fromToken, _fromAmount, templeReceived);
  }

  /**
   * @notice zap to temple+faith and deposit in vault
   * @param vault vault to deposit
   * @param fromToken token to zap from
   * @param fromAmount amount of fromToken to zap
   * @param minTempleReceived The minimum acceptable quantity of TEMPLE to receive
   * @param stableToken stable token 
   * @param swapTarget target to execute swap data
   * @param swapData swap data to execute
   */
  function zapTempleFaithInVault(
    address vault,
    address fromToken,
    uint256 fromAmount,
    uint256 minTempleReceived,
    address stableToken,
    address swapTarget,
    bytes calldata swapData
  ) external payable whenNotPaused {
    require(permittableTokens[fromToken] == true, "Zaps unsupported for this token");
    require(vaultProxy.faithClaimEnabled(), "VaultProxy: Faith claim no longer enabled");
    // pull temple
    uint256 receivedTempleAmount;
    if (fromToken == temple) {
      _pullTokens(temple, fromAmount);
      receivedTempleAmount = fromAmount;
    } else {
      receivedTempleAmount = _zapIn(
        fromToken,
        fromAmount,
        minTempleReceived,
        DEADLINE,
        stableToken,
        address(this),
        swapTarget,
        swapData
      );
    }

    // using user's total available faith
    uint112 faithAmount = (faith.balances(msg.sender)).usableFaith;
    faith.redeem(msg.sender, faithAmount);

    // approve boosted amount
    // note: requires this contract is prefunded to account for boost amounts, similar to vault proxy
    uint256 boostedAmount = vaultProxy.getFaithMultiplier(faithAmount, receivedTempleAmount);
    require(boostedAmount <= IERC20(temple).balanceOf(address(this)));
    _approveToken(temple, vault, boostedAmount);

    // deposit for user
    IVault(vault).depositFor(msg.sender, boostedAmount);

    emit ZappedTemplePlusFaithInVault(msg.sender, fromToken, fromAmount, faithAmount, boostedAmount);
  }

  function _zapIn(
    address fromToken,
    uint256 fromAmount,
    uint256 minTempleReceived,
    uint256 ammDeadline,
    address _stableToken,
    address templeReceiver,
    address swapTarget,
    bytes calldata swapData
  ) internal returns (uint256) {
    require(supportedStables[_stableToken], "Unsupported stable token");

    _pullTokens(fromToken, fromAmount);

    uint256 stableAmountBought = _fillQuote(
      fromToken,
      fromAmount,
      _stableToken,
      swapTarget,
      swapData
    );

    uint256 amountTemple = _enterTemple(_stableToken, templeReceiver, stableAmountBought, minTempleReceived, ammDeadline);
    
    emit ZappedIn(msg.sender, fromToken, fromAmount, amountTemple);

    return amountTemple;
  }

  /**
   * @notice This function swaps FRAX for TEMPLE
   * @param _stableToken stable token 
   * @param _amountStable The amount of FRAX to swap
   * @param _minTempleReceived The minimum acceptable quantity of TEMPLE to receive
   * @param _ammDeadline deadline after which swap will not be executed
   * @return templeAmountReceived Quantity of TEMPLE received
   */
  function _enterTemple(
    address _stableToken,
    address _templeReceiver,
    uint256 _amountStable,
    uint256 _minTempleReceived,
    uint256 _ammDeadline
  ) internal returns (uint256 templeAmountReceived) {
    uint256 templeBefore = IERC20(temple).balanceOf(address(this));
    _approveToken(_stableToken, address(templeRouter), _amountStable);

    templeRouter
      .swapExactStableForTemple(
        _amountStable,
        _minTempleReceived,
        _stableToken,
        _templeReceiver,
        _ammDeadline
      );
    // stableswap amm router has a shadowed declaration and so no value is returned after swapExactStableForTemple
    // using calculation below instead
    if (_templeReceiver == address(this)) {
      templeAmountReceived = IERC20(temple).balanceOf(address(this)) - templeBefore;
      require(templeAmountReceived >= _minTempleReceived, "Not enough temple tokens received");
    }
  }

  function _fillQuote(
    address _fromToken,
    uint256 _amount,
    address _stableToken,
    address _swapTarget,
    bytes memory _swapData
  ) internal returns (uint256 amountBought) {
    if (supportedStables[_fromToken]) {
      return _amount;
    }

    uint256 valueToSend;
    if (_fromToken == address(0)) {
        require(
            _amount > 0 && msg.value == _amount,
            "Invalid _amount: Input ETH mismatch"
        );
        valueToSend = _amount;
    } else {
        _approveToken(_fromToken, _swapTarget, _amount);
    }

    // use supported private AMM stable token
    uint256 initialBalance = _getBalance(_stableToken);

    require(approvedTargets[_swapTarget], "Target not Authorized");
    (bool success,) = _swapTarget.call{value: valueToSend}(_swapData);
    require(success, "Error Swapping Tokens");
    
    unchecked {
      amountBought = _getBalance(_stableToken) - initialBalance;
    }
    require(amountBought > 0, "Swapped To Invalid Token");
  }

  function _performZapInLP(
    address _fromAddress,
    uint256 _fromAmount,
    address _stableToken,
    address _liquidityReceiver,
    address _swapTarget,
    bytes memory _swapData
  ) internal returns (uint256, uint256) {
    address intermediateToken;
    uint256 intermediateAmount;
    // get pair tokens supporting stable coin
    address pair = templeRouter.tokenPair(_stableToken);
    address token0 = IUniswapV2Pair(pair).token0();
    address token1 = IUniswapV2Pair(pair).token1();

    if (_fromAddress != token0 && _fromAddress != token1) {
      // swap to intermediate. uses stable token
      intermediateToken = _stableToken;
      intermediateAmount = _fillQuote(
        _fromAddress,
        _fromAmount,
        _stableToken,
        _swapTarget,
        _swapData
      );
    } else {
        intermediateToken = _fromAddress;
        intermediateAmount = _fromAmount;
    }
  
    (uint256 amountA, uint256 amountB) = _swapTokens(pair, _stableToken, intermediateToken, intermediateAmount);

    _approveToken(token1, address(templeRouter), amountB);
    _approveToken(token0, address(templeRouter), amountA);

    // add LP
    return  _addLiquidity(_stableToken, pair, _liquidityReceiver, amountA, amountB);
  }

  function _swapTokens(
    address _pair,
    address _stableToken,
    address _intermediateToken,
    uint256 _intermediateAmount
  ) internal returns (uint256 amountA, uint256 amountB) {
    // divide token and swap other half. making sure there's no residual tokens
    // at this point, intermediate token could be temple or frax
    address token0 = IUniswapV2Pair(_pair).token0();
    uint256 intermediateAmountToSwap = _intermediateAmount / 2;
    unchecked {
      _intermediateAmount -= intermediateAmountToSwap;
    }
    uint256 amountOut;
    if (_intermediateToken == temple) {
      (,uint256 otherTokenAmountOutMin) = templeRouter.swapExactTempleForStableQuote(_pair, intermediateAmountToSwap);
      _approveToken(temple, address(templeRouter), intermediateAmountToSwap);

      amountOut = templeRouter.swapExactTempleForStable(intermediateAmountToSwap, otherTokenAmountOutMin, _stableToken, address(this), DEADLINE);
      amountA = token0 == _stableToken ? amountOut : _intermediateAmount;
      amountB = token0 == _stableToken ? _intermediateAmount : amountOut;
    } else if (_intermediateToken == _stableToken) {
      uint256 otherTokenAmountOutMin = templeRouter.swapExactStableForTempleQuote(_pair, intermediateAmountToSwap);
      _approveToken(_stableToken, address(templeRouter), intermediateAmountToSwap);

      amountOut = templeRouter.swapExactStableForTemple(intermediateAmountToSwap, otherTokenAmountOutMin, _stableToken, address(this), DEADLINE);
      amountA = token0 == _stableToken ? _intermediateAmount : amountOut;
      amountB = token0 == _stableToken ? amountOut : _intermediateAmount;
    } else {
      revert("Unsupported token for LP addition");
    }
  }

  function _addLiquidity(
    address _stableToken,
    address _pair,
    address _liquidityReceiver,
    uint256 _amountA,
    uint256 _amountB
  ) internal returns (uint256 amountA, uint256 amountB) {
    // avoid stack too deep
    {
      // get minimum amounts to use in liquidity addition. use optimal amounts as minimum
      (uint256 amountAMin, uint256 amountBMin) = _addLiquidityGetMinAmounts(_amountA, _amountB, IUniswapV2Pair(_pair));
      ( amountA, amountB,) = templeRouter.addLiquidity(
        _amountA,
        _amountB,
        amountAMin,
        amountBMin,
        _stableToken,
        _liquidityReceiver,
        DEADLINE
      );
    }

    // transfer residual
    bool token0IsTemple = IUniswapV2Pair(_pair).token0() == temple;
    _transferResidual(_liquidityReceiver, _stableToken, _amountA, _amountB, amountA, amountB, token0IsTemple);
  }

  function _transferResidual(
    address _liquidityReceiver,
    address _stableToken,
    uint256 _amountA,
    uint256 _amountB,
    uint256 _amountAActual,
    uint256 _amountBActual,
    bool _token0IsTemple
  ) internal {
    if (_amountA > _amountAActual) {
      if (_token0IsTemple) {
        _transferToken(IERC20(temple), _liquidityReceiver, _amountA - _amountAActual);
      } else {
        _transferToken(IERC20(_stableToken), _liquidityReceiver, _amountA - _amountAActual);
      }
    }

    if (_amountB > _amountBActual) {
      if (_token0IsTemple) {
        _transferToken(IERC20(_stableToken), _liquidityReceiver, _amountB - _amountBActual);
      } else {
        _transferToken(IERC20(temple), _liquidityReceiver, _amountB - _amountBActual);
      }
    }
  }

  /**
    @dev Transfers tokens from msg.sender to this contract
    @dev If native token, use msg.value
    @dev For use with Zap Ins
    @param token The ERC20 token to transfer to this contract (0 address if ETH)
    @return Quantity of tokens transferred to this contract
     */
  function _pullTokens(
    address token,
    uint256 amount
  ) internal returns (uint256) {
    if (token == address(0)) {
      require(msg.value > 0, "No ETH sent");
      return msg.value;
    }

    require(amount > 0, "Invalid token amount");
    require(msg.value == 0, "ETH sent with token");

    SafeERC20.safeTransferFrom(
      IERC20(token),
      msg.sender,
      address(this),
      amount
    );

    return amount;
  }

  /** 
    * given some amount of an asset and pair reserves, returns an equivalent amount of the other asset
    *
    * Direct copy of UniswapV2Library.quote(amountA, reserveA, reserveB) - can't use as directly as it's built off a different version of solidity
    */
  function _quote(uint amountA, uint reserveA, uint reserveB) internal pure returns (uint amountB) {
    require(reserveA > 0 && reserveB > 0, 'Insufficient liquidity');
    amountB = (amountA * reserveB) / reserveA;
  }

  function _addLiquidityGetMinAmounts(
    uint amountADesired,
    uint amountBDesired,
    IUniswapV2Pair pair
  ) internal view returns (uint amountA, uint amountB) {
    (uint reserveA, uint reserveB,) = pair.getReserves();
    if (reserveA == 0 && reserveB == 0) {
      (amountA, amountB) = (amountADesired, amountBDesired);
    } else {
      uint amountBOptimal = _quote(amountADesired, reserveA, reserveB);
      if (amountBOptimal <= amountBDesired) {
          //require(amountBOptimal >= amountBMin, 'TempleStableAMMRouter: INSUFFICIENT_STABLE');
          (amountA, amountB) = (amountADesired, amountBOptimal);
      } else {
          uint amountAOptimal = _quote(amountBDesired, reserveB, reserveA);
          assert(amountAOptimal <= amountADesired);
          //require(amountAOptimal >= amountAMin, 'TempleStableAMMRouter: INSUFFICIENT_TEMPLE');
          (amountA, amountB) = (amountAOptimal, amountBDesired);
      }
    }
  }

  function _transferToken(IERC20 _token, address _to, uint256 _amount) internal {
    uint256 balance = _token.balanceOf(address(this));
    require(_amount <= balance, "not enough tokens");
    SafeERC20.safeTransfer(_token, _to, _amount);
  }
}
