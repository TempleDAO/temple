pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/strategies/AbstractStrategy.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Governable } from "contracts/common/access/Governable.sol";

import { ITempleStrategy, ITreasuryReservesVault } from "contracts/interfaces/v2/strategies/ITempleStrategy.sol";
import { ITempleDebtToken } from "contracts/interfaces/v2/ITempleDebtToken.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

import { StrategyExecutors } from "contracts/v2/StrategyExecutors.sol";

/**
 * @dev Abstract base contract implementation of a Temple Strategy. 
 * All strategies should inherit this.
 */
abstract contract AbstractStrategy is ITempleStrategy, Governable, StrategyExecutors {
    using SafeERC20 for IERC20;
    string public constant API_VERSION = "1.0.0";

    /**
     * @notice A human readable name of the strategy
     */
    string public override strategyName;

    /**
     * @notice The address of the treasury reserves vault.
     */
    ITreasuryReservesVault public override treasuryReservesVault;

    /**
     * @notice The address of the stable token (eg DAI) used to value all strategy's assets and debt.
     */
    IERC20 public immutable override stableToken;

    /**
     * @notice The address of the internal debt token used by all strategies.
     */
    ITempleDebtToken public immutable override internalDebtToken;

    constructor(
        address _initialGov,
        string memory _strategyName,
        address _treasuryReservesVault,
        address _stableToken,
        address _internalDebtToken
    ) Governable(_initialGov) {
        strategyName = _strategyName;
        treasuryReservesVault = ITreasuryReservesVault(_treasuryReservesVault);
        stableToken = IERC20(_stableToken);
        internalDebtToken = ITempleDebtToken(_internalDebtToken);
    }

    /**
     * @notice Grant `_account` the strategy executor role
     * @dev Derived classes to implement and add protection on who can call
     */
    function addStrategyExecutor(address _account) external override onlyGov {
        _addStrategyExecutor(_account);
    }

    /**
     * @notice Revoke the strategy executor role from `_account`
     * @dev Derived classes to implement and add protection on who can call
     */
    function removeStrategyExecutor(address _account) external override onlyGov {
        _removeStrategyExecutor(_account);
    }

    /**
     * @notice Governance can set the address of the treasury reserves vault.
     */
    function setTreasuryReservesVault(address _trv) external override onlyGov {
        if (_trv == address(0)) revert CommonEventsAndErrors.InvalidAddress(_trv);

        emit TreasuryReservesVaultSet(_trv);
        treasuryReservesVault = ITreasuryReservesVault(_trv);
        string memory trvVersion = treasuryReservesVault.apiVersion();
        if (
            keccak256(abi.encodePacked(trvVersion)) == 
            keccak256(abi.encodePacked(API_VERSION))
        ) revert InvalidVersion(API_VERSION, trvVersion);
    }

    /**
     * @notice Track the deployed version of this contract. 
     */
    function apiVersion() external pure override returns (string memory) {
        return API_VERSION;
    }

    /**
     * @notice The strategy executor can shutdown this strategy, only after Governance has 
     * marked the strategy as `isShuttingDown` in the TRV.
     * This assumes all liquidations were handled manually and sent back to the Treasury.
     * It will call `TRV.shutdown()` to apply the shutdown.
    */
    function forceShutdown(uint256 stablesRecovered) external onlyStrategyExecutors {
        emit Shutdown(true, stablesRecovered);
        treasuryReservesVault.shutdown(address(this), stablesRecovered);
    }

    /**
     * @notice Governance can recover any token
     * @param token Token to recover
     * @param to Recipient address
     * @param amount Amount to recover
     */
    function recoverToken(address token, address to, uint256 amount) external onlyGov {
        emit CommonEventsAndErrors.TokenRecovered(to, token, amount);
        IERC20(token).safeTransfer(to, amount);
    }

}