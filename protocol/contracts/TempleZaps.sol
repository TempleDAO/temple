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

  event SetZaps(address zaps);
  event ZappedTemplePlusFaithInVault(address indexed sender, address fromToken, uint256 fromAmount, uint112 faithAmount, uint256 boostedAmount);
  event ZappedTempleInVault(address indexed sender, address fromToken, uint256 fromAmount, uint256 templeAmount);

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

  function zapInVault(
    address _fromToken,
    uint256 _fromAmount,
    uint256 _minTempleReceived,
    address _stableToken,
    address _vault,
    address _swapTarget,
    bytes calldata _swapData
  ) external payable {
    uint256 receivedTempleAmount;
    if (_fromToken == temple) {
      IERC20(temple).safeTransferFrom(msg.sender, address(this), _fromAmount);
      receivedTempleAmount = _fromAmount;
    } else {
      IERC20(_fromToken).safeTransferFrom(msg.sender, address(this), _fromAmount);
      IERC20(_fromToken).safeIncreaseAllowance(address(zaps), _fromAmount);
      receivedTempleAmount = zaps.zapIn(
        _fromToken,
        _fromAmount,
        temple,
        _minTempleReceived,
        _swapTarget,
        _swapData
      );
    }

    // approve and deposit for user
    IERC20(temple).safeIncreaseAllowance(_vault, receivedTempleAmount);
    IVault(_vault).depositFor(msg.sender, receivedTempleAmount);

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

}