pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/templeLineOfCredit/TlcLiquidationModule.sol)

import { ITlcEventsAndErrors } from "contracts/interfaces/v2/templeLineOfCredit/ITlcEventsAndErrors.sol";

interface ITlcLiquidationModule is ITlcEventsAndErrors { 
    function checkLiquidity(
        address account, 
        bool includePendingRequests
    ) external view;
}
