pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (tests/forge/nexus/NexusCommon.t.sol)

import { NexusTestBase } from "./Nexus.t.sol";
import { NexusCommon } from "../../../contracts/nexus/NexusCommon.sol";
import { CommonEventsAndErrors } from "../../../contracts/common/CommonEventsAndErrors.sol";
import { Relic } from "../../../contracts/nexus/Relic.sol";
import { Shard } from "../../../contracts/nexus/Shard.sol";

contract NexusCommonTestBase is NexusTestBase {
    NexusCommon public nexusCommon;
    Relic public relic;
    Shard public shard;

    event ShardEnclaveSet(uint256 enclaveId, uint256 indexed shardId);
    event EnclaveNameSet(uint256 id, string name);
    event ShardSet(address indexed shard);


    function setUp() public {
        nexusCommon = new NexusCommon(executor);
        relic = new Relic(NAME, SYMBOL, address(nexusCommon), executor);
        shard = new Shard(address(relic), address(nexusCommon), executor, "http://example.com");

        {
            vm.startPrank(executor);
            address[] memory minters = new address[](2);
            minters[0] = executor;
            minters[1] = operator;
            shard.setNewMinterShards(minters);
            nexusCommon.setEnclaveName(1, MYSTERY);
            nexusCommon.setShard(address(shard));
            vm.stopPrank();
        }
    }

    function _setEnclaveNames() internal {
        nexusCommon.setEnclaveName(1, MYSTERY);
        nexusCommon.setEnclaveName(2, CHAOS);
        nexusCommon.setEnclaveName(3, ORDER);
    }
}

contract NexusCommonAccessTest is NexusCommonTestBase {

    function test_initialization() public {
        assertEq(address(nexusCommon.shard()), address(shard));
        assertEq(nexusCommon.executor(), executor);
    }

    function test_setEnclaveNameAccessFail(address caller) public {
        vm.assume(caller != executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        nexusCommon.setEnclaveName(1, LOGIC);
    }

    function test_setShardEnclaveAccessFail(address caller) public {
        vm.assume(caller != executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        nexusCommon.setShardEnclave(1, 1);
    }

    function test_setShardFail(address caller) public {
        vm.assume(caller != executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        nexusCommon.setShard(address(shard));
    }

    function test_setEnclaveNameAccessFail() public {
        vm.startPrank(executor);
        nexusCommon.setEnclaveName(1, LOGIC);
    }

    function test_setShardEnclaveAccessSuccess() public {
        vm.startPrank(executor);
        nexusCommon.setShardEnclave(1, 1);
    }

    function test_setShardSuccess() public {
        vm.startPrank(executor);
        nexusCommon.setShard(address(shard));
    }
}

contract NexusCommonTest is NexusCommonTestBase {

    function test_setShard() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        nexusCommon.setShard(address(0));

        vm.expectEmit(address(nexusCommon));
        emit ShardSet(address(shard));
        nexusCommon.setShard(address(shard));
        assertEq(address(nexusCommon.shard()), address(shard));
    }

    function test_setEnclaveName() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        nexusCommon.setEnclaveName(0, MYSTERY);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        nexusCommon.setEnclaveName(1, string(bytes("")));

        vm.expectEmit(address(nexusCommon));
        emit EnclaveNameSet(1, MYSTERY);
        nexusCommon.setEnclaveName(1, MYSTERY);

        assertEq(nexusCommon.enclaveNames(1), MYSTERY);

        vm.expectEmit();
        emit EnclaveNameSet(2, CHAOS);
        nexusCommon.setEnclaveName(2, CHAOS);
        vm.expectEmit();
        emit EnclaveNameSet(3, ORDER);
        nexusCommon.setEnclaveName(3, ORDER);

        assertEq(nexusCommon.enclaveNames(2), CHAOS);
        assertEq(nexusCommon.enclaveNames(3), ORDER);

        // update enclave name
        vm.expectEmit(address(nexusCommon));
        emit EnclaveNameSet(2, STRUCTURE);
        nexusCommon.setEnclaveName(2, STRUCTURE);
        assertEq(nexusCommon.enclaveNames(2), STRUCTURE);
    }

    function test_setShardEnclave() public {
        vm.startPrank(executor);
        _setEnclaveNames();

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        nexusCommon.setShardEnclave(0, 0);
        // test invalid enclaveId
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        nexusCommon.setShardEnclave(10, 0);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        nexusCommon.setShardEnclave(1, 3);

        uint256[] memory enclaveOneShardsBefore = nexusCommon.getEnclaveShards(1);

        vm.expectEmit(address(nexusCommon));
        emit ShardEnclaveSet(1, 2);
        nexusCommon.setShardEnclave(1, 2);

        uint256[] memory enclaveOneShards = nexusCommon.getEnclaveShards(1);
        assertEq(enclaveOneShards.length, enclaveOneShardsBefore.length + 1);
        assertEq(enclaveOneShards[0], 2);
        
        vm.expectEmit(address(nexusCommon));
        emit ShardEnclaveSet(1, 1);
        nexusCommon.setShardEnclave(1, 1);

        enclaveOneShards = nexusCommon.getEnclaveShards(1);
        assertEq(enclaveOneShards.length, 2);
        assertEq(enclaveOneShards[1], 1);
        assertEq(nexusCommon.shardToEnclave(1), 1);
        assertEq(nexusCommon.shardToEnclave(2), 1);

        // add Shard Id 1 to another enclave and check
        uint256[] memory enclaveTwoShards = nexusCommon.getEnclaveShards(2);
        nexusCommon.setShardEnclave(2, 1);
        enclaveOneShards = nexusCommon.getEnclaveShards(1);
        enclaveTwoShards = nexusCommon.getEnclaveShards(2);
        assertEq(enclaveOneShards.length, 1);
        assertEq(enclaveTwoShards.length, 1);
        assertEq(nexusCommon.shardToEnclave(1), 2);
    }

    function test_getAllEnclaveIds() public {
        vm.startPrank(executor);
        _setEnclaveNames();
        uint256[] memory enclaveIds = nexusCommon.getAllEnclaveIds();
        assertEq(enclaveIds.length, 3);
        assertEq(enclaveIds[0], 1);
        assertEq(enclaveIds[1], 2);
        assertEq(enclaveIds[2], 3);
    }

    function test_isValidEnclaveId() public {
        assertEq(nexusCommon.isValidEnclaveId(2), false);
        assertEq(nexusCommon.isValidEnclaveId(3), false);
        vm.startPrank(executor);
        _setEnclaveNames();
        assertEq(nexusCommon.isValidEnclaveId(2), true);
        assertEq(nexusCommon.isValidEnclaveId(3), true);
    }
}