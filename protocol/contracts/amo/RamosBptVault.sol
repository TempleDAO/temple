pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title Holding account of BPT tokens used within RAMOS.
/// @notice Used within RAMOS when we wish to only hold BPT tokens and not stake them in Aura.
/// @dev This implements the same `depositAndStake()` and `withdrawAndUnwrap()` interface
///      as AuraStaking, however just holds the BPT, it does not stake in Aura.
contract RamosBptVault is Ownable {
    using SafeERC20 for IERC20;

    address public operator;

    /// @notice BPT tokens for balancer pool
    IERC20 public immutable bptToken;

    error NotOperator();
    error NotOperatorOrOwner();

    event SetOperator(address operator);
    event RecoveredToken(address token, address to, uint256 amount);

    constructor(
        address _operator,
        IERC20 _bptToken
    ) {
        operator = _operator;
        bptToken = _bptToken;
    }

    /**
     * @notice Set operator
     * @param _operator New operator
     */
    function setOperator(address _operator) external onlyOwner {
        operator = _operator;
        emit SetOperator(_operator);
    }

    /**
     * @notice Recover any token from AMO
     * @param token Token to recover
     * @param to Recipient address
     * @param amount Amount to recover
     */
    function recoverToken(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
        emit RecoveredToken(token, to, amount);
    }
    
    function depositAndStake(uint256 amount) external onlyOperator {
        // no-op. The BPT tokens have already been transferred to this contract before this is called.
    }

    /// @notice transfer any BPT tokens
    function withdrawAndUnwrap(uint256 amount, bool /*claim*/, address to) external onlyOperatorOrOwner {
        if (to != address(0)) {
            bptToken.safeTransfer(to, amount);
        }
    }

    modifier onlyOperator() {
        if (msg.sender != operator) {
            revert NotOperator();
        }
        _;
    }

    modifier onlyOperatorOrOwner() {
        if (msg.sender != operator && msg.sender != owner()) {
            revert NotOperatorOrOwner();
        }
        _;
    }
}