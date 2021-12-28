pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "../TempleERC20Token.sol";

interface ITempleFraxAMMRouter {
  function addLiquidity(
    uint amountADesired,
    uint amountBDesired,
    uint amountAMin,
    uint amountBMin,
    address to,
    uint deadline
  ) external returns (uint amountA, uint amountB, uint liquidity);
  function removeLiquidity(
    uint liquidity,
    uint amountAMin,
    uint amountBMin,
    address to,
    uint deadline
  ) external returns (uint amountA, uint amountB);
}

interface ITreasuryManagementProxy {
  function harvest() external;
}

contract TempleFraxAMMOps is Ownable {

  TempleERC20Token public immutable templeToken;
  ITempleFraxAMMRouter public immutable ammRouter;
  ITreasuryManagementProxy public immutable treasuryManagementProxy;
  // precondition token0/tokenA is temple. token1/tokenB is frax
  IERC20 public immutable fraxToken;
  address public immutable templeTreasury;
  address public manager;
  address public immutable templeUniswapV2Pair;

  event LiquidityDeepened(uint256 amountA, uint256 amountB, uint256 liqudity);
  event LiquidityRemoved(uint256 amountA, uint256 amountB);
  event IVRaised(uint256 fraxAmount);

  constructor(
      TempleERC20Token _templeToken,
      ITempleFraxAMMRouter _ammRouter,
      ITreasuryManagementProxy _treasuryManagementProxy,
      IERC20 _fraxToken,
      address _templeTreasury,
      address _templeUniswapV2Pair) {
    templeToken = _templeToken;
    ammRouter = _ammRouter;
    treasuryManagementProxy = _treasuryManagementProxy;
    fraxToken = _fraxToken;
    templeTreasury = _templeTreasury;
    templeUniswapV2Pair = _templeUniswapV2Pair;
    manager = msg.sender;
  }

  fallback() external payable {}
  receive() external payable {}

  function setManager(address _manager) external onlyOwner {
    require(_manager != address(0), "address zero");
    manager = _manager;
  }

  function _safeApproveIncrease(IERC20 _token, address _spender, uint256 _amount) internal {
    uint256 currentAllowance = _token.allowance(address(this), _spender);
    if (currentAllowance < _amount) {
      SafeERC20.safeIncreaseAllowance(_token, _spender, _amount - currentAllowance);
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

  /**
   * amountADesired, amountAMin token is
  * precondition token0/tokenA is temple. token1/tokenB is frax
   */
  function deepenLiquidity(
    uint256 amountADesired,
    uint256 amountBDesired,
    uint256 amountAMin,
    uint256 amountBMin
  ) external {
    require(msg.sender == manager || msg.sender == owner(), "only owner or manager");
    // best case scenario we get desired amounts (with 0 reserves)
    require(amountADesired <= templeToken.balanceOf(address(this)), "insufficient temple tokens for adding liqudity");
    require(amountBDesired <= fraxToken.balanceOf(address(this)), "insufficient frax tokens for adding liqudity");
    
    _safeApproveIncrease(IERC20(templeToken), address(ammRouter), amountADesired);
    _safeApproveIncrease(fraxToken, address(ammRouter), amountBDesired);
    (uint amountA, uint amountB, uint liquidity) = 
      ammRouter.addLiquidity(amountADesired, amountBDesired, amountAMin, amountBMin, address(this), block.timestamp);

    emit LiquidityDeepened(amountA, amountB, liquidity);
  }

  function removeLiquidity(
    uint256 liquidity,
    uint256 amountAMin,
    uint256 amountBMin
  ) external {
    require(msg.sender == manager || msg.sender == owner(), "only owner or manager");

    _safeApproveIncrease(IERC20(templeUniswapV2Pair), address(ammRouter), liquidity);
    (uint256 amountA, uint256 amountB) = 
      ammRouter.removeLiquidity(liquidity, amountAMin, amountBMin, address(this), block.timestamp);

    emit LiquidityRemoved(amountA, amountB);
  }

  /*
  * transfer given amount of frax into treasury and run harvest
  * */
  function raiseIV(uint256 amount) external {
    require(msg.sender == manager || msg.sender == owner(), "only owner or manager");
    require(amount <= fraxToken.balanceOf(address(this)), "insufficient frax funds");

    SafeERC20.safeTransfer(fraxToken, templeTreasury, amount);
    treasuryManagementProxy.harvest();

    emit IVRaised(amount);
  }
}