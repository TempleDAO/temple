pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Origami (v2/DSRStrategy.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Governable } from "contracts/common/access/Governable.sol";

import { ITempleStrategy, ITreasuryReservesVault } from "contracts/interfaces/v2/ITempleStrategy.sol";
import { ITempleDebtToken } from "contracts/interfaces/v2/ITempleDebtToken.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

import { StrategyExecutors } from "contracts/v2/StrategyExecutors.sol";

/// @title Deposit idle DAI into the Maker DSR (DAI Savings Rate module)
abstract contract StrategyBase is ITempleStrategy, Governable, StrategyExecutors {
    string public constant API_VERSION = "1.0.0";

    /// A human readable name of the strategy
    string public override strategyName;

    /// @notice The address of the stable token (eg DAI) used to value all strategy's assets and debt.
    IERC20 public immutable override stableToken;

    /// @notice The address of the internal debt token used by all strategies.
    ITempleDebtToken public immutable override internalDebtToken;

    ITreasuryReservesVault public override treasuryReservesVault;

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

    function addStrategyExecutor(address _account) external override onlyGov {
        _addStrategyExecutor(_account);
    }

    function removeStrategyExecutor(address _account) external override onlyGov {
        _removeStrategyExecutor(_account);
    }

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

    // @todo add recover token...

}