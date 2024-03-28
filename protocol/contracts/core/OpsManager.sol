pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later

import "@openzeppelin/contracts/access/Ownable.sol";

import "./Exposure.sol";
import "./TreasuryFarmingRevenue.sol";
import "./Vault.sol";
import "./VaultedTemple.sol";
import "./Rational.sol";
import "./JoiningFee.sol";
import "./OpsManagerLib.sol";

/**
 * @title Manage all active treasury farmining revenue.
 */
contract OpsManager is Ownable {
    mapping(IERC20 => TreasuryFarmingRevenue) public pools;
    address[] public revalTokens;
    mapping(address => bool) public activeVaults;
    address[] allVaults;

    IERC20 public immutable templeToken;
    JoiningFee public immutable joiningFee;
    Exposure public templeExposure;
    VaultedTemple public vaultedTemple;

    constructor(
        IERC20 _templeToken, 
        JoiningFee _joiningFee
    ) Ownable(msg.sender) {
        templeToken = _templeToken;
        joiningFee = _joiningFee;

        templeExposure = new Exposure("vaulted temple", "V_TEMPLE", _templeToken);
        templeExposure.setMinterState(address(this), true);
        vaultedTemple = new VaultedTemple(_templeToken, address(templeExposure));
        templeExposure.setLiqidator(vaultedTemple);
        vaultedTemple.transferOwnership(msg.sender);
    }

    /**
     * @notice Create a new Exposure + associated pool
     */
    function createExposure(
        string memory name,
        string memory symbol,
        IERC20 revalToken
    ) external onlyOwner  {
        require(address(pools[revalToken]) == address(0));
        Exposure exposure = OpsManagerLib.createExposure(name, symbol, revalToken, pools);
        revalTokens.push(address(revalToken));
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
        Rational memory shareBoostFactor,
        uint256 firstPeriodStartTimestamp
    ) external onlyOwner {
        Vault vault = new Vault(
            name, 
            symbol,
            templeToken,
            templeExposure,
            address(vaultedTemple),
            periodDuration,
            enterExitWindowDuration,
            shareBoostFactor,
            joiningFee,
            firstPeriodStartTimestamp
        );

        activeVaults[address(vault)] = true;
        allVaults.push(address(vault));

        templeExposure.setMinterState(address(vault), true);
        emit CreateVaultInstance(address(vault));
    }

    /**
     * @notice Rebalance a set of vaults share of primary revenue earned
     */
    function rebalance(Vault[] memory vaults, IERC20 exposureToken) external {
        require(address(pools[exposureToken]) != address(0), "No exposure/revenue farming pool for the given ERC20 Token");

        for (uint256 i = 0; i < vaults.length; i++) {
            require(activeVaults[address(vaults[i])], "OpsManager: invalid/inactive vault in array");
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
        OpsManagerLib.updateExposureReval(exposureTokens, revals, pools);
    }

    /**
     * @notice Add temple to vaults
     * @dev expects both lists to be the same size, as we zip and process them
     * as tuples
     */
    function increaseVaultTemple(Vault[] memory vaults, uint256[] memory amountsTemple) external onlyOwner {
        require(vaults.length == amountsTemple.length, "vaults and amounts array must be the same length");

        for (uint256 i = 0; i < vaults.length; i++) {
            require(activeVaults[address(vaults[i])], "OpsManager: invalid vault in array");
            templeExposure.mint(address(vaults[i]), amountsTemple[i]);
        }
    }

    /**
     * @notice For the given vaults, liquidate their exposures back to temple
     * @dev expects both lists to be the same size, as we zip and process them
     * as tuples
     */
    function liquidateExposures(Vault[] memory vaults, IERC20[] memory exposureTokens) external onlyOwner {
        Exposure[] memory exposures = new Exposure[](exposureTokens.length);

        for (uint256 i = 0; i < exposureTokens.length; i++) {
            exposures[i] = pools[exposureTokens[i]].exposure();
        }

        for (uint256 i = 0; i < vaults.length; i++) {
            require(activeVaults[address(vaults[i])], "OpsManager: invalid vault in array");
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

    /**
        Proxy function to set a liquidator for a given exposure; needed as OpsManager is the owner of all exposures created
        with the OpsManager.
     */
    function setExposureLiquidator(IERC20 exposureToken, ILiquidator _liquidator) external onlyOwner {
        OpsManagerLib.setExposureLiquidator(pools, exposureToken, _liquidator);
    }

    /**
        Proxy function to set minter state for a given exposure; needed as OpsManager is the owner of all exposures created
        with the OpsManager.
     */
    function setExposureMinterState(IERC20 exposureToken, address account, bool state) external onlyOwner {
        OpsManagerLib.setExposureMinterState(pools, exposureToken, account, state);
    }

    event CreateVaultInstance(address vault);
    event CreateExposure(address exposure, address primaryRevenue);
}
