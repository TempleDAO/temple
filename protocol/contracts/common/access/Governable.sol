pragma solidity 0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Origami (common/access/Governable.sol)

import {GovernableBase} from "contracts/common/access/GovernableBase.sol";

/// @notice Enable a contract to be governable (eg by a Timelock contract)
abstract contract Governable is GovernableBase {
    
    constructor(address initialGovernor) {
        _init(initialGovernor);
    }

}