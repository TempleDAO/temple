pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/governance/TempleGovernor.sol)


import {IGovernor, Governor} from "@openzeppelin/contracts/governance/Governor.sol";
import {GovernorCountingSimple} from "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import {GovernorVotes} from "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import {GovernorVotesQuorumFraction} from "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import {GovernorTimelockControl} from "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import {IERC165} from "@openzeppelin/contracts/interfaces/IERC165.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

/** 
 * @title Temple Governor
 * @notice Temple Governor
 */

 contract TempleGovernor is
    Governor,
    GovernorCountingSimple,
    GovernorVotes,
    GovernorVotesQuorumFraction,
    GovernorTimelockControl {
    
    /// @notice Delay before voting begins. Allows enough time to prepare. Eg. for stakers to unstake before voting
    uint256 public votingDelaySeconds; //= 86400; // 1 day
    /// @notice Period of voting
    uint256 public votingPeriodSeconds; // = 604800; // 1 week

    event VotingDelaySet(uint256 oldDelay, uint256 newDelay);
    event VotingPeriodSet(uint256 oldPeriod, uint256 newPeriod);

    constructor(
        IVotes _wTemple,
        TimelockController _timelock,
        uint48 _govVotesQuorumFraction,
        uint256 _votingDelaySeconds,
        uint256 _votingPeriodSeconds,
        string memory _name
    ) Governor(_name) GovernorVotes(_wTemple) GovernorVotesQuorumFraction(_govVotesQuorumFraction) GovernorTimelockControl(_timelock) {
        votingDelaySeconds = _votingDelaySeconds;
        votingPeriodSeconds = _votingPeriodSeconds;
    }

    function setVotingDelay(uint256 _delay) external onlyGovernance {
        uint256 oldDelay = votingDelay();
        votingDelaySeconds = _delay;
        emit VotingDelaySet(oldDelay, _delay);
    }

    function setVotingPeriod(uint256 _period) external {
        if (msg.sender != timelock()) { revert CommonEventsAndErrors.InvalidAccess(); }
        uint256 oldPeriod = votingPeriod();
        votingPeriodSeconds = _period;
        emit VotingPeriodSet(oldPeriod, _period);
    }

    function votingDelay() public view override returns (uint256) {
        return votingDelaySeconds; // 1 day. clock() uses seconds
    }

    function votingPeriod() public view override returns (uint256) {
        return votingPeriodSeconds; // 1 week. clock() uses seconds, block timestamp
    }

    function proposalThreshold() public pure override returns (uint256) {
        /// @notice  This restricts proposal creation to accounts who have enough voting power.
        return 0;
    }

    function state(uint256 proposalId) public view override(Governor, GovernorTimelockControl) returns (ProposalState) {
        return super.state(proposalId);
    }

    function proposalNeedsQueuing(
        uint256 proposalId
    ) public view virtual override(Governor, GovernorTimelockControl) returns (bool) {
        return super.proposalNeedsQueuing(proposalId);
    }

    function _queueOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint48) {
        return super._queueOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _executeOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) {
        super._executeOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint256) {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor() internal view override(Governor, GovernorTimelockControl) returns (address) {
        return super._executor();
    }
}