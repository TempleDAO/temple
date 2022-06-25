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
    function calc_token_amount(uint256[2] calldata _amounts, bool _is_deposit) external view returns (uint256);
    function add_liquidity(uint256[2] calldata _amounts, uint256 _min_mint_amount, address destination) external returns (uint256);
    function get_dy(int128 _from, int128 _to, uint256 _from_amount) external view returns (uint256);
    function remove_liquidity(uint256 _amount, uint256[2] calldata _min_amounts) external returns (uint256[2] memory);
    function fee() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function exchange(int128 i, int128 j, uint256 dx, uint256 min_dy) external returns (uint256);
    function remove_liquidity_imbalance(uint256[2] memory amounts, uint256 _max_burn_amount, address _receiver) external returns (uint256);
}

interface ICurveFactory {
  function get_n_coins(address pool) external view returns (uint256);
}


contract GenericZap is ZapBaseV2_3 {

  IUniswapV2Router public uniswapV2Router;

  address private constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
  ICurveFactory private constant CURVE_FACTORY = 0xB9fC157394Af804a3578134A6585C0dc9cc990d4;
  uint256 private constant DEADLINE = 0xf000000000000000000000000000000000000000000000000000000000000000;

  mapping(address => bool) public permittedTokens;
  mapping(address => bool) public permittedTargets;

  event ZappedIn(address indexed sender, address fromToken, uint256 fromAmount, address toToken, uint256 amountOut);

  event UniswapV2RouterSet(address router);
  event ZappedLPUniV2(address indexed recipient, address token0, address token1, uint256 amountA, uint256 amountB);
  event TokenRecovered(address token, address to, uint256 amount);
  event ZappedLPCurve(address indexed recipient, address fromToken, uint256 liquidity, uint256[] amounts);

  constructor (
    address _router
  ) {
    uniswapV2Router = IUniswapV2Router(_router);
  }

  /**
   * @dev set permittable tokens
   * @param _tokens tokens to permit
   * @param _isPermitted to permit or not
   */
  function setPermittedTokens(
    address[] calldata _tokens,
    bool[] calldata _isPermitted
  ) external onlyOwner {
    uint256 _length = _isPermitted.length;
    require(_tokens.length == _length, 'Invalid Input length');

    for (uint256 i = 0; i < _length; i++) {
      permittedTokens[_tokens[i]] = _isPermitted[i];
    }
  }

  /**
   * @dev set permitted targets
   * @param _targets tokens to permit
   * @param _isPermitted to permit or not
   */
  function setPermittedTargets(
    address[] calldata _targets,
    bool[] calldata _isPermitted
  ) external onlyOwner {
    uint256 _length = _isPermitted.length;
    require(_targets.length == _length, 'Invalid Input length');

    for (uint256 i = 0; i < _length; i++) {
      permittedTargets[_targets[i]] = _isPermitted[i];
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
    require(permittedTokens[fromToken] == true, "Zaps unsupported for this token");
    require(permittedTargets[swapTarget] == true, "Zaps unsupported for this target");

    amountOut = _zapIn(
      fromToken,
      fromAmount,
      toToken,
      amountOutMin,
      swapTarget,
      swapData
    );
  }

  function zapLiquidityCurvePool(
    address _fromToken,
    uint256 _fromAmount,
    address _pool,
    bool _oneSided,
    address _swapTarget,
    bytes memory _swapData
  ) external payable whenNotPaused {
    _zapLiquidityCurvePool(
      _fromToken,
      _fromAmount,
      _pool,
      msg.sender,
      _oneSided,
      _swapTarget,
      _swapData
    );
  }

  function zapLiquidityCurvePoolFor(
    address _fromToken,
    uint256 _fromAmount,
    address _pool,
    address _recipient,
    bool _oneSided,
    address _swapTarget,
    bytes memory _swapData
  ) external payable whenNotPaused {
    _zapLiquidityCurvePool(
      _fromToken,
      _fromAmount,
      _pool,
      _recipient,
      _oneSided,
      _swapTarget,
      _swapData
    );
  }

  function _zapLiquidityCurvePool(
    address _fromToken,
    uint256 _fromAmount,
    address _pool,
    address _recipient,
    bool _oneSided,
    address _swapTarget,
    bytes memory _swapData
  ) internal {
    // todo: change to permittedCurveTokens
    require(permittedTokens[_fromToken] == true, "Zaps unsupported for this token");
    require(approvedTargets[_swapTarget], "Unapproved target");

    // pull tokens
    _pullTokens(_fromToken, _fromAmount);

    uint256 nCoins = CURVE_FACTORY.get_n_coins(_pool);
    address[] memory coins = new address[nCoins]();
    uint256 fromTokenIndex = nCoins; // set wrong index as initial
    for (uint i=0; i<nCoins; i++) {
      coins[i] = ICurvePool(_pool).coins(i);
      if (_fromToken == coins[i]) {
        fromTokenIndex = i;
      }
    }
    // fromtoken not a pool coin
    if (fromTokenIndex == nCoins) {
      // reuse fromTokenIndex as coin bought index and fromAmount as amount bought
      (fromTokenIndex, _fromAmount) = 
        _fillQuoteCurve(
          _fromToken, 
          _fromAmount,
          _coins,
          _swapTarget,
          _swapData
        );
    }
    // too populate coin amounts for liquidity addition
    uint256[] memory coinAmounts = new uint256[](nCoins);
    // if one-sided liquidity addition
    if (_oneSided) {
      coinAmounts[fromTokenIndex] = _fromAmount;
      _approveToken(coins[fromTokenIndex], _pool, _fromAmount);
    } else {
      // todo: approve during swap and save vars?
      (uint256 amountA, uint256 amountB, uint256 otherIndex) = _swapCoins(_pool, _fromAmount, coins, fromTokenIndex);

      _approveToken(coins[fromTokenIndex], _pool, amountA);
      _approveToken(coins[otherIndex], _pool, amountB);

      coinAmounts[fromTokenIndex] = amountA;
      coinAmounts[otherIndex] = amountB;
    }

    _addLiquidityCurvePool(
      _pool,
      _recipient,
      coinAmounts
    );
  }

  function _addLiquidityCurvePool(
    address _pool,
    address _recipient,
    uint256[] memory _amounts
  ) internal {
    uint256 minLPMintAmount = ICurvePool(_pool).calc_token_amount(_amounts, _is_deposit);
    uint256 liquidity = ICurvePool(_pool).add_liquidity(_amounts, minLPMintAmount, _recipient);

    emit ZappedLPCurve(_recipient, _amounts, liquidity);
  }

  function zapLiquidityUniV2(
    address _fromToken,
    uint256 _fromAmount,
    address _pair,
    bool _shouldTransferResidual,
    address _swapTarget,
    bytes memory _swapData
  ) external payable whenNotPaused {

    _zapLiquidityUniV2(
      _fromToken,
      _fromAmount,
      _pair,
      msg.sender,
      _shouldTransferResidual,
      _swapTarget,
      _swapData
    );
  }

  function zapLiquidityUniV2For(
    address _fromToken,
    uint256 _fromAmount,
    address _pair,
    address _for,
    bool _shouldTransferResidual,
    address _swapTarget,
    bytes memory _swapData
  ) external payable whenNotPaused {

    _zapLiquidityUniV2(
      _fromToken,
      _fromAmount,
      _pair,
      _for,
      _shouldTransferResidual,
      _swapTarget,
      _swapData
    );
  }

  function _zapLiquidityUniV2(
    address _fromToken,
    uint256 _fromAmount,
    address _pair,
    address _recipient,
    bool _transferResidual,
    address _swapTarget,
    bytes memory _swapData
  ) internal {
    require(permittedTokens[_fromToken] == true, "Zaps unsupported for this token");
    require(approvedTargets[_swapTarget], "Unapproved target");

    // pull tokens
    _pullTokens(_fromToken, _fromAmount);

    address intermediateToken;
    uint256 intermediateAmount;
    (address token0, address token1) = _getPairTokens(_pair);

    if (_fromToken != token0 && _fromToken != token1) {
      // swap to intermediate
      //intermediateToken = _stableToken;
      (intermediateToken, intermediateAmount) = _fillQuoteAny(
        _fromToken,
        _fromAmount,
        _pair,
        _swapTarget,
        _swapData
      );
    } else {
        intermediateToken = _fromToken;
        intermediateAmount = _fromAmount;
    }
    
    (uint256 amountA, uint256 amountB) = _swapTokens(_pair, intermediateToken, intermediateAmount);

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

  function _swapCoins(
    address _pool,
    uint256 _fromAmount,
    uint256[] memory _coins,
    uint256 _fromTokenIndex
  ) internal returns (uint256, uint256, uint256) {
    // add coins in equal parts. assumes two coins
    uint256 amountToSwap = _fromAmount / 2;
    unchecked {
      _fromAmount -= amountToSwap;
    }
    // calculate amount out and approve
    // use any other coin in pool as target
    uint256 otherIndex;
    for (uint i=0; i<_coins.length; i++) {
      if (i != _fromTokenIndex) {
        otherIndex = i;
        break;
      }
    }
    ICurvePool pool = ICurvePool(_pool);
    uint256 minAmountOut = pool.get_dy(_fromTokenIndex, otherIndex, amountToSwap);
    _approveToken(_coins[_fromTokenIndex], _pool, amountToSwap);
    uint256 amountReceived = pool.exchange(_fromTokenIndex, otherIndex, amountToSwap, minAmountOut);

    return (_fromAmount, amountReceived, otherIndex);
  }

  function _swapTokens(
    address _pair,
    address _intermediateToken,
    uint256 _intermediateAmount
  ) internal returns (uint256 amountA, uint256 amountB) {
    IUniswapV2Pair pair = IUniswapV2Pair(_pair);
    address token0 = pair.token0();
    address token1 = pair.token1();
    /*uint256 intermediateAmountToSwap = _intermediateAmount / 2;
    unchecked {
      _intermediateAmount -= intermediateAmountToSwap;
    }*/

    (uint256 res0, uint256 res1,) = pair.getReserves(); 
    if (_intermediateToken == token0) {
      uint256 amountToSwap = _calculateSwapInAmount(res0, _intermediateAmount);
      //if no reserve or a new pair is created
      if (amountToSwap == 0) amountToSwap = _intermediateAmount / 2;

      uint256 amountOutMin = _getAmountOut(amountToSwap, res0, res1);
      amountB = _swapErc20ToErc20(
        _intermediateToken,
        token1,
        amountToSwap,
        amountOutMin
      );
      amountA = _intermediateAmount - amountToSwap;
    } else {
      uint256 amountToSwap = _calculateSwapInAmount(res1, _intermediateAmount);
      //if no reserve or a new pair is created
      if (amountToSwap == 0) amountToSwap = _intermediateAmount / 2;

      uint256 amountOutMin = _getAmountOut(amountToSwap, res1, res0);
      amountA = _swapErc20ToErc20(
        _intermediateToken,
        token0,
        amountToSwap,
        amountOutMin
      );
      amountB = _intermediateAmount - amountToSwap;
    }
  }

  function _getPairTokens(
    address _pairAddress
  ) internal view returns (address token0, address token1)
  {
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

    //uint256 amountTemple = _enterTemple(_stableToken, templeReceiver, stableAmountBought, minTempleReceived, ammDeadline);
    
    emit ZappedIn(msg.sender, fromToken, fromAmount, toToken, amountOut);

    return amountOut;
    //return amountTemple;
  }

  function _fillQuoteCurve(
    address _fromToken, 
    uint256 _fromAmount,
    address[] memory _coins,
    address _swapTarget,
    bytes memory _swapData
  ) internal returns (uint256, uint256){
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
    uint256 nCoins = _coins.length;
    uint256[] memory balancesBefore = new uint256[](nCoins);
    uint256 i = 0;
    for (; i<nCoins; i++) {
      balancesBefore[i] = IERC20(_coins[i]).balanceOf(address(this));
    }

    _executeSwap(_swapTarget, valueToSend, _swapData);

    uint256 tokenBoughtIndex = nCoins;
    //uint256 amountBought;
    uint256 bal;
    // reuse vars
    for (i=0; i>nCoins; i++) {
      bal = IERC20(_coins[i]).balanceOf(address(this));
      if (bal > balancesBefore[i]) {
        tokenBoughtIndex = i;
        //unchecked {
        //  amountBought = bal - balancesBefore[i];
        //}
        break;
      }
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
    //require(amountBought > 0, "Swapped To Invalid Token");
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

  // fill quote but without a target token in mind (it's encoded in swapdata)
  // used for lp addition
  function _fillQuoteAny(
    address _fromToken,
    uint256 _fromAmount,
    address _pairAddress,
    address _swapTarget,
    bytes memory _swapData
  ) internal returns (address tokenOut, uint256 amountBought) {
    if (_swapTarget == WETH) {
      _depositEth(_fromAmount);
      return (WETH, _fromAmount);
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

    (address _token0, address _token1) = _getPairTokens(_pairAddress);
    IERC20 token0 = IERC20(_token0);
    IERC20 token1 = IERC20(_token1);
    uint256 balanceBefore0 = token0.balanceOf(address(this));
    uint256 balanceBefore1 = token1.balanceOf(address(this));

    _executeSwap(_swapTarget, valueToSend, _swapData);

    uint256 balanceAfter0 = token0.balanceOf(address(this)) - balanceBefore0;
    uint256 balanceAfter1 = token1.balanceOf(address(this)) - balanceBefore1;

    if (balanceAfter0 > balanceAfter1) {
      amountBought = balanceAfter0;
      tokenOut = _token0;
    } else {
      amountBought = balanceAfter1;
      tokenOut = _token1;
    }
    require(amountBought > 0, "Swapped to Invalid Intermediate");
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

  function _executeSwap(
    address _swapTarget,
    uint256 _valueToSend,
    bytes memory _swapData
  ) internal {
    require(approvedTargets[_swapTarget], "Target not Authorized");
    (bool success,) = _swapTarget.call{value: _valueToSend}(_swapData);
    require(success, "Error Swapping Tokens 1");
  }

  /**
    @notice This function is used to swap ERC20 <> ERC20
    @param _FromTokenContractAddress The token address to swap from.
    @param _ToTokenContractAddress The token address to swap to. 
    @param _amountIn The amount of tokens to swap
    @return tokenBought The quantity of tokens bought
    */
  function _swapErc20ToErc20(
    address _FromTokenContractAddress,
    address _ToTokenContractAddress,
    uint256 _amountIn,
    uint256 _amountOutMin
  ) internal returns (uint256 tokenBought) {
    if (_FromTokenContractAddress == _ToTokenContractAddress) {
        return _amountIn;
    }

    _approveToken(_FromTokenContractAddress, address(uniswapV2Router), _amountIn);

    IUniswapV2Factory uniV2Factory = IUniswapV2Factory(
      uniswapV2Router.factory()
    );
    address pair = uniV2Factory.getPair(
        _FromTokenContractAddress,
        _ToTokenContractAddress
    );
    require(pair != address(0), "No Swap Available");
    address[] memory path = new address[](2);
    path[0] = _FromTokenContractAddress;
    path[1] = _ToTokenContractAddress;

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

  function _transferToken(IERC20 _token, address _to, uint256 _amount) internal {
    uint256 balance = _token.balanceOf(address(this));
    require(_amount <= balance, "not enough tokens");
    SafeERC20.safeTransfer(_token, _to, _amount);
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

  // copied from univ2 library to save on external call
  // given an input amount of an asset and pair reserves, returns the maximum output amount of the other asset
  function _getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) internal pure returns (uint amountOut) {
      //require(amountIn > 0, 'UniswapV2Library: INSUFFICIENT_INPUT_AMOUNT');
      //require(reserveIn > 0 && reserveOut > 0, 'UniswapV2Library: INSUFFICIENT_LIQUIDITY');
      uint amountInWithFee = amountIn * 997;
      uint numerator = amountInWithFee * reserveOut;
      uint denominator = (reserveIn * 1000) + amountInWithFee;
      amountOut = numerator / denominator;
  }

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

  // TODO:
  // - support for curve pools
  // - support for balancer pools
  // - token => curve mapping, token => balancer mapping
}