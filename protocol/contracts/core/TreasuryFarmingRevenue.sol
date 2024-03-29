pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./Exposure.sol";

/**
 * @title Account for revenue earned from farming temple's Treasury
 *
 * @dev Each instance of this contract accounts for unclaimed revenue
 * in a specific token. Once claimed, it's accounted for in 
 * Exposure. Exposure is our concept for revenue claimed and compounding
 * in assets the temple auto farming strategy.
 */
contract TreasuryFarmingRevenue is Ownable {
    /// @dev When revenue is claimed, it's accumulated into
    /// an exposure. An exposure is a collection of strategies that is ultimately
    /// accounted for in a given token type (eg. FXS, CVX, Frax etc)
    Exposure public immutable exposure;

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

    constructor(Exposure _exposure) Ownable(msg.sender) {
        exposure = _exposure;
    }

    /**
     * @dev increase revenue for a given token.
     *
     * Please ser, rebalance as many vaults as possible before adding revenue.
     * Revenue is automatically allocated to the current share breakdown
     */
    function addRevenue(uint256 revenueEarned) onlyOwner public {
        lifetimeAccRevenueScaledByShare += revenueEarned * SCALING_FACTOR / totalShares;
        emit RevenueEarned(revenueEarned, lifetimeAccRevenueScaledByShare);
    }

    /**
     * @dev Increase shares held by account
     */
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
        // TODO(butlerji): confirm this check is redundant and delete
        // if (shares[account] == 0) {
        //     // FarmingRevenue: no shares for account, nothing to claim
        //     return;
        // }

        uint256 totalScaled = shares[account] * lifetimeAccRevenueScaledByShare;
        uint256 unclaimedScaled = totalScaled - claimedByScaled[account];
        claimedByScaled[account] = totalScaled;

        exposure.mint(account, unclaimedScaled / SCALING_FACTOR);
        emit RevenueClaimed(account, unclaimedScaled / SCALING_FACTOR);
    }

    event IncreaseShares(address account, uint256 amount);
    event DecreaseShares(address account, uint256 amount);
    event RevenueEarned(uint256 revenueEarned, uint256 lifetimeAccRevenueScaledByShare);
    event RevenueClaimed(address account, uint256 revenueClaimed);
}