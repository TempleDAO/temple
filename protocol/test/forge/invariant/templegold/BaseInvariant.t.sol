pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// (tests/forge/templegold/invariant/BaseInvariant.t.sol)

import { StdInvariant } from "forge-std/StdInvariant.sol";
import { TempleGoldCommon } from "../../unit/templegold/TempleGoldCommon.t.sol";
import { TimestampStore } from "test/forge/invariant/templegold/stores/TimestampStore.sol";
import { StateStore } from "test/forge/invariant/templegold/stores/StateStore.sol";

abstract contract BaseInvariantTest is StdInvariant, TempleGoldCommon {

    TimestampStore internal timestampStore;
    StateStore internal stateStore;

    // function setUp() public virtual {
    //     vm.label({ account: address(this), newLabel: "ThisTestContract" });
    //     excludeSender(address(this));
        
    // }

    function setUp() public virtual {
        timestampStore = new TimestampStore();
        vm.label({ account: address(timestampStore), newLabel: "TimestampStore" });
        excludeSender(address(timestampStore));
        
        stateStore = new StateStore();
        vm.label({ account: address(stateStore), newLabel: "StateStore" });
        excludeSender(address(stateStore));
    }

    function targetSelectors(address addr, bytes4[] memory fnSelectors) internal {
        targetContract(addr);
        targetSelector(
            StdInvariant.FuzzSelector({
                addr: addr, 
                selectors: fnSelectors
            })
        );
    }

    function doMint(
        address _token,
        address _recipient,
        uint256 _amount
    ) internal {
        deal(_token, _recipient, _amount);
    }

    function mkArray(
        bytes4 i1,
        bytes4 i2,
        bytes4 i3,
        bytes4 i4
    ) internal pure returns (bytes4[] memory arr) {
        arr = new bytes4[](4);
        (arr[0], arr[1], arr[2], arr[3]) = (i1, i2, i3, i4);
    }
}