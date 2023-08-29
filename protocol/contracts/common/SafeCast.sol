pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (common/SafeCast.sol)

library SafeCast {
    error Overflow(uint256 amount);

    function encodeUInt32(uint256 amount) internal pure returns (uint32 downcasted) {
        downcasted = uint32(amount);
        if (downcasted != amount) revert Overflow(amount);
    }

    function encodeUInt64(uint256 amount) internal pure returns (uint64 downcasted) {
        downcasted = uint64(amount);
        if (downcasted != amount) revert Overflow(amount);
    }

    function encodeUInt80(uint256 amount) internal pure returns (uint80 downcasted) {
        downcasted = uint80(amount);
        if (downcasted != amount) revert Overflow(amount);
    }

    function encodeUInt96(uint256 amount) internal pure returns (uint96 downcasted) {
        downcasted = uint96(amount);
        if (downcasted != amount) revert Overflow(amount);
    }
    
    function encodeUInt128(uint256 amount) internal pure returns (uint128 downcasted) {
        downcasted = uint128(amount);
        if (downcasted != amount) revert Overflow(amount);
    }
}
