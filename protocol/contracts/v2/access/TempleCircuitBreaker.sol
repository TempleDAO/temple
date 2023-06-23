pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later



import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";

import "forge-std/console.sol";

// @todo add interface and overrides

contract TempleCircuitBreaker is TempleElevatedAccess {
    uint256 public nBuckets;
    uint256 public duration;
    uint256 public secondsPerBucket;

    uint256 public currentBucket;
    uint256 public currentTime;

    uint256 public cap;

    uint256[65535] public buckets;

    event ConfigSet(uint256 duration, uint256 nBuckets, uint256 cap);
    error CapBreached(uint256 totalRequested, uint256 cap);

    constructor(
        address _initialRescuer,
        address _initialExecutor,
        uint256 _duration,
        uint256 _nBuckets,
        uint256 _cap
    ) TempleElevatedAccess(_initialRescuer, _initialExecutor) {
        _setConfig(_duration, _nBuckets, _cap);
    }

    function setConfig(uint256 _duration, uint256 _nBuckets, uint256 _cap) external onlyElevatedAccess {
        // @todo Probably need to clear the state so when config is updated we start fresh.
        // Still preferable to releasing a new CircuitBreaker and having to update in all contracts to use this.
        _setConfig(_duration, _nBuckets, _cap);
    }

    function _setConfig(uint256 _duration, uint256 _nBuckets, uint256 _cap) internal {
        if (_duration % _nBuckets != 0) revert CommonEventsAndErrors.InvalidParam();
        duration = _duration;
        nBuckets = _nBuckets;
        secondsPerBucket = duration / nBuckets;
        cap = _cap;
        emit ConfigSet(_duration, _nBuckets, _cap);
    }

    function bucketIndexFromTime(uint256 timestamp) public view returns (uint256) {
        // eg timestamp = 'now', duration = 48 hrs
        uint256 secsElapsed = timestamp % duration;

        // console.log("bucketIndexFromTime:", timestamp, duration, secsElapsed);
        // console.log("\t:", secondsPerBucket, secsElapsed / secondsPerBucket);

        // truncation is ok and expected
        return secsElapsed / secondsPerBucket;
    }

    function currentUtilisation() public view returns (uint256 amount) {
        return _currentUtilisation(nBuckets);
    }

    function _currentUtilisation(uint256 _nBuckets) internal view returns (uint256 amount) {
        // Unchecked is safe here because we know previous entries are under the cap.
        unchecked {
            for (uint256 i = 0; i < _nBuckets; ++i) {
                // console.log("\tbucket[%d] = %d", i, buckets[i]);
                amount += buckets[i];
            }
        }
    }

    // When doing for real, make the params encoded params so it's flexible for later
    // The identifier maps to a group of things, and also the type of check
    // Need to whitelist who can call this function
    function addTx(uint256 amount) external onlyElevatedAccess {
        uint256 _ts = block.timestamp;
        uint256 _bucketIndex = bucketIndexFromTime(_ts);

        uint256 _nBuckets = nBuckets;
        uint256 _currentBucket = currentBucket;
        // console.log("_currentBucket = %d, _bucketIndex = %d", _currentBucket, _bucketIndex);
        
        // If a full duration has passed since the last clearout
        // then clear all
        if (_ts >= currentTime + duration) {
            for (uint256 i; i < nBuckets; ++i) {
                buckets[i % _nBuckets] = 0;
            }
        } else if (_currentBucket != _bucketIndex) {
            uint256 i = (_currentBucket + 1) % _nBuckets;
            // console.log("test i:", (_currentBucket % _nBuckets) + 1);
            // console.log("\ti=%d", _currentBucket, i);
            for (; i < _bucketIndex; ++i) {
                // console.log("clearing:", i, _nBuckets, i % _nBuckets);
                buckets[i % _nBuckets] = 0;
            }
        }

        if (_bucketIndex != currentBucket) {
            currentBucket = _bucketIndex;
        }

        uint256 _newUtilisation = _currentUtilisation(_nBuckets) + amount;
        if (_newUtilisation > cap) revert CapBreached(_newUtilisation, cap);

        buckets[_bucketIndex % _nBuckets] += amount;
        currentTime = _ts;
        // console.log("NEXT _currentBucket = %d, _currentTime = %d", currentBucket, _ts);
    }
}

/**
const nBuckets = 24;   // ie 24 1 hour buckets
const bucket: number[] = new Array(nBuckets).fill(0);
const currentBucket = 0;

function addTx(tx, currentTime) {
    const bi = bucketIndexFromTime(nBuckets, currentTime);
    for(i = currentBucket to bi) {
        bucket[i % nBuckets] = 0;
    }
    currentBucket = bi;
    if sum(bucket[...]) + tx.amount > MAX_BORROW: {
        throw new BorrrowNotAllowed();
    }
    bucket[bi % nBuckets ] += tx.amount;
}
 */