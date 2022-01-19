// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.8.0;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';

abstract contract ZapBaseV2_2 is Ownable {
  using SafeERC20 for IERC20;
  bool public stopped;

  address private constant wethTokenAddress =
    0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

  // swapTarget => approval status
  mapping(address => bool) public approvedTargets;

  address internal constant ETHAddress =
    0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

  address internal constant ZapperAdmin =
    0x3CE37278de6388532C3949ce4e886F365B14fB56;

  // circuit breaker modifiers
  modifier stopInEmergency() {
    require(!stopped, 'Paused');
    _;
  }

  /**
    @dev Transfers tokens (including ETH) from msg.sender to this contract
    @dev For use with Zap Ins (takes fee from input if > 0)
    @param token The ERC20 token to transfer to this contract (0 address if ETH)
    @return Quantity of tokens transferred to this contract
     */
  function _pullTokens1(address token, uint256 amount)
    internal
    virtual
    returns (uint256)
  {
    if (token == address(0)) {
      require(msg.value > 0, 'No ETH sent');
      return msg.value;
    }

    require(amount > 0, 'Invalid token amount');
    require(msg.value == 0, 'ETH sent with token');

    IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

    return amount;
  }

  /**
    @dev Transfers tokens from msg.sender to this contract
    @dev For use with Zap Outs (does not transfer ETH)
    @param token The ERC20 token to transfer to this contract
    @return Quantity of tokens transferred to this contract
     */
  function _pullTokens2(address token, uint256 amount)
    internal
    virtual
    returns (uint256)
  {
    IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

    return amount;
  }

  /**
    @dev Fulfills an encoded swap or Zap if the target is approved
    @param fromToken The sell token
    @param toToken The buy token
    @param amount The quantity of fromToken to sell
    @param swapTarget The execution target for the swapData
    @param swapData The swap data encoding the swap or Zap
    @return amountBought Quantity of tokens toToken acquired
     */
  function _fillQuote(
    address fromToken,
    address toToken,
    uint256 amount,
    address swapTarget,
    bytes memory swapData
  ) internal virtual returns (uint256 amountBought) {
    if (fromToken == toToken) {
      return amount;
    }

    if (fromToken == address(0) && toToken == wethTokenAddress) {
      IWETH(wethTokenAddress).deposit{value: amount}();
      return amount;
    }

    if (fromToken == wethTokenAddress && toToken == address(0)) {
      IWETH(wethTokenAddress).withdraw(amount);
      return amount;
    }

    uint256 valueToSend;
    if (fromToken == address(0)) {
      valueToSend = amount;
    } else {
      _approveToken(fromToken, swapTarget, amount);
    }

    uint256 initialBalance = _getBalance(toToken);

    require(approvedTargets[swapTarget], 'Target not Authorized');
    (bool success, ) = swapTarget.call{value: valueToSend}(swapData);
    require(success, 'Error Swapping Tokens');

    amountBought = _getBalance(toToken) - initialBalance;

    require(amountBought > 0, 'Swapped To Invalid Token');
  }

  /**
    @notice Gets this contract's balance of a token
    @param token The ERC20 token to check the balance of (0 address if ETH)
    @return balance This contract's token balance
     */
  function _getBalance(address token) internal view returns (uint256 balance) {
    if (token == address(0)) {
      balance = address(this).balance;
    } else {
      balance = IERC20(token).balanceOf(address(this));
    }
  }

  /**
    @notice Approve a token for spending with infinite allowance
    @param token The ERC20 token to approve
    @param spender The spender of the token
     */
  function _approveToken(address token, address spender) internal {
    IERC20 _token = IERC20(token);
    if (_token.allowance(address(this), spender) > 0) return;
    else {
      _token.safeApprove(spender, type(uint256).max);
    }
  }

  /**
    @notice Approve a token for spending with finite allowance
    @param token The ERC20 token to approve
    @param spender The spender of the token
    @param amount The allowance to grant to the spender
     */
  function _approveToken(
    address token,
    address spender,
    uint256 amount
  ) internal {
    IERC20(token).safeApprove(spender, 0);
    IERC20(token).safeApprove(spender, amount);
  }

  /**
    @dev Adds or removes an approved swapTarget
    * swapTargets should be Zaps and must not be tokens!
    @param targets An array of addresses of approved swapTargets
    */
  function setApprovedTargets(
    address[] calldata targets,
    bool[] calldata isApproved
  ) external onlyOwner {
    require(targets.length == isApproved.length, 'Invalid Input length');

    for (uint256 i = 0; i < targets.length; i++) {
      approvedTargets[targets[i]] = isApproved[i];
    }
  }

  /**
    @dev Toggles the contract's active state
     */
  function toggleContractActive() public onlyOwner {
    stopped = !stopped;
  }

  receive() external payable {
    require(msg.sender != tx.origin, 'Do not send ETH directly');
  }
}
