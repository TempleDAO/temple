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
    event TreasuryPriceIndexSetAt(uint96 oldTpi, uint96 newTpiTarget, uint256 targetDate);
    event MaxTreasuryPriceIndexDeltaSet(uint256 maxDelta);
    event MinTreasuryPriceIndexTargetDateDeltaSet(uint32 maxTargetDateDelta);

    error BreachedMaxTpiDelta(uint96 oldTpi, uint96 newTpi, uint256 maxDelta);
    error BreachedMinDateDelta(uint32 targetDate, uint32 currentDate, uint32 maxTargetDateDelta);

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
    function minTreasuryPriceIndexTargetDateDelta() external view returns (uint32);

    /**
     * @notice The current TPI state data
     */
    function tpiData() external view returns (
        uint96 currentTpi,
        uint96 targetTpi,
        uint32 lastUpdatedAt,
        uint32 targetDate,
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
    function setMinTreasuryPriceIndexTargetDateDelta(uint32 maxTargetDateDelta) external;

    /**
     * @notice Set the target TPI which will incrementally increase from it's current value to `targetTpi`
     * between now and `targetDate`.
     * @dev targetDate is unixtime, targetTpi is 18 decimal places, 1.05e18 == $1.05
     */
    function setTreasuryPriceIndexAt(uint96 targetTpi, uint32 targetDate) external;

    /**
     * @notice The decimal precision of Temple Price Index (TPI)
     * @dev 18 decimals, so 1.02e18 == $1.02
     */
    // solhint-disable-next-line func-name-mixedcase
    function TPI_DECIMALS() external view returns (uint256);
}