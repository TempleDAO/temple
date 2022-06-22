pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

abstract contract ZapBaseV2_3 is Ownable {
  using SafeERC20 for IERC20;

  bool public paused;

  // swapTarget => approval status
  mapping(address => bool) public approvedTargets;

  receive() external payable {
    require(msg.sender != tx.origin, "Do not send ETH directly");
  }

  /**
    @dev Adds or removes an approved swapTarget
    * swapTargets should be Zaps and must not be tokens!
    @param _targets An array of addresses of approved swapTargets
    @param _isApproved An array of booleans if target is approved or not
    */
  function setApprovedTargets(
    address[] calldata _targets,
    bool[] calldata _isApproved
  ) external onlyOwner {
    uint256 _length = _isApproved.length;
    require(_targets.length == _length, "Invalid Input length");

    for (uint256 i = 0; i < _length; i++) {
      approvedTargets[_targets[i]] = _isApproved[i];
    }
  }

  /**
    @dev Toggles the contract's active state
     */
  function toggleContractActive() external onlyOwner {
    paused = !paused;
  }

  /**
    @notice Approve a token for spending with finite allowance
    @param _token The ERC20 token to approve
    @param _spender The spender of the token
    @param _amount The allowance to grant to the spender
     */
  function _approveToken(
    address _token,
    address _spender,
    uint256 _amount
  ) internal {
    IERC20(_token).safeIncreaseAllowance(_spender, _amount);
  }

  /**
    @notice Gets this contract's balance of a token
    @param _token The ERC20 token to check the balance of (0 address if ETH)
    @return balance This contract's token balance
     */
  function _getBalance(address _token) internal view returns (uint256 balance) {
    if (_token == address(0)) {
      balance = address(this).balance;
    } else {
      balance = IERC20(_token).balanceOf(address(this));
    }
  }

  // circuit breaker modifiers
  modifier whenNotPaused() {
    require(!paused, "Paused");
    _;
  }

}
