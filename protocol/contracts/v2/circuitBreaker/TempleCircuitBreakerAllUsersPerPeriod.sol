pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/circuitBreaker/TempleCircuitBreakerAllUsersPerPeriod.sol)

import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { SafeCast } from "contracts/common/SafeCast.sol";
import { ITempleCircuitBreaker } from "contracts/interfaces/v2/circuitBreaker/ITempleCircuitBreaker.sol";

/**
 * @title Temple Circuit Breaker -- total volumes (across all users) in a rolling period window
 * 
 * @notice No more than the cap can be borrowed within a `periodDuration` window. 
 * A slight nuance is that it will be slightly less than `periodDuration`, it also takes into account
 * how many internal buckets are used - this is a tradeoff for gas efficiency.
 * 
 * -- The tracking is split up into hourly buckets, so for a 24 hour window, we define 24 hourly buckets.
 * -- When a new transaction is checked, it will roll forward by the required buckets (when it gets to 23 it will circle back from 0), cleaning up the buckets which are now > 24hrs in the past.
        If it's in the same hr as last time, then nothing to clean up
 * -- Then adds the new volume into the bucket
 * -- Then sums the buckets up and checks vs the cap, reverting if over.

 * This means that we only have to sum up 24 items.

 * The compromise is that the window we check for is going to be somewhere between 23hrs and 24hrs.
 */
contract TempleCircuitBreakerAllUsersPerPeriod is ITempleCircuitBreaker, TempleElevatedAccess {
    using SafeCast for uint256;

    /**
     * @notice The duration of the rolling period window
     */
    uint32 public periodDuration;

    /**
     * @notice The maximum allowed amount to be transacted within each period
     */
    uint128 public cap;

    /**
     * @notice How many buckets to split the periodDuration into. 
     * @dev A lower number of buckets means less gas will be used, however the rolling
     * window will change at the *start* of the bucket time.
     *   eg for a 24 hour `periodDuration`, with 24 (hourly) buckets, there could be a transaction
     *   for the cap at the 13:45:00, and again the next day 24 hours later at 13:05:00
     *   and this would be allowed.
     * A higher number of buckets means this wait time is less, however this will use more gas.
     * `nBuckets` must not be greater than 65535, and must be a divisor of `periodDuration`
     */
    uint32 public nBuckets;

    /**
     * @notice The derived length of time in each bucket
     */
    uint32 public secondsPerBucket;

    /**
     * @notice The current bucket index.
     * @dev The first bucket starts at 1-1-1970
     */
    uint32 public bucketIndex;

    /**
     * @notice The total amount of volume tracked within each bucket
     */
    uint256[65535] public buckets;

    event ConfigSet(uint256 periodDuration, uint256 nBuckets, uint256 cap);
    event CapSet(uint256 cap);
    error CapBreached(uint256 totalRequested, uint256 cap);

    constructor(
        address _initialRescuer,
        address _initialExecutor,
        uint256 _periodDuration,
        uint256 _nBuckets,
        uint256 _cap
    ) TempleElevatedAccess(_initialRescuer, _initialExecutor) {
        _setConfig(_periodDuration, _nBuckets, _cap);
    }

    /**
     * @notice Verify the new amount requested does not breach the cap in this rolling period.
     */
    function preCheck(address /*onBehalfOf*/, uint256 amount) external override onlyElevatedAccess {
        uint32 _nextBucketIndex = uint32(block.timestamp / secondsPerBucket);
        uint32 _bucketIndex = bucketIndex;
        uint32 _nBuckets = nBuckets;
        
        // If this time bucket is different to the last one
        // then delete any buckets in between first - that is old data
        if (_nextBucketIndex != _bucketIndex) {
            unchecked {
                // If it was more than a full periodDuration ago, then all buckets are deleted.
                uint32 _oneperiodDurationAgoIndex = _nextBucketIndex - _nBuckets;
                uint32 i = _bucketIndex < _oneperiodDurationAgoIndex ? _oneperiodDurationAgoIndex : _bucketIndex;
                for (; i < _nextBucketIndex; ++i) {
                    // Set to dust
                    buckets[(i+1) % _nBuckets] = 1;
                }
            }

            bucketIndex = _nextBucketIndex;
        }

        unchecked {
            buckets[_nextBucketIndex % _nBuckets] += amount;
        }
        
        uint256 _newUtilisation = _currentUtilisation(_nBuckets);
        if (_newUtilisation > cap) revert CapBreached(_newUtilisation, cap);
    }

    /**
     * @notice Set the duration, buckets and cap. This will reset the clock for any totals
     * added since in the new periodDuration.
     */
    function setConfig(uint256 _periodDuration, uint256 _nBuckets, uint256 _cap) external onlyElevatedAccess {
        _setConfig(_periodDuration, _nBuckets, _cap);
    }

    /**
     * @notice Update the cap for this circuit breaker
     */
    function updateCap(uint256 newCap) external onlyElevatedAccess {
        cap = newCap.encodeUInt128();
        emit CapSet(newCap);
    }
    
    /**
     * @notice What is the total utilisation so far in this `periodDuration`
     */
    function currentUtilisation() external view returns (uint256 amount) {
        return _currentUtilisation(nBuckets);
    }

    function _currentUtilisation(uint256 _nBuckets) internal view returns (uint256 amount) {
        // Unchecked is safe here because we know previous entries are under the cap.
        unchecked {
            for (uint256 i = 0; i < _nBuckets; ++i) {
                amount += buckets[i];
            }

            // Remove the dust
            amount -= _nBuckets;
        }
    }

    function _setConfig(uint256 _periodDuration, uint256 _nBuckets, uint256 _cap) internal {
        if (_periodDuration == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        if (_periodDuration % _nBuckets != 0) revert CommonEventsAndErrors.InvalidParam();
        if (_nBuckets > 65535) revert CommonEventsAndErrors.InvalidParam();

        nBuckets = _nBuckets.encodeUInt32();
        periodDuration = _periodDuration.encodeUInt32();
        secondsPerBucket = (_periodDuration / _nBuckets).encodeUInt32();
        cap = _cap.encodeUInt128();
        bucketIndex = 0;

        // No need to clear all 65k elements - they won't be used until they're required
        // at which point they'll too be cleared.
        unchecked {
            for (uint256 i = 0; i < _nBuckets; ++i) {
                // Set to a non-zero dust amount
                buckets[i] = 1;
            }
        }

        emit ConfigSet(_periodDuration, _nBuckets, _cap);
    }
}
