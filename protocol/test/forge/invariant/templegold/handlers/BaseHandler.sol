pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// (tests/forge/templegold/invariant/BaseHandler.sol)

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { TimestampStore } from "test/forge/invariant/templegold/stores/TimestampStore.sol";
import { StateStore } from "test/forge/invariant/templegold/stores/StateStore.sol";

abstract contract BaseHandler is Test {
    address[] public actors;
    address internal currentActor;

    /// @dev Reference to the timestamp store, which is needed for simulating the passage of time.
    TimestampStore public timestampStore;

    /// @dev Reference which action has just run.
    StateStore public stateStore;

    /// @dev Maps function names to the number of times they have been called.
    mapping(bytes4 func => uint256 calls) public calls;

    /// @dev The total number of calls made to this contract.
    uint256 public totalCalls;

    constructor(TimestampStore timestampStore_, StateStore stateStore_) {
        timestampStore = timestampStore_;
        stateStore = stateStore_;
    }

    modifier useActor(uint256 actorIndexSeed) {
        currentActor = actors[bound(actorIndexSeed, 0, actors.length - 1)];
        vm.startPrank(currentActor);
        _;
        vm.stopPrank();
    }

    modifier useSender() {
        vm.startPrank(msg.sender);
        _;
        vm.stopPrank();
    }

    /// @dev Simulates the passage of time. The time jump is upper bounded by time around rewards ending
    /// See https://github.com/foundry-rs/foundry/issues/4994.
    /// @param timeJumpSeed A fuzzed value needed for generating random time warps.
    modifier adjustTimestamp(uint256 timeJumpSeed) {
        uint256 timeJump = _bound(timeJumpSeed, 0, 7 days);
        timestampStore.increaseCurrentTimestamp(timeJump);
        vm.warp(timestampStore.currentTimestamp());
        _;
    }

    /// @dev Records a function call for instrumentation purposes, and also
    /// sets the state of the function which is running now
    modifier instrument() {
        calls[msg.sig]++;
        totalCalls++;
        stateStore.set(address(this), msg.sig);
        _;
    }

    function doMint(address token, address account, uint256 amount) internal {
        deal(token, account, IERC20(token).balanceOf(account) + amount, true);
    }

    function approve(address _token, address _spender, uint256 _amount) internal {
        IERC20(_token).approve(_spender, _amount);
    }
}