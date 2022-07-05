pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./GenericZap.sol";


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
}


contract TempleZaps is Ownable {
  using SafeERC20 for IERC20;

  address public constant FRAX = 0x853d955aCEf822Db058eb8505911ED77F175b99e;
  address public immutable temple;
  IFaith public immutable faith;
  IVaultProxy public immutable vaultProxy;
  ITempleStableRouter public templeRouter;
  IGenericZaps public zaps;

  uint256 private constant DEADLINE = 0xf000000000000000000000000000000000000000000000000000000000000000;

  mapping(address => bool) public supportedStables;

  event SetZaps(address zaps);
  event SetTempleRouter(address router);
  event ZappedTemplePlusFaithInVault(address indexed sender, address fromToken, uint256 fromAmount, uint112 faithAmount, uint256 boostedAmount);
  event ZappedTempleInVault(address indexed sender, address fromToken, uint256 fromAmount, uint256 templeAmount);
  event TokenRecovered(address token, address to, uint256 amount);

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
  ) external payable {
    // todo: handle when fromToken == ETH. i.e. deposit into weth and update
    SafeERC20.safeTransferFrom(IERC20(_fromToken), msg.sender, address(this), _fromAmount);

    _zapInTemple(
      _fromToken,
      _fromAmount,
      _minTempleReceived,
      _stableToken,
      _minStableReceived,
      _recipient,
      _swapTarget,
      _swapData
    );
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
    // todo: handle when fromToken == ETH. i.e. deposit into weth and update
    SafeERC20.safeTransferFrom(IERC20(_fromToken), msg.sender, address(this), _fromAmount);

    _zapInTemple(
      _fromToken,
      _fromAmount,
      _minTempleReceived,
      _stableToken,
      _minStableReceived,
      msg.sender,
      _swapTarget,
      _swapData
    );
  }

  function _zapInTemple(
    address _fromToken,
    uint256 _fromAmount,
    uint256 _minTempleReceived,
    address _stableToken,
    uint256 _minStableReceived,
    address _recipient,
    address _swapTarget,
    bytes calldata _swapData
  ) internal {
    require(supportedStables[_stableToken] == true, "Unsupported stable token");
    
    SafeERC20.safeIncreaseAllowance(IERC20(_fromToken), address(zaps), _fromAmount);
    uint256 amountOut = zaps.zapIn(_fromToken, _fromAmount, _stableToken, _minStableReceived, _swapTarget, _swapData);

    _enterTemple(_stableToken, _recipient, amountOut, _minTempleReceived);
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
    IERC20(_fromToken).safeTransferFrom(msg.sender, address(this), _fromAmount);
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
      IVault(_vault).depositFor(msg.sender, receivedTempleAmount);
    }

    emit ZappedTempleInVault(msg.sender, _fromToken, _fromAmount, receivedTempleAmount);
  }

  function zapTempleFaithInVault(
    address vault,
    address fromToken,
    uint256 fromAmount,
    address toToken,
    uint256 minTempleReceived,
    address swapTarget,
    bytes calldata swapData
  ) external {
    require(vaultProxy.faithClaimEnabled(), "VaultProxy: Faith claim no longer enabled");

    uint256 receivedTempleAmount;
    if (fromToken == temple) {
      IERC20(temple).safeTransferFrom(msg.sender, address(this), fromAmount);
      receivedTempleAmount = fromAmount;
    } else {
      IERC20(fromToken).safeTransferFrom(msg.sender, address(this), fromAmount);
      IERC20(fromToken).safeIncreaseAllowance(address(zaps), fromAmount);
      receivedTempleAmount = zaps.zapIn(
        fromToken,
        fromAmount,
        toToken,
        minTempleReceived,
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
    IERC20(temple).safeIncreaseAllowance(vault, boostedAmount);

    // deposit for user
    IVault(vault).depositFor(msg.sender, boostedAmount);

    emit ZappedTemplePlusFaithInVault(msg.sender, fromToken, fromAmount, faithAmount, boostedAmount);
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