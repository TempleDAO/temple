pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./Position.sol";

/**
 * @title Account for primary farming revenue earned
 *
 * @dev Each instance of this contract accounts for unclaimed revenue
 * in a specific token. This is captured via Books (where revenue earned
 * by a specific token can compound and be correctly accounted for to 
 * the appropriate vault)
 */
contract FarmingRevenue is Ownable {
    /// @dev When revenue is claimed, it's accumulated into
    /// a position. A position is a collection of strategies that is ultimately
    /// accounted for in a given token type (eg. FXS, CVX, Frax etc)
    Position position;

    /// @notice total shares held by any account
    mapping(address => uint256) public shares;

    /// @notice total number of shares currently in circulation
    uint256 public totalShares; 

    /// @notice Amount claimed by a given account
    mapping(address => uint256) public claimedByScaled;

    /// @notice Total revenue earned over the lifetime of this contract
    uint256 public lifetimeAccRevenueScaledByShare;

    /// @dev factor by which lifetimeAccRevenueScaledByShare is scaled
    uint256 constant SCALING_FACTOR = 1e18;

    event IncreaseShares(address account, uint256 amount);
    event DecreaseShares(address account, uint256 amount);
    event RevenueEarned(uint256 revenueEarned, uint256 lifetimeAccRevenueScaledByShare);
    event RevenueClaimed(address account, uint256 revenueClaimed);

    constructor(Position _position) {
        position = _position;
    }

    /**
     * @dev increase revenue for a given token
     */
    function addRevenue(uint256 revenueEarned) onlyOwner public {
        lifetimeAccRevenueScaledByShare += revenueEarned * SCALING_FACTOR / totalShares;
        emit RevenueEarned(revenueEarned, lifetimeAccRevenueScaledByShare);
    }

    function increaseShares(address account, uint256 amount) onlyOwner external {
        claimFor(account);

        shares[account] += amount;
        totalShares += amount;
        claimedByScaled[account] += amount * lifetimeAccRevenueScaledByShare;

        emit IncreaseShares(account, amount);
    }

    /**
     * @dev Decrease shares held by account
     */
    function decreaseShares(address account, uint256 amount) onlyOwner external {
        claimFor(account);

        shares[account] -= amount;
        totalShares -= amount;
        claimedByScaled[account] -= amount * lifetimeAccRevenueScaledByShare;

        emit DecreaseShares(account, amount);
    }

    /// @dev Claim revenue for a given (account,token)
    function claimFor(address account) public {
        if (shares[account] > 0) {
            // FarmingRevenue: no shares for account, nothing to claim
            return;
        }

        uint256 totalScaled = shares[account] * lifetimeAccRevenueScaledByShare;
        uint256 unclaimedScaled = totalScaled - claimedByScaled[account];
        claimedByScaled[account] = totalScaled;

        position.mint(account, unclaimedScaled / SCALING_FACTOR);
        emit RevenueClaimed(account, unclaimedScaled / SCALING_FACTOR);
    }
}