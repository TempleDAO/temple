pragma solidity 0.8.20;
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
        uint96 targetTpi;

        /// @notice The time at which TPI was last updated
        uint32 lastUpdatedAt;

        /// @notice The date which the target TPI should be reached.
        uint32 targetDate;

        /// @notice The rate at which the currentTpi will change over time until targetDate.
        uint96 tpiSlope;   

        /// @notice Used to determine positive or negative slope
        bool increaseInTargetTpi;
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

    /**
     * @notice The maximum allowed TPI change on any single `setTreasuryPriceIndex()`, in absolute terms.
     * @dev Used as a bound to avoid unintended/fat fingering when updating TPI
     */
    uint32 public override maxTreasuryPriceIndexTargetDateDelta;

    constructor(
        address _initialRescuer,
        address _initialExecutor,
        uint96 _initialTreasuryPriceIndex,
        uint256 _maxTreasuryPriceIndexDelta,
        uint32 _maxTreasuryPriceIndexTargetDateDelta
    ) TempleElevatedAccess(_initialRescuer, _initialExecutor)
    {
        tpiData = TpiData({
            currentTpi: _initialTreasuryPriceIndex,
            targetTpi: _initialTreasuryPriceIndex,
            lastUpdatedAt: uint32(block.timestamp),
            targetDate: uint32(block.timestamp),
            tpiSlope: 1,
            increaseInTargetTpi: true
        });
        maxTreasuryPriceIndexDelta = _maxTreasuryPriceIndexDelta;
        maxTreasuryPriceIndexTargetDateDelta = _maxTreasuryPriceIndexTargetDateDelta;
    }

    /**
     * @notice The current Treasury Price Index (TPI) value
     * @dev If the TPI has just been updated, the old TPI will be used until `cooldownSecs` has elapsed
     */
    function treasuryPriceIndex() public override view returns (uint96) {
        if (block.timestamp >= tpiData.targetDate) {
            return tpiData.targetTpi;  /// @dev target reached, no calculation required.
        } else {
            return (tpiData.increaseInTargetTpi) ?
                uint96(tpiData.currentTpi + (((tpiData.targetDate - tpiData.lastUpdatedAt) - (tpiData.targetDate - block.timestamp)) * tpiData.tpiSlope))  /// @dev use the calculated current TPI - positive slope.
                :
                uint96(tpiData.currentTpi - (((tpiData.targetDate - tpiData.lastUpdatedAt) - (tpiData.targetDate - block.timestamp)) * tpiData.tpiSlope));  /// @dev use the calculated current TPI - negative slope.
        }
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
     * @notice The maximum allowed TPI change on any single `setTreasuryPriceIndex()`, in absolute terms.
     * @dev Used as a bound to avoid unintended/fat fingering when updating TPI
     */
    function setMaxTreasuryPriceIndexTargetDateDelta(uint32 maxTargetDateDelta) external override onlyElevatedAccess {
        emit MaxTreasuryPriceIndexTargetDateDeltaSet(maxTargetDateDelta);
        maxTreasuryPriceIndexTargetDateDelta = maxTargetDateDelta;
    }

    /**
     * @notice Set the target TPI which will incrementally increase over the given targetDate.
     * @dev targetDate is unixtime, targetRate is target TPi, 18 decimal places, 1.05e18 == $1.05
     */
    function setTreasuryPriceIndexAt(uint96 targetRate, uint32 targetDate) external override onlyElevatedAccess {
        uint96 _currentTpi = treasuryPriceIndex();
        uint96 _newTpi = targetRate;

        // Check delta is within margins
        unchecked {
            uint256 _delta = (_newTpi > _currentTpi) ? _newTpi - _currentTpi : _currentTpi - _newTpi;
            if (_delta > maxTreasuryPriceIndexDelta) revert BreachedMaxTpiDelta(_currentTpi, _newTpi, maxTreasuryPriceIndexDelta);

            if (targetDate + uint32(block.timestamp) < maxTreasuryPriceIndexTargetDateDelta) revert BreachedMaxDateDelta(targetDate, uint32(block.timestamp), maxTreasuryPriceIndexTargetDateDelta);
        }

        /// @dev calculate slope = (targetRate-currentRate)/(targetDate-currentDate)
        bool increaseInTpi = _newTpi > _currentTpi;

        uint96 slopeNumerator = increaseInTpi ? (_newTpi - _currentTpi) : (_currentTpi - _newTpi);
        uint96 _slope = slopeNumerator / (targetDate - uint32(block.timestamp));

        tpiData = TpiData({
            currentTpi: _currentTpi,
            targetTpi: _newTpi,
            lastUpdatedAt: uint32(block.timestamp),
            targetDate: targetDate,
            tpiSlope: _slope,
            increaseInTargetTpi: increaseInTpi
        });

        emit TreasuryPriceIndexSetAt(_currentTpi, _newTpi, targetDate);
    }

}