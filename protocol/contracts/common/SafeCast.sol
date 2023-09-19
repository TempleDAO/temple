pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (common/SafeCast.sol)

library SafeCast {
    error Overflow(uint256 amount);

    function encodeUInt128(uint256 amount) internal pure returns (uint128) {
        if (amount > type(uint128).max) {
            revert Overflow(amount);
        }
        return uint128(amount);
    }
}
