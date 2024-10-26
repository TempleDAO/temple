pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/v2/ITreasuryPriceIndexOracle.sol)

import { ITempleElevatedAccess } from "contracts/interfaces/v2/access/ITempleElevatedAccess.sol";

/**
 * @title Treasury Price Index Oracle
 * @notice The custom oracle (not dependant on external markets/AMMs/dependencies) to give the
 * Treasury Price Index, representing the target Treasury Value per token.
 */
interface ITreasuryPriceIndexOracle is ITempleElevatedAccess {
    event TreasuryPriceIndexSetAt(uint96 oldTpi, uint96 newTpiTarget, uint256 targetTime);
    event MaxTreasuryPriceIndexDeltaSet(uint256 maxDelta);
    event MinTreasuryPriceIndexTargetTimeDeltaSet(uint32 maxTargetTimeDelta);
    event MaxAbsTreasuryPriceIndexRateOfChangeSet(uint96 maxAbsRateOfChange);

    error BreachedMaxTpiDelta(uint96 oldTpi, uint96 newTpi, uint256 maxDelta);
    error BreachedMinDateDelta(uint32 targetTime, uint32 currentDate, uint32 maxTargetTimeDelta);
    error BreachedMaxTpiRateOfChange(uint96 targetRateOfChange, uint96 maxRateOfChange);

    /**
     * @notice The current Treasury Price Index (TPI) value
     */
    function treasuryPriceIndex() external view returns (uint96);

    /**
     * @notice The maximum allowed TPI change on any single `setTreasuryPriceIndexAt()`, in absolute terms
     * between the TPI as of now and the targetTpi
     * @dev 18 decimal places, 0.20e18 == $0.20. 
     * Used as a bound to avoid unintended/fat fingering when updating TPI
     */
    function maxTreasuryPriceIndexDelta() external view returns (uint96);

    /**
     * @notice The minimum time delta required for TPI to reach it's target value when 
     * `setTreasuryPriceIndexAt()` is called.
     * @dev In seconds.
     * Used as a bound to avoid unintended/fat fingering when updating TPI
     */
    function minTreasuryPriceIndexTargetTimeDelta() external view returns (uint32);

    /**
     * @notice The maximum absolute rate of change of TPI allowed, when 
     * `setTreasuryPriceIndexAt()` is called.
     * @dev Units: [TPI / second]
     */
    function maxAbsTreasuryPriceIndexRateOfChange() external view returns (uint96);

    /**
     * @notice The current TPI state data
     */
    function tpiData() external view returns (
        uint96 startingTpi,
        uint32 startTime,
        uint96 targetTpi,
        uint32 targetTime,
        int96 tpiSlope
    );

    /**
     * @notice Set the maximum allowed TPI change on any single `setTreasuryPriceIndexAt()`, in absolute terms
     * between the TPI as of now and the targetTpi
     * @dev 18 decimal places, 0.20e18 == $0.20
     */
    function setMaxTreasuryPriceIndexDelta(uint96 maxDelta) external;

    /**
     * @notice Set the minimum time delta required for TPI to reach it's target value when 
     * `setTreasuryPriceIndexAt()` is called.
     * @dev In seconds.
     */
    function setMinTreasuryPriceIndexTargetTimeDelta(uint32 maxTargetTimeDelta) external;

    /**
     * @notice Set the maximum absolute rate of change of TPI allowed, when 
     * `setTreasuryPriceIndexAt()` is called.
     * @dev Units: [TPI / second]
     */
    function setMaxAbsTreasuryPriceIndexRateOfChange(uint96 tpiDelta, uint32 timeDelta) external;

    /**
     * @notice Set the target TPI which will incrementally increase from it's current value to `targetTpi`
     * between now and `targetTime`.
     * @dev targetTime is unixtime, targetTpi is 18 decimal places, 1.05e18 == $1.05
     */
    function setTreasuryPriceIndexAt(uint96 targetTpi, uint32 targetTime) external;

    /**
     * @notice The decimal precision of Temple Price Index (TPI)
     * @dev 18 decimals, so 1.02e18 == $1.02
     */
    // solhint-disable-next-line func-name-mixedcase
    function TPI_DECIMALS() external view returns (uint256);
}