pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/TreasuryPriceIndexOracle.sol)

import { ITreasuryPriceIndexOracle } from "contracts/interfaces/v2/ITreasuryPriceIndexOracle.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";

/* solhint-disable not-rely-on-time */

/**
 * @title Treasury Price Index Oracle
 * @notice The custom oracle (not dependant on external markets/AMMs/dependencies) to give the
 * Treasury Price Index, representing the target Treasury Value per token.
 * This rate is updated manually with elevated permissions. The new TPI doesn't take effect until after a cooldown.
 */
contract TreasuryPriceIndexOracle is ITreasuryPriceIndexOracle, TempleElevatedAccess {
    /**
     * @notice The decimal precision of Temple Price Index (TPI)
     * @dev 18 decimals, so 1.02e18 == $1.02
     */
    uint256 public constant override TPI_DECIMALS = 18;

    struct TpiData {
        /// @notice The Treasury Price Index - the target price of the Treasury, in `stableToken` terms.
        uint96 currentTpi;

        /// @notice The previous TPI - used if there hasn't been enough elapsed time since the last update
        uint96 previousTpi;

        /// @notice The time at which TPI was last updated
        uint32 lastUpdatedAt;

        /// @notice When TPI is updated, it doesn't immediately take effect.
        /// The new TPI takes effect after this cooldown has elapsed.
        uint32 cooldownSecs;
    }
    
    /**
     * @notice The current TPI data along with when it was last reset, and the prior value
     */
    TpiData public override tpiData;

    /**
     * @notice The maximum allowed TPI change on any single `setTreasuryPriceIndex()`, in absolute terms.
     * @dev Used as a bound to avoid unintended/fat fingering when updating TPI
     */
    uint256 public override maxTreasuryPriceIndexDelta;

    constructor(
        address _initialRescuer,
        address _initialExecutor,
        uint96 _initialTreasuryPriceIndex,
        uint256 _maxTreasuryPriceIndexDelta,
        uint32 _cooldownSecs
    ) TempleElevatedAccess(_initialRescuer, _initialExecutor)
    {
        tpiData = TpiData({
            currentTpi: _initialTreasuryPriceIndex,
            previousTpi: _initialTreasuryPriceIndex,
            lastUpdatedAt: uint32(block.timestamp),
            cooldownSecs: _cooldownSecs
        });
        maxTreasuryPriceIndexDelta = _maxTreasuryPriceIndexDelta;
    }

    /**
     * @notice The current Treasury Price Index (TPI) value
     * @dev If the TPI has just been updated, the old TPI will be used until `cooldownSecs` has elapsed
     */
    function treasuryPriceIndex() public override view returns (uint96) {
        return (block.timestamp < (tpiData.lastUpdatedAt + tpiData.cooldownSecs))
            ? tpiData.previousTpi  // use the previous TPI if we haven't passed the cooldown yet.
            : tpiData.currentTpi;  // use the new TPI
    }

    /**
     * @notice Set the number of seconds to elapse before a new TPI will take effect.
     */
    function setTpiCooldown(uint32 cooldownSecs) external override onlyElevatedAccess {
        emit TpiCooldownSet(cooldownSecs);
        tpiData.cooldownSecs = cooldownSecs;
    }

    /**
     * @notice Set the maximum allowed TPI change on any single `setTreasuryPriceIndex()`, in absolute terms.
     * @dev 18 decimal places, 0.20e18 == $0.20
     */
    function setMaxTreasuryPriceIndexDelta(uint256 maxDelta) external override onlyElevatedAccess {
        emit MaxTreasuryPriceIndexDeltaSet(maxDelta);
        maxTreasuryPriceIndexDelta = maxDelta;
    }

    /**
     * @notice Set the Treasury Price Index (TPI)
     * @dev 18 decimal places, 1.05e18 == $1.05
     */
    function setTreasuryPriceIndex(uint96 value) external override onlyElevatedAccess {
        // If the cooldownSecs hasn't yet passed since the last update, then this will still
        // refer to the `previousTpi` value
        uint96 _oldTpi = treasuryPriceIndex();
        uint96 _newTpi = value;

        unchecked {
            uint256 _delta = (_newTpi > _oldTpi) ? _newTpi - _oldTpi : _oldTpi - _newTpi;
            if (_delta > maxTreasuryPriceIndexDelta) revert BreachedMaxTpiDelta(_oldTpi, _newTpi, maxTreasuryPriceIndexDelta);
        }

        emit TreasuryPriceIndexSet(_oldTpi, _newTpi);

        tpiData = TpiData({
            currentTpi: _newTpi,
            previousTpi: _oldTpi,
            lastUpdatedAt: uint32(block.timestamp),
            cooldownSecs: tpiData.cooldownSecs
        });
    }

}