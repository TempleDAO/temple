pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (nexus/ExperiencePointsProxy.sol)


import { TempleElevatedAccess } from "../v2/access/TempleElevatedAccess.sol";

interface IRelic {
    function setRelicXP(uint256 relicId, uint256 xp) external;
}

contract ExperiencePointsProxy is TempleElevatedAccess {

    IRelic public immutable relic;
    mapping(address => bool) public controllers;

    event ControllerSet(address indexed controller, bool allowed);

    error InvalidAccess(address caller);
    error InvalidAddress();

    constructor(IRelic _relic) TempleElevatedAccess(msg.sender, msg.sender) {
        relic = _relic;
    }

    function setController(address controller, bool allowed) external onlyElevatedAccess {
        if (controller == address(0)) { revert InvalidAddress(); }
        controllers[controller] = allowed;
        emit ControllerSet(controller, allowed);
    }

    function setRelicXP(uint256 relicId, uint256 xp) external onlyController {
        // todo logic 
        relic.setRelicXP(relicId, xp);
    }

    modifier onlyController() {
        if(!controllers[msg.sender]) { revert InvalidAccess(msg.sender); }
        _;
    }
}