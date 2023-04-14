pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Origami (common/access/GovernableUpgradeable.sol)

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {GovernableBase} from "contracts/common/access/GovernableBase.sol";

/// @notice Enable a contract to be governable (eg by a Timelock contract) -- for upgradeable proxies
abstract contract GovernableUpgradeable is GovernableBase, Initializable {

    function __Governable_init(address initialGovernor) internal onlyInitializing {
        __Governable_init_unchained(initialGovernor);
    }

    function __Governable_init_unchained(address initialGovernor) internal onlyInitializing {
        _init(initialGovernor);
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[49] private __gap;
}