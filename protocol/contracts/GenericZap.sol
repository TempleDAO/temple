pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later

import "./ZapBaseV2_3.sol";


interface IWETH {
  function deposit() external payable;
}

interface IUniswapV2Pair {
  function token0() external view returns (address);
  function token1() external view returns (address);
  function getReserves() external view returns (uint112, uint112, uint32);
}

interface IUniswapV2Router {
  function addLiquidity(
    address tokenA,
    address tokenB,
    uint amountADesired,
    uint amountBDesired,
    uint amountAMin,
    uint amountBMin,
    address to,
    uint deadline
  ) external returns (uint amountA, uint amountB, uint liquidity);

  function swapExactTokensForTokens(
    uint amountIn,
    uint amountOutMin,
    address[] calldata path,
    address to,
    uint deadline
  ) external returns (uint[] memory amounts);

  function factory() external view returns (address);
}

interface IUniswapV2Factory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

interface ICurvePool {
    function coins(uint256 j) external view returns (address);
    function calc_token_amount(uint256[] calldata _amounts, bool _is_deposit) external view returns (uint256);
    function add_liquidity(uint256[] calldata _amounts, uint256 _min_mint_amount, address destination) external returns (uint256);
    function get_dy(uint256 _from, uint256 _to, uint256 _from_amount) external view returns (uint256);
    function remove_liquidity(uint256 _amount, uint256[2] calldata _min_amounts) external returns (uint256[2] memory);
    function fee() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function exchange(uint256 i, uint256 j, uint256 dx, uint256 min_dy) external returns (uint256);
    function remove_liquidity_imbalance(uint256[2] memory amounts, uint256 _max_burn_amount, address _receiver) external returns (uint256);
}

interface ICurveFactory {
  function get_n_coins(address pool) external view returns (uint256);
}

interface IBalancerVault {
  struct JoinPoolRequest {
    IERC20[] assets;
    uint256[] maxAmountsIn;
    bytes userData;
    bool fromInternalBalance;
  }

  struct SingleSwap {
    bytes32 poolId;
    SwapKind kind;
    IERC20 assetIn;
    IERC20 assetOut;
    uint256 amount;
    bytes userData;
  }

  struct FundManagement {
    address sender;
    bool fromInternalBalance;
    address payable recipient;
    bool toInternalBalance;
  }

  enum SwapKind { GIVEN_IN, GIVEN_OUT }

  function swap(
      SingleSwap memory singleSwap,
      FundManagement memory funds,
      uint256 limit,
      uint256 deadline
  ) external payable returns (uint256 amountCalculated);

  function joinPool(
      bytes32 poolId,
      address sender,
      address recipient,
      JoinPoolRequest memory request
  ) external payable;

  function getPoolTokens(
    bytes32 poolId
  ) external view
    returns (
      address[] memory tokens,
      uint256[] memory balances,
      uint256 lastChangeBlock
    );
}


