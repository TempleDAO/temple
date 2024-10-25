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
 */
contract TreasuryPriceIndexOracle is ITreasuryPriceIndexOracle, TempleElevatedAccess {
    /**
     * @notice The decimal precision of Temple Price Index (TPI)
     * @dev 18 decimals, so 1.02e18 == $1.02
     */
    uint256 public constant override TPI_DECIMALS = 18;

    struct TpiData {
        /// @notice The current Treasury Price Index - the target price of the Treasury, in `stableToken` terms.
        uint96 currentTpi;

        /// @notice The target TPI at the `targetDate`
        uint96 targetTpi;

        /// @notice The time at which TPI was last updated via `setTreasuryPriceIndexAt()`
        uint32 lastUpdatedAt;

        /// @notice The date which the `targetTpi` will be reached.
        uint32 targetDate;

        /// @notice The rate at which the `currentTpi` will change over time from `lastUpdatedAt` until `targetDate`.
        int96 tpiSlope;
    }
    
    /**
     * @notice The current TPI state data
     */
    TpiData public override tpiData;

    /**
     * @notice The maximum allowed TPI change on any single `setTreasuryPriceIndexAt()`, in absolute terms
     * between the TPI as of now and the targetTpi
     * @dev 18 decimal places, 0.20e18 == $0.20. 
     * Used as a bound to avoid unintended/fat fingering when updating TPI
     */
    uint96 public override maxTreasuryPriceIndexDelta;

    /**
     * @notice The minimum time delta required for TPI to reach it's target value when 
     * `setTreasuryPriceIndexAt()` is called.
     * @dev In seconds.
     * Used as a bound to avoid unintended/fat fingering when updating TPI
     */
    uint32 public override minTreasuryPriceIndexTargetDateDelta;

    constructor(
        address _initialRescuer,
        address _initialExecutor,
        uint96 _initialTreasuryPriceIndex,
        uint96 _maxTreasuryPriceIndexDelta,
        uint32 _minTreasuryPriceIndexTargetDateDelta
    ) TempleElevatedAccess(_initialRescuer, _initialExecutor)
    {
        tpiData = TpiData({
            currentTpi: _initialTreasuryPriceIndex,
            targetTpi: _initialTreasuryPriceIndex,
            lastUpdatedAt: uint32(block.timestamp),
            targetDate: uint32(block.timestamp),
            tpiSlope: 0
        });
        maxTreasuryPriceIndexDelta = _maxTreasuryPriceIndexDelta;
        minTreasuryPriceIndexTargetDateDelta = _minTreasuryPriceIndexTargetDateDelta;
    }

    /**
     * @notice The current Treasury Price Index (TPI) value
     */
    function treasuryPriceIndex() public override view returns (uint96) {
        uint32 _now = uint32(block.timestamp);
        if (_now >= tpiData.targetDate) {
            // Target date reached, no calculation required just return the target TPI
            return tpiData.targetTpi;  
        } else {
            unchecked {
                int96 delta = tpiData.tpiSlope * int32(_now - tpiData.lastUpdatedAt);
                return uint96(delta + int96(tpiData.currentTpi));
            }
        }
     }

    /**
     * @notice Set the maximum allowed TPI change on any single `setTreasuryPriceIndexAt()`, in absolute terms
     * between the TPI as of now and the targetTpi
     * @dev 18 decimal places, 0.20e18 == $0.20
     */
    function setMaxTreasuryPriceIndexDelta(uint96 maxDelta) external override onlyElevatedAccess {
        emit MaxTreasuryPriceIndexDeltaSet(maxDelta);
        maxTreasuryPriceIndexDelta = maxDelta;
    }

    /**
     * @notice Set the minimum time delta required for TPI to reach it's target value when 
     * `setTreasuryPriceIndexAt()` is called.
     * @dev In seconds.
     */
    function setMinTreasuryPriceIndexTargetDateDelta(uint32 minTargetDateDelta) external override onlyElevatedAccess {
        emit MinTreasuryPriceIndexTargetDateDeltaSet(minTargetDateDelta);
        minTreasuryPriceIndexTargetDateDelta = minTargetDateDelta;
    }

    /**
     * @notice Set the target TPI which will incrementally increase from it's current value to `targetTpi`
     * between now and `targetDate`.
     * @dev targetDate is unixtime, targetTpi is 18 decimal places, 1.05e18 == $1.05
     */
    function setTreasuryPriceIndexAt(uint96 targetTpi, uint32 targetDate) external override onlyElevatedAccess {
        uint96 _currentTpi = treasuryPriceIndex();
        uint32 _now = uint32(block.timestamp);
        int96 _tpiDelta = int96(targetTpi) - int96(_currentTpi);

        // targetDate must be at or after (now + minTreasuryPriceIndexTargetDateDelta)
        if (targetDate < _now + minTreasuryPriceIndexTargetDateDelta) revert BreachedMinDateDelta(targetDate, _now, minTreasuryPriceIndexTargetDateDelta);
        uint32 _timeDelta = targetDate - _now;

        // Check absolute delta is within tolerance
        uint96 _absDelta = _tpiDelta < 0 ? uint96(-1 * _tpiDelta) : uint96(_tpiDelta);
        if (_absDelta > maxTreasuryPriceIndexDelta) revert BreachedMaxTpiDelta(_currentTpi, targetTpi, maxTreasuryPriceIndexDelta);

        tpiData = TpiData({
            currentTpi: _currentTpi,
            targetTpi: targetTpi,
            lastUpdatedAt: _now,
            targetDate: targetDate,
            tpiSlope: _tpiDelta / int32(_timeDelta)
        });

        emit TreasuryPriceIndexSetAt(_currentTpi, targetTpi, targetDate);
    }

}