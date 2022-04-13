pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later

import "@openzeppelin/contracts/access/Ownable.sol";

import "./Position.sol";
import "./FarmingRevenue.sol";
import "./Vault.sol";
import "./Rational.sol";

/**
 * @title Manage all active treasury farmining revenue.
 */
contract OpsManager is Ownable {
    mapping(Position => FarmingRevenue) public pools;
    Position[] public activePositions;
    mapping(address => bool) public activeVaults;

    IERC20 public templeToken;

    constructor(IERC20 _templeToken) {
        templeToken = _templeToken;
    }

    /**
     * @notice Create a new Position
     */
    function createPosition(
        string memory name,
        string memory symbol,
        ERC20 revalToken
    ) external onlyOwner  { 
        // Create position and transfer ownership to the caller
        Position position = new Position(name, symbol, revalToken, address(this));
        activePositions.push(position);
        position.transferOwnership(msg.sender);

        // Create a FarmingRevenue pool associated with this position
        pools[position] = new FarmingRevenue(position);
        position.addMinter(address(pools[position]));
    }

    /**
     * @notice Create a new vault
     */
    function createVault(
        string memory name,
        string memory symbol,
        uint256 periodDuration,
        uint256 enterExitWindowDuration,
        Rational memory shareBoostFactory
    ) external onlyOwner {
        Vault vault = new Vault(name, symbol, templeToken, periodDuration, enterExitWindowDuration, shareBoostFactory);
        activeVaults[address(vault)] = true;
    }

    /**
     * @notice Account for revenue earned by minting shares in a given strategy
     *
     * @dev vaults array given should be the set of vaults currently in their entry/exit period
     * as they need to be synced with the correct amount of shares automically before revenue is 
     * added
     */
    function addRevenue(IVault[] memory vaults, Position position, uint256 amount) external onlyOwner {
        rebalance(vaults, position);
        pools[position].addRevenue(amount);
    }

    /**
     * @notice For the given vaults, liquidate their positions back to temple
     *
     */
    function liquidatePositions(IVault[] memory vaults, Position[] memory positions) external {
        for (uint256 i = 0; i < vaults.length; i++) {
            require(activeVaults[address(vaults[i])], "FarmingRevenueMnager: invalid/inactive vault in array");

            for (uint256 j = 0; i < positions.length; i++) {
                vaults[i].claim(positions[j]);
            }
        }
    }

    function rebalance(IVault[] memory vaults, Position position) public {
        for (uint256 i = 0; i < vaults.length; i++) {
            require(activeVaults[address(vaults[i])], "FarmingRevenueMnager: invalid/inactive vault in array");

            uint256 currentRevenueShare = pools[position].shares(address(vaults[i]));
            uint256 targetRevenueShare= vaults[i].targetRevenueShare();

            if (targetRevenueShare > currentRevenueShare) {
                pools[position].increaseShares(address(vaults[i]), targetRevenueShare - currentRevenueShare);
            } else if (targetRevenueShare < currentRevenueShare) {
                pools[position].decreaseShares(address(vaults[i]), currentRevenueShare - targetRevenueShare);
            } else {
                pools[position].claimFor(address(vaults[i]));
            }
        }
    }
}

interface IVault {
    function targetRevenueShare() external view returns (uint256);
    function claim(Position position) external;
}