contract GenericZap is ZapBaseV2_3 {

  IUniswapV2Router public uniswapV2Router;

  address private constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
  ICurveFactory private immutable curveFactory = ICurveFactory(0xB9fC157394Af804a3578134A6585C0dc9cc990d4);
  IBalancerVault private immutable balancerVault = IBalancerVault(0xBA12222222228d8Ba445958a75a0704d566BF2C8);
  uint256 private constant DEADLINE = 0xf000000000000000000000000000000000000000000000000000000000000000;

  struct ZapLiquidityRequest {
    uint256 firstSwapMinAmountOut;
    uint248 poolSwapMinAmountOut;
    bool isOneSidedLiquidityAddition;
    address otherToken;
    bytes poolSwapData;
  }

  event ZappedIn(address indexed sender, address fromToken, uint256 fromAmount, address toToken, uint256 amountOut);
  event UniswapV2RouterSet(address router);
  event ZappedLPUniV2(address indexed recipient, address token0, address token1, uint256 amountA, uint256 amountB);
  event TokenRecovered(address token, address to, uint256 amount);
  event ZappedLPCurve(address indexed recipient, address fromToken, uint256 liquidity, uint256[] amounts);
  event ZappedLiquidityBalancerPool(address indexed recipient, address fromToken, uint256 fromAmount, uint256[] maxAmountsIn);

  constructor (
    address _router
  ) {
    uniswapV2Router = IUniswapV2Router(_router);
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

  function setUniswapV2Router(address _router) external onlyOwner {
    uniswapV2Router = IUniswapV2Router(_router);
    emit UniswapV2RouterSet(_router);
  }

  /**
   * @notice This function zaps ETH and ERC20 tokens to Temple token
   * @param fromToken The token used for entry (address(0) if ether)
   * @param fromAmount The amount of fromToken to zap
   * @param toToken Exit token
   * @param amountOutMin The minimum acceptable quantity of TEMPLE to receive
   * @param swapTarget Execution target for the swap
   * @param swapData DEX data
   * @return amountOut Amount of tokens received
   */
  function zapIn(
    address fromToken,
    uint256 fromAmount,
    address toToken,
    uint256 amountOutMin,
    address swapTarget,
    bytes calldata swapData
  ) external payable whenNotPaused returns (uint256 amountOut) {
    require(approvedTargets[fromToken][swapTarget] == true, "Unsupported token/target");

    amountOut = _zapIn(
      fromToken,
      fromAmount,
      toToken,
      amountOutMin,
      swapTarget,
      swapData
    );

    // transfer token to recipient
    SafeERC20.safeTransfer(
      IERC20(toToken),
      msg.sender,
      amountOut
    );
  }

  function zapInFor(
    address fromToken,
    uint256 fromAmount,
    address toToken,
    uint256 amountOutMin,
    address recipient,
    address swapTarget,
    bytes calldata swapData
  ) external payable whenNotPaused returns (uint256 amountOut) {
    require(approvedTargets[fromToken][swapTarget] == true, "Unsupported token/target");

    amountOut = _zapIn(
      fromToken,
      fromAmount,
      toToken,
      amountOutMin,
      swapTarget,
      swapData
    );

    // transfer token to recipient
    SafeERC20.safeTransfer(
      IERC20(toToken),
      recipient,
      amountOut
    );
  }

  function zapLiquidityBalancerPoolFor(
    address _fromToken,
    uint256 _fromAmount,
    bytes32 _poolId,
    address _recipient,
    address _swapTarget,
    bytes memory _swapData,
    ZapLiquidityRequest memory _zapLiqRequest,
    IBalancerVault.JoinPoolRequest memory _request
  ) external payable whenNotPaused {
    require(approvedTargets[_fromToken][_swapTarget] == true, "Unsupported token/target");

    _pullTokens(_fromToken, _fromAmount);

    _zapLiquidityBalancerPool(
      _fromToken,
      _fromAmount,
      _poolId,
      _recipient,
      _swapTarget,
      _swapData,
      _zapLiqRequest,
      _request
    );
  }

  function zapLiquidityBalancerPool(
    address _fromToken,
    uint256 _fromAmount,
    bytes32 _poolId,
    address _swapTarget,
    bytes memory _swapData,
    ZapLiquidityRequest memory _zapLiqRequest,
    IBalancerVault.JoinPoolRequest memory _request
  ) external payable whenNotPaused {
    require(approvedTargets[_fromToken][_swapTarget] == true, "Unsupported token/target");

    _pullTokens(_fromToken, _fromAmount);

    _zapLiquidityBalancerPool(
      _fromToken,
      _fromAmount,
      _poolId,
      msg.sender,
      _swapTarget,
      _swapData,
      _zapLiqRequest,
      _request
    );
  }

  function _zapLiquidityBalancerPool(
    address _fromToken,
    uint256 _fromAmount,
    bytes32 _poolId,
    address _recipient,
    address _swapTarget,
    bytes memory _swapData,
    ZapLiquidityRequest memory _zapLiqRequest,
    IBalancerVault.JoinPoolRequest memory _request
  ) internal {
    uint256 tokenBoughtIndex;
    uint256 amountBought;
    (address[] memory poolTokens,,) = balancerVault.getPoolTokens(_poolId);
    bool fromTokenIsPoolAsset = false;
    uint i = 0;
    for (; i<poolTokens.length;) {
      if (_fromToken == poolTokens[i]) {
        fromTokenIsPoolAsset = true;
        tokenBoughtIndex = i;
        break;
      }
      unchecked { i++; }
    }
    // fill order and execute swap
    if (!fromTokenIsPoolAsset) {
      (tokenBoughtIndex, amountBought) = _fillQuotePool(
        _fromToken,
        _fromAmount,
        poolTokens,
        _swapTarget,
        _swapData
      );
      require(amountBought >= _zapLiqRequest.firstSwapMinAmountOut, "Insufficient tokens out");
    }

    // swap token into 2 parts. use data from func call args, if not one-sided liquidity addition
    if (!_zapLiqRequest.isOneSidedLiquidityAddition) {
      uint256 toSwap;
      unchecked {
        toSwap = amountBought / 2;
        amountBought -= toSwap;
      }
      // use vault as target
      _approveToken(poolTokens[tokenBoughtIndex], address(balancerVault), toSwap);
      _executeSwap(address(balancerVault), 0, _zapLiqRequest.poolSwapData);
      // ensure min amounts out swapped for other token
      require(_zapLiqRequest.poolSwapMinAmountOut <= IERC20(_zapLiqRequest.otherToken).balanceOf(address(this)),
        "Insufficient swap output for other token");
    }

    // approve tokens iteratively, ensuring contract has right balance each time
    for (i=0; i<poolTokens.length;) {
      if (_request.maxAmountsIn[i] > 0) {
        require(IERC20(poolTokens[i]).balanceOf(address(this)) >= _request.maxAmountsIn[i], 
          "Insufficient asset tokens");
        _approveToken(poolTokens[i], address(balancerVault), _request.maxAmountsIn[i]);
      }
      unchecked { i++; }
    }

    balancerVault.joinPool(_poolId, msg.sender, _recipient, _request);

    emit ZappedLiquidityBalancerPool(_recipient, _fromToken, _fromAmount, _request.maxAmountsIn);
  }

  function zapLiquidityCurvePool(
    address _fromToken,
    uint256 _fromAmount,
    address _pool,
    address _swapTarget,
    bytes memory _swapData,
    ZapLiquidityRequest memory _zapLiqRequest
  ) external payable whenNotPaused {
    _zapLiquidityCurvePool(
      _fromToken,
      _fromAmount,
      _pool,
      msg.sender,
      _swapTarget,
      _swapData,
      _zapLiqRequest
    );
  }

  function zapLiquidityCurvePoolFor(
    address _fromToken,
    uint256 _fromAmount,
    address _pool,
    address _recipient,
    address _swapTarget,
    bytes memory _swapData,
    ZapLiquidityRequest memory _zapLiqRequest
  ) external payable whenNotPaused {

    _zapLiquidityCurvePool(
      _fromToken,
      _fromAmount,
      _pool,
      _recipient,
      _swapTarget,
      _swapData,
      _zapLiqRequest
    );
  }

  function _zapLiquidityCurvePool(
    address _fromToken,
    uint256 _fromAmount,
    address _pool,
    address _recipient,
    address _swapTarget,
    bytes memory _swapData,
    ZapLiquidityRequest memory _zapLiqRequest
  ) internal {
    require(approvedTargets[_fromToken][_swapTarget] == true, "Unsupported token/target");

    // pull tokens
    _pullTokens(_fromToken, _fromAmount);

    uint256 nCoins = curveFactory.get_n_coins(_pool);
    address[] memory coins = new address[](nCoins);
    uint256 fromTokenIndex = nCoins; // set wrong index as initial
    uint256 otherTokenIndex = nCoins;
    uint256 i;
    for (i=0; i<nCoins;) {
      coins[i] = ICurvePool(_pool).coins(i);
      if (_fromToken == coins[i]) {
        fromTokenIndex = i;
      } else if (coins[i] == _zapLiqRequest.otherToken) {
        otherTokenIndex = i;
      }
      unchecked { i++; }
    }
    require(fromTokenIndex != otherTokenIndex && otherTokenIndex != nCoins, "Invalid token indices");
    // fromtoken not a pool coin
    if (fromTokenIndex == nCoins) {
      // reuse fromTokenIndex as coin bought index and fromAmount as amount bought
      (fromTokenIndex, _fromAmount) = 
        _fillQuotePool(
          _fromToken, 
          _fromAmount,
          coins,
          _swapTarget,
          _swapData
        );
        require(_fromAmount >= _zapLiqRequest.firstSwapMinAmountOut, "FillQuote: Insufficient tokens out");
    }
    // to populate coin amounts for liquidity addition
    uint256[] memory coinAmounts = new uint256[](nCoins);
    // if one-sided liquidity addition
    if (_zapLiqRequest.isOneSidedLiquidityAddition) {
      coinAmounts[fromTokenIndex] = _fromAmount;
      _approveToken(coins[fromTokenIndex], _pool, _fromAmount);
    } else {
      // swap coins
      // add coins in equal parts. assumes two coins
      uint256 amountToSwap;
      unchecked {
        amountToSwap = _fromAmount / 2;
        _fromAmount -= amountToSwap;
      }
      require(approvedTargets[coins[fromTokenIndex]][_pool] == true, "Pool not approved");
      _approveToken(coins[fromTokenIndex], _pool, amountToSwap);
      bytes memory result = _executeSwap(_pool, 0, _zapLiqRequest.poolSwapData);
      // reuse amountToSwap variable for amountReceived
      amountToSwap = abi.decode(result, (uint256));
      require(_zapLiqRequest.poolSwapMinAmountOut <= amountToSwap, 
        "Insufficient swap output for other token");
      // reinit variable to avoid stack too deep
      uint256 fromAmount = _fromAmount;
      _approveToken(coins[fromTokenIndex], _pool, fromAmount);
      _approveToken(coins[otherTokenIndex], _pool, amountToSwap);

      coinAmounts[fromTokenIndex] = fromAmount;
      coinAmounts[otherTokenIndex] = amountToSwap;
    }

    uint256 liquidity = _addLiquidityCurvePool(
      _pool,
      _recipient,
      coinAmounts
    );

    emit ZappedLPCurve(_recipient, _fromToken, liquidity, coinAmounts);
  }

  function _addLiquidityCurvePool(
    address _pool,
    address _recipient,
    uint256[] memory _amounts
  ) internal returns (uint256 liquidity) {
    uint256 minLPMintAmount = ICurvePool(_pool).calc_token_amount(_amounts, true);
    liquidity = ICurvePool(_pool).add_liquidity(_amounts, minLPMintAmount, _recipient);
  }

  function zapLiquidityUniV2(
    address _fromToken,
    uint256 _fromAmount,
    address _pair,
    bool _shouldTransferResidual,
    address _swapTarget,
    bytes memory _swapData,
    ZapLiquidityRequest memory _zapLiqRequest
  ) external payable whenNotPaused {

    _zapLiquidityUniV2(
      _fromToken,
      _fromAmount,
      _pair,
      msg.sender,
      _shouldTransferResidual,
      _swapTarget,
      _swapData,
      _zapLiqRequest
    );
  }

  function zapLiquidityUniV2For(
    address _fromToken,
    uint256 _fromAmount,
    address _pair,
    address _for,
    bool _shouldTransferResidual,
    address _swapTarget,
    bytes memory _swapData,
    ZapLiquidityRequest memory _zapLiqRequest
  ) external payable whenNotPaused {

    _zapLiquidityUniV2(
      _fromToken,
      _fromAmount,
      _pair,
      _for,
      _shouldTransferResidual,
      _swapTarget,
      _swapData,
      _zapLiqRequest
    );
  }

  function _zapLiquidityUniV2(
    address _fromToken,
    uint256 _fromAmount,
    address _pair,
    address _recipient,
    bool _transferResidual,
    address _swapTarget,
    bytes memory _swapData,
    ZapLiquidityRequest memory _zapLiqRequest
  ) internal {
    require(approvedTargets[_fromToken][_swapTarget] == true, "Unsupported token/target");

    // pull tokens
    _pullTokens(_fromToken, _fromAmount);

    address intermediateToken;
    uint256 intermediateAmount;
    (address token0, address token1) = _getPairTokens(_pair);

    if (_fromToken != token0 && _fromToken != token1) {
      // swap to intermediate
      intermediateToken = _zapLiqRequest.otherToken == token0 ? token1 : token0;
      intermediateAmount = _fillQuoteAny(
        _fromToken,
        _fromAmount,
        intermediateToken,
        _zapLiqRequest.firstSwapMinAmountOut,
        _swapTarget,
        _swapData
      );
    } else {
        intermediateToken = _fromToken;
        intermediateAmount = _fromAmount;
    }
    
    (uint256 amountA, uint256 amountB) = _swapTokens(_pair, intermediateToken, intermediateAmount, _zapLiqRequest.firstSwapMinAmountOut);

    _approveToken(token1, address(uniswapV2Router), amountB);
    _approveToken(token0, address(uniswapV2Router), amountA);

    _addLiquidityUniV2(_pair, _recipient, amountA, amountB, _transferResidual);
  }

  function _addLiquidityUniV2(
    address _pair,
    address _recipient,
    uint256 _amountA,
    uint256 _amountB,
    bool _shouldTransferResidual
  ) internal {
    address tokenA = IUniswapV2Pair(_pair).token0();
    address tokenB = IUniswapV2Pair(_pair).token1();
    // avoid stack too deep
    {
      // get minimum amounts to use in liquidity addition. use optimal amounts as minimum
      (uint256 amountAMin, uint256 amountBMin) = _addLiquidityGetMinAmounts(_amountA, _amountB, IUniswapV2Pair(_pair));
      require(_amountA >= amountAMin && _amountB >= amountBMin, "Desired amounts too low");
      // reuse vars. below is actually amountA and amountB added to liquidity
      (amountAMin, amountBMin,) = uniswapV2Router.addLiquidity(
        tokenA,
        tokenB,
        _amountA,
        _amountB,
        amountAMin,
        amountBMin,
        _recipient,
        DEADLINE
      );

      emit ZappedLPUniV2(_recipient, tokenA, tokenB, amountAMin, amountBMin);

      // transfer residual
      if (_shouldTransferResidual) {
        _transferResidual(_recipient, tokenA, tokenB, _amountA, _amountB, amountAMin, amountBMin);
      }
    }    
  }

  function _transferResidual(
    address _recipient,
    address _tokenA,
    address _tokenB,
    uint256 _amountA,
    uint256 _amountB,
    uint256 _amountAActual,
    uint256 _amountBActual
  ) internal {
    if (_amountA > _amountAActual) {
      _transferToken(IERC20(_tokenA), _recipient, _amountA - _amountAActual);
    }

    if (_amountB > _amountBActual) {
      _transferToken(IERC20(_tokenB), _recipient, _amountB - _amountBActual);
    }
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

  function _swapTokens(
    address _pair,
    address _fromToken,
    uint256 _fromAmount,
    uint256 _amountOutMin
  ) internal returns (uint256 amountA, uint256 amountB) {
    IUniswapV2Pair pair = IUniswapV2Pair(_pair);
    address token0 = pair.token0();
    address token1 = pair.token1();

    (uint256 res0, uint256 res1,) = pair.getReserves();
    if (_fromToken == token0) {
      uint256 amountToSwap = _calculateSwapInAmount(res0, _fromAmount);
      //if no reserve or a new pair is created
      if (amountToSwap == 0) amountToSwap = _fromAmount / 2;

      amountB = _swapErc20ToErc20(
        _fromToken,
        token1,
        amountToSwap,
        _amountOutMin
      );
      amountA = _fromAmount - amountToSwap;
    } else {
      uint256 amountToSwap = _calculateSwapInAmount(res1, _fromAmount);
      //if no reserve or a new pair is created
      if (amountToSwap == 0) amountToSwap = _fromAmount / 2;

      amountA = _swapErc20ToErc20(
        _fromToken,
        token0,
        amountToSwap,
        _amountOutMin
      );
      amountB = _fromAmount - amountToSwap;
    }
  }

  function _getPairTokens(
    address _pairAddress
  ) internal view returns (address token0, address token1) {
    IUniswapV2Pair pair = IUniswapV2Pair(_pairAddress);
    token0 = pair.token0();
    token1 = pair.token1();
  }

  function _zapIn(
    address fromToken,
    uint256 fromAmount,
    address toToken,
    uint256 amountOutMin,
    address swapTarget,
    bytes calldata swapData
  ) internal returns (uint256) {

    _pullTokens(fromToken, fromAmount);

    uint256 amountOut = _fillQuote(
      fromToken,
      fromAmount,
      toToken,
      swapTarget,
      swapData
    );
    require(amountOut >= amountOutMin, "Not enough tokens out");
    
    emit ZappedIn(msg.sender, fromToken, fromAmount, toToken, amountOut);

    return amountOut;
  }

  function _fillQuotePool(
    address _fromToken, 
    uint256 _fromAmount,
    address[] memory _coins,
    address _swapTarget,
    bytes memory _swapData
  ) internal returns (uint256, uint256){
    uint256 valueToSend;
    if (_fromToken == address(0)) {
      require(
          _fromAmount > 0 && msg.value == _fromAmount,
          "Invalid _amount: Input ETH mismatch"
      );
      valueToSend = _fromAmount;
    } else {
      _approveToken(_fromToken, _swapTarget, _fromAmount);
    }
    uint256 nCoins = _coins.length;
    uint256[] memory balancesBefore = new uint256[](nCoins);
    uint256 i = 0;
    for (; i<nCoins;) {
      balancesBefore[i] = IERC20(_coins[i]).balanceOf(address(this));
      unchecked { i++; }
    }

    _executeSwap(_swapTarget, valueToSend, _swapData);

    uint256 tokenBoughtIndex = nCoins;
    uint256 bal;
    // reuse vars
    for (i=0; i<nCoins;) {
      bal = IERC20(_coins[i]).balanceOf(address(this));
      if (bal > balancesBefore[i]) {
        tokenBoughtIndex = i;
        break;
      }
      unchecked { i++; }
    }
    require(tokenBoughtIndex != nCoins, "Invalid swap");

    return (tokenBoughtIndex, bal - balancesBefore[tokenBoughtIndex]);
  }

  function _fillQuote(
    address _fromToken,
    uint256 _fromAmount,
    address _toToken,
    address _swapTarget,
    bytes memory _swapData
  ) internal returns (uint256 amountBought) {
    if (_swapTarget == WETH) {
      _depositEth(_fromAmount);
      return _fromAmount;
    }

    uint256 valueToSend;
    if (_fromToken == address(0)) {
        require(
            _fromAmount > 0 && msg.value == _fromAmount,
            "Invalid _amount: Input ETH mismatch"
        );
        valueToSend = _fromAmount;
    } else {
        _approveToken(_fromToken, _swapTarget, _fromAmount);
    }

    // to calculate amount received
    uint256 initialBalance = _getBalance(_toToken);

    _executeSwap(_swapTarget, valueToSend, _swapData);
    
    unchecked {
      amountBought = _getBalance(_toToken) - initialBalance;
    }
  }

  // fill quote but without a target token in mind (it's encoded in swapdata)
  // used for lp addition
  function _fillQuoteAny(
    address _fromToken,
    uint256 _fromAmount,
    address _toToken,
    uint256 _minAmountOut,
    address _swapTarget,
    bytes memory _swapData
  ) internal returns (uint256 amountBought) {
    if (_swapTarget == WETH) {
      _depositEth(_fromAmount);
      amountBought = _fromAmount;
    }

    uint256 valueToSend;
    if (_fromToken == address(0)) {
      require(
        _fromAmount > 0 && msg.value == _fromAmount,
        "Invalid _amount: Input ETH mismatch"
      );
      valueToSend = _fromAmount;
    } else {
      _approveToken(_fromToken, _swapTarget, _fromAmount);
    }

    uint256 toTokenBalanceBefore = IERC20(_toToken).balanceOf(address(this));
    _executeSwap(_swapTarget, valueToSend, _swapData);
    uint256 toTokenBalanceAfter = IERC20(_toToken).balanceOf(address(this));
    unchecked {
      amountBought = toTokenBalanceAfter - toTokenBalanceBefore;
    }
    
    require(amountBought >= _minAmountOut, "Not enough tokens out");
  }

  function _depositEth(
    uint256 _amount
  ) internal {
    require(
      _amount > 0 && msg.value == _amount,
      "Invalid _amount: Input ETH mismatch"
    );
    IWETH(WETH).deposit{value: _amount}();
  }

  /**
    @notice This function is used to swap ERC20 <> ERC20
    @param _fromToken The token address to swap from.
    @param _toToken The token address to swap to. 
    @param _amountIn The amount of tokens to swap
    @return tokenBought The quantity of tokens bought
    */
  function _swapErc20ToErc20(
    address _fromToken,
    address _toToken,
    uint256 _amountIn,
    uint256 _amountOutMin
  ) internal returns (uint256 tokenBought) {
    if (_fromToken == _toToken) {
        return _amountIn;
    }

    _approveToken(_fromToken, address(uniswapV2Router), _amountIn);

    IUniswapV2Factory uniV2Factory = IUniswapV2Factory(
      uniswapV2Router.factory()
    );
    address pair = uniV2Factory.getPair(
        _fromToken,
        _toToken
    );
    require(pair != address(0), "No Swap Available");
    address[] memory path = new address[](2);
    path[0] = _fromToken;
    path[1] = _toToken;

    tokenBought = uniswapV2Router
      .swapExactTokensForTokens(
          _amountIn,
          _amountOutMin,
          path,
          address(this),
          DEADLINE
      )[path.length - 1];

    require(tokenBought >= _amountOutMin, "Error Swapping Tokens 2"); // redundant?
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

  function _calculateSwapInAmount(
    uint256 reserveIn,
    uint256 userIn
  ) internal pure returns (uint256) {
    return
        (sqrt(
            reserveIn * ((userIn * 3988000) + (reserveIn * 3988009))
        ) - (reserveIn * 1997)) / 1994;
  }

  function _getSwapAmount(uint256 amountA, uint256 reserveA) internal pure returns (uint256) {
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
}