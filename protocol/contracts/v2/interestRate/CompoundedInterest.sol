pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/interestRate/CompoundedInterest.sol)

import { ud } from "@prb/math/src/UD60x18.sol";

/**
 * @notice A maths library to calculate compounded interest
 */
library CompoundedInterest {
    uint256 public constant ONE_YEAR = 365 days;

    /// @notice FV = P*e^(r*t)
    /// @param principal Initial principal amount, 1e18 precision
    /// @param elapsed Number of seconds elapsed
    /// @param interestRate The interest rate per annum, 1e18 precision. eg 5% = 0.05e18
    function continuouslyCompounded(
        uint256 principal, 
        uint256 elapsed, 
        uint96 interestRate
    ) internal pure returns (uint256) {
        uint256 exponent = elapsed * interestRate / ONE_YEAR;
        return ud(principal).mul(
            ud(exponent).exp()
        ).unwrap();
    }
}
