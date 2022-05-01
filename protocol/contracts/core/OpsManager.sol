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
        ERC20 revalToken
    ) external onlyOwner  {
        Exposure exposure = OpsManagerLib.createExposure(name, symbol, revalToken, activeExposures, pools);
        emit CreateExposure(address(exposure), address(pools[exposure]));
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
        emit CreateVault(address(vault));
    }

    /**
     * @notice Account for revenue earned by minting shares in a given strategy
     *
     * @dev pre-condition expected to hold is all vaults that are not in their
     * entry/exit period have been rebalanced and are holding the correct portion
     * of shares expected in TreasuryFarmingRevenue
     */
    function addRevenue(Exposure[] memory exposures, uint256 amount) external onlyOwner {
        for (uint256 i = 0; i < exposures.length; i++) {
            pools[exposures[i]].addRevenue(amount);
        }
    }

    function rebalance(Vault[] memory vaults, IERC20 exposureToken) external {
        require(address(pools[exposureToken]) != address(0), "No exposure/revenue farming pool for the given ERC20 Token");

        for (uint256 i = 0; i < vaults.length; i++) {
            require(activeVaults[address(vaults[i])], "FarmingRevenueMnager: invalid/inactive vault in array");
            OpsManagerLib.rebalance(vaults[i], pools[exposureToken]);
        }
    }

    /**
     * @notice claim revenue attributed to the given vault, into the given exposure
     * @dev not required to be called, exposed if vault users want to spend the gas to
     * keep the accounts and compounding up to date at a faster rate than the automated
     * ops process
     */
    function claim(Vault[] memory vaults, IERC20 exposureToken) external {
        require(address(pools[exposureToken]) != address(0), "No exposure/revenue farming pool for the given ERC20 Token");

        for (uint256 i = 0; i < vaults.length; i++) {
            require(activeVaults[address(vaults[i])], "FarmingRevenueMnager: invalid/inactive vault in array");
            pools[exposureToken].claimFor(address(vaults[i]));
        }
    }

    /**
     * @notice For the given vaults, liquidate their exposures back to temple
     */
    // TODO(butler): operationally, is this better to be a list of ERC20 address
    // (will be consistent with all other RPC methods, but add some gas)
    function liquidateExposures(Vault[] memory vaults, Exposure[] memory exposures) external {
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

    event CreateVault(address vault);
    event CreateExposure(address exposure, address primaryRevenue);
}
