pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (common/TempleMath.sol)

import { mulDiv } from "@prb/math/src/Common.sol";

library TempleMath {
    /// @notice mulDiv with an option to round the result up or down to the nearest wei
    function mulDivRound(uint256 x, uint256 y, uint256 denominator, bool roundUp) internal pure returns (uint256 result) {
        result = mulDiv(x, y, denominator);
        // See OZ Math.sol for the equivalent mulDiv() with rounding.
        if (roundUp && mulmod(x, y, denominator) > 0) {
            result += 1;
        }
    }
}