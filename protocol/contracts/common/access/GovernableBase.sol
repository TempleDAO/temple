pragma solidity 0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Origami (common/access/GovernableBase.sol)

import {CommonEventsAndErrors} from "contracts/common/CommonEventsAndErrors.sol";

/// @notice Base contract to enable a contract to be governable (eg by a Timelock contract)
/// @dev Either implement a constructor or initializer (upgradable proxy) to set the 
abstract contract GovernableBase {
    address internal _gov;
    address internal _proposedNewGov;

    event NewGovernorProposed(address indexed previousGov, address indexed previousProposedGov, address indexed newProposedGov);
    event NewGovernorAccepted(address indexed previousGov, address indexed newGov);

    error NotGovernor();

    function _init(address initialGovernor) internal {
        if (_gov != address(0)) revert NotGovernor();
        if (initialGovernor == address(0)) revert CommonEventsAndErrors.InvalidAddress(address(0));
        _gov = initialGovernor;
    }

    /**
     * @dev Returns the address of the current governor.
     */
    function gov() external view returns (address) {
        return _gov;
    }

    /**
     * @dev Proposes a new Governor.
     * Can only be called by the current governor.
     */
    function proposeNewGov(address newProposedGov) external onlyGov {
        if (newProposedGov == address(0)) revert CommonEventsAndErrors.InvalidAddress(newProposedGov);
        emit NewGovernorProposed(_gov, _proposedNewGov, newProposedGov);
        _proposedNewGov = newProposedGov;
    }

    /**
     * @dev Caller accepts the role as new Governor.
     * Can only be called by the proposed governor
     */
    function acceptGov() external {
        if (msg.sender != _proposedNewGov) revert CommonEventsAndErrors.InvalidAddress(msg.sender);
        emit NewGovernorAccepted(_gov, msg.sender);
        _gov = msg.sender;
        delete _proposedNewGov;
    }

    /**
     * @dev Throws if called by any account other than the governor.
     */
    modifier onlyGov() {
        if (msg.sender != _gov) revert NotGovernor();
        _;
    }

}