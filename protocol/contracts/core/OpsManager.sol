pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later

import "@openzeppelin/contracts/access/Ownable.sol";

import "./Exposure.sol";
import "./TreasuryFarmingRevenue.sol";
import "./Vault.sol";
import "./Rational.sol";
import "./JoiningFee.sol";
import "./OpsManagerLib.sol";

import "hardhat/console.sol";

/**
 * @title Manage all active treasury farmining revenue.
 */
contract OpsManager is Ownable {
    mapping(IERC20 => TreasuryFarmingRevenue) public pools;
    Exposure[] public activeExposures;
    mapping(address => bool) public activeVaults;

    IERC20 public templeToken;
    JoiningFee public joiningFee;

    constructor(IERC20 _templeToken, JoiningFee _joiningFee) {
        templeToken = _templeToken;
        joiningFee = _joiningFee;
    }

    /**
     * @notice Create a new Exposure
     */
    function createExposure(
        string memory name,
        string memory symbol,
        IERC20 revalToken
    ) external onlyOwner  {
        Exposure exposure = OpsManagerLib.createExposure(name, symbol, revalToken, activeExposures, pools);
        emit CreateExposure(address(exposure), address(pools[revalToken]));
    }

    /**
     * @notice Create a new vault instance.
     *
     * @dev for any given time period (eg. 1 month), we expect
     * their to be multiple vault instances to allow users to
     * join continously.
     */
    function createVaultInstance(
        string memory name,
        string memory symbol,
        uint256 periodDuration,
        uint256 enterExitWindowDuration,
        Rational memory shareBoostFactory,
        uint256 firstPeriodStartTimestamp
    ) external onlyOwner {
        Vault vault = new Vault(name, symbol, templeToken, periodDuration, enterExitWindowDuration, shareBoostFactory, joiningFee, firstPeriodStartTimestamp);
        activeVaults[address(vault)] = true;
        emit CreateVaultInstance(address(vault));
    }

    /**
     * @notice Rebalance a set of vaults share of primary revenue earned
     */
    function rebalance(Vault[] memory vaults, IERC20 exposureToken) external {
        require(address(pools[exposureToken]) != address(0), "No exposure/revenue farming pool for the given ERC20 Token");

        for (uint256 i = 0; i < vaults.length; i++) {
            require(activeVaults[address(vaults[i])], "FarmingRevenueMnager: invalid/inactive vault in array");
            OpsManagerLib.rebalance(vaults[i], pools[exposureToken]);
        }
    }

    /**
     * @notice Account for revenue earned from primary farming activites
     *
     * @dev pre-condition expected to hold is all vaults that are not in their
     * entry/exit period have been rebalanced and are holding the correct portion
     * of shares expected in TreasuryFarmingRevenue
     */
    function addRevenue(IERC20[] memory exposureTokens, uint256[] memory amounts) external onlyOwner {
        require(exposureTokens.length == amounts.length, "Exposures and amounts array must be the same length");

        for (uint256 i = 0; i < exposureTokens.length; i++) {
            pools[exposureTokens[i]].addRevenue(amounts[i]);
        }
    }

    /**
     * @notice Update mark to market of temple's various exposures
     */
    function updateExposureReval(IERC20[] memory exposureTokens, uint256[] memory revals) external onlyOwner {
        require(exposureTokens.length == revals.length, "Exposures and reval amounts array must be the same length");

        for (uint256 i = 0; i < exposureTokens.length; i++) {
            Exposure exposure = pools[exposureTokens[i]].exposure();
            uint256 currentReval = exposure.reval();
            if (currentReval > revals[i]) {
                exposure.decreaseReval(currentReval - revals[i]);
            } else {
                exposure.increaseReval(revals[i] - currentReval);
            }
        }
    }

    /**
     * @notice For the given vaults, liquidate their exposures back to temple
     */
    function liquidateExposures(Vault[] memory vaults, IERC20[] memory exposureTokens) external {
        Exposure[] memory exposures = new Exposure[](exposureTokens.length);

        for (uint256 i = 0; i < exposureTokens.length; i++) {
            exposures[i] = pools[exposureTokens[i]].exposure();
        }

        for (uint256 i = 0; i < vaults.length; i++) {
            require(activeVaults[address(vaults[i])], "FarmingRevenueMnager: invalid/inactive vault in array");
            vaults[i].redeemExposures(exposures);
        }
    }

    /**
     * Return an array, same length as vaults, where each entry is true/false as to if
     * that vault requires a rebalance before updating revenue attributed to a particular
     * exposure
     */
    function requiresRebalance(Vault[] memory vaults, IERC20 exposureToken) external view returns (bool[] memory) {
        return OpsManagerLib.requiresRebalance(vaults, pools[exposureToken]);
    }


    /// @dev ****** for testing. Delete before pushing to mainnet
    /// change a set of vault's start time (so we can fast forward in and out of lock/unlock windows)
    function decreaseStartTime(Vault[] memory vaults, uint256 delta) external onlyOwner {
        for (uint256 i = 0; i < vaults.length; i++) {
            require(activeVaults[address(vaults[i])], "FarmingRevenueMnager: invalid/inactive vault in array");
            vaults[i].decreaseStartTime(delta);
        }
    }

    event CreateVaultInstance(address vault);
    event CreateExposure(address exposure, address primaryRevenue);
}
