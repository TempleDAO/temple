pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { sd } from "@prb/math/src/SD59x18.sol";
import { mulDivSigned } from "@prb/math/src/Common.sol";

library CompoundedInterest {
    int256 public constant ONE_YEAR = 365 days;

    // @todo handle negative interest rates.

    /// @notice FV = P*e^(r*t)
    /// @param principal Initial principal amount, 1e18 precision
    /// @param elapsed Number of seconds elapsed
    /// @param interestRate The interest rate per annum, 1e18 precision. eg 5% = 0.05e18
    function continuouslyCompounded(
        uint256 principal, 
        uint256 elapsed, 
        int96 interestRate
    ) internal pure returns (uint256) {
        int256 exponent = int256(elapsed) * interestRate / ONE_YEAR;
        return uint256(
            sd(int256(principal)).mul(
                sd(exponent).exp()
            ).unwrap()
        );
    }
}