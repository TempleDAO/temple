pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * Contract where we track progress of a users openign ceremony quest
 */ 
 contract EchoingWhispers is AccessControl {
    bytes32 public constant CAN_CHANGE_STATE = keccak256("CAN_CHANGE_STATE");

    struct QuestData {
        bytes32 stepWhenLocked;
        bytes32 stepWhenUnlocked;
        uint256 lockedUntil;
        bytes32 enclave;
        bool completed;
    }

    // opening ceremony data from a templar
    mapping(address => QuestData) public dataOf;

    // keccak256 encoeded step where caller can set the enclave
    bytes32 public setEnclaveCondition;

    // keccak256 encoeded step where caller can mark the quest as complete
    bytes32 public setCompletedCondition;

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        grantRole(CAN_CHANGE_STATE, msg.sender);
    }

    function setConditions(bytes32 _setEnclaveCondition, bytes32 _setCompletedCondition) external onlyRole(DEFAULT_ADMIN_ROLE) {
        setEnclaveCondition = _setEnclaveCondition;
        setCompletedCondition = _setCompletedCondition;
    }

    function setCurrentStep(address templar, bytes32 step) external onlyRole(CAN_CHANGE_STATE) {
        QuestData storage questData = dataOf[templar];

        require(block.timestamp > questData.lockedUntil, "Locked on current step");
        dataOf[templar].stepWhenUnlocked = step;
    }

    function setCurrentStepWithLock(address templar, bytes32 step, uint256 lockDurationSeconds, bytes32 stepWhenUnlocked) external  onlyRole(CAN_CHANGE_STATE)  {
        QuestData storage questData = dataOf[templar];

        require(block.timestamp > questData.lockedUntil, "Locked on current step");

        dataOf[templar].stepWhenLocked = step;
        dataOf[templar].stepWhenUnlocked = stepWhenUnlocked;
        dataOf[templar].lockedUntil = block.timestamp + lockDurationSeconds;
    }

    function setEnclave(address templar, bytes32 enclave) external onlyRole(CAN_CHANGE_STATE) {
        require(
            keccak256(abi.encode(getCurrentStep(templar))) == setEnclaveCondition 
            && dataOf[templar].enclave == "", "Cannot set enclave at current quest step");
        dataOf[templar].enclave = enclave;
    }
        

    function setCompleted(address templar) external onlyRole(CAN_CHANGE_STATE) {
        require(keccak256(abi.encode(getCurrentStep(templar))) == setCompletedCondition, "Cannot set quest as completed at current step");
        dataOf[templar].completed = true;
    }

    /** Owner only method to udpate any/all user quest data if required by enclave of order to support questers */
    function overrideUserData(address templar, bytes32 stepWhenLocked, bytes32 stepWhenUnlocked, uint256 lockedUntil, bytes32 enclave, bool completed) external onlyRole(DEFAULT_ADMIN_ROLE) {
        dataOf[templar].stepWhenLocked = stepWhenLocked;
        dataOf[templar].stepWhenUnlocked = stepWhenUnlocked;
        dataOf[templar].lockedUntil = lockedUntil;
        dataOf[templar].enclave = enclave;
        dataOf[templar].completed = completed;
    }

    function getCurrentStep(address templar) public view returns(bytes32) {
        QuestData storage questData = dataOf[templar];

        if (block.timestamp < questData.lockedUntil) {
            return questData.stepWhenLocked;
        } else {
            return questData.stepWhenUnlocked;
        }
    }
}
