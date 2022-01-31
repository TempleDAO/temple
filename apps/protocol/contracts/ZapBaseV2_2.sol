// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.0;

import '@rari-capital/solmate/src/utils/SafeTransferLib.sol';
import '@rari-capital/solmate/src/tokens/ERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

interface IWETH {
  function deposit() external payable;

  function withdraw(uint256 wad) external;
}

abstract contract ZapBaseV2_2 is Ownable {
  bool public paused;

  address private constant wethTokenAddress =
    0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

  // swapTarget => approval status
  mapping(address => bool) public approvedTargets;

  // circuit breaker modifiers
  modifier whenNotPaused() {
    require(!paused, 'Paused');
    _;
  }

  /**
    @dev Transfers tokens (including ETH) from msg.sender to this contract
    @dev For use with Zap Ins
    @param token The ERC20 token to transfer to this contract (0 address if ETH)
    @return Quantity of tokens transferred to this contract
     */
  function _pullTokens(address token, uint256 amount)
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

    SafeTransferLib.safeTransferFrom(
      ERC20(token),
      msg.sender,
      address(this),
      amount
    );

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
      balance = ERC20(token).balanceOf(address(this));
    }
  }

  /**
    @notice Approve a token for spending with infinite allowance
    @param token The ERC20 token to approve
    @param spender The spender of the token
     */
  function _approveToken(address token, address spender) internal {
    ERC20 _token = ERC20(token);
    if (_token.allowance(address(this), spender) > 0) return;
    else {
      SafeTransferLib.safeApprove(_token, spender, type(uint256).max);
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
    SafeTransferLib.safeApprove(ERC20(token), spender, 0);
    SafeTransferLib.safeApprove(ERC20(token), spender, amount);
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
    paused = !paused;
  }

  receive() external payable {
    require(msg.sender != tx.origin, 'Do not send ETH directly');
  }
}
