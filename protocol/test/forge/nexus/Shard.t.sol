pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (tests/forge/nexus/Shard.t.sol)


import { NexusTestBase } from "./Nexus.t.sol";
import { Relic } from "../../../contracts/nexus/Relic.sol";
import { Shard } from "../../../contracts/nexus/Shard.sol";
import { IShard } from "../../../contracts/interfaces/nexus/IShard.sol";
import { NexusCommon } from "../../../contracts/nexus/NexusCommon.sol";
import { CommonEventsAndErrors } from "../../../contracts/common/CommonEventsAndErrors.sol";


contract ShardTestBase is NexusTestBase {
    Relic public relic;
    Shard public shard;
    NexusCommon public nexusCommon;

    enum Rarity {
        Common,
        Uncommon,
        Rare,
        Epic,
        Legendary,
        InvalidRarity
    }

    struct Recipe {
        uint256[] inputShardIds;
        uint256[] inputShardAmounts;
        uint256[] outputShardIds;
        uint256[] outputShardAmounts;
    }

    event Transmuted(address indexed caller, uint256 recipeId);
    event ShardMinted();
    event ShardUriSet(uint256 indexed shardId, string uri);
    event RecipeSet(uint256 recipeId, Shard.Recipe recipe);
    event RecipeDeleted(uint256 recipeId);
    event PartnerAllowedShardIdSet(address partner, uint256 shardId, bool allow);
    event TransferSingle(address operator, address from, address to, uint256 id, uint256 value);
    event ShardEnclaveSet(uint256 enclaveId, uint256 shardId);
    event RegularShardIdSet(uint256 shardId, bool allow);
    event MinterAllowedShardIdSet(address indexed minter, uint256 indexed shardId, bool allow);
    event MinterAllowedShardCapSet(address indexed minter, uint256 indexed shardId, uint256 cap);
    event ShardIdSet(uint256 shardId, bool allow);
    event NexusCommonSet(address nexusCommon);
    
    function setUp() public {
        nexusCommon = new NexusCommon(executor);
        relic = new Relic(NAME, SYMBOL, address(nexusCommon), executor);
        shard = new Shard(address(relic), address(nexusCommon), executor, "http://example.com");

        vm.startPrank(executor);
        {
            nexusCommon.setEnclaveName(MYSTERY_ID, MYSTERY);
            nexusCommon.setEnclaveName(CHAOS_ID, CHAOS);
            nexusCommon.setEnclaveName(LOGIC_ID, LOGIC);
            nexusCommon.setEnclaveName(STRUCTURE_ID, STRUCTURE);
            nexusCommon.setEnclaveName(ORDER_ID, ORDER);
        }
        // relic setup
        {
            _enableAllEnclavesForMinter(relic, operator);
            relic.setShard(address(shard));
            vm.startPrank(operator);
            relic.mintRelic(bob, LOGIC_ID);
            relic.mintRelic(bob, MYSTERY_ID);
        }
        // shard setup
        {
            vm.startPrank(executor);
            address[] memory minters = new address[](4);
            minters[0] = minters[1] = minters[2] = minters[3] = operator;
            shard.setNewMinterShards(minters);
            uint256[] memory shardIds = new uint256[](1);
            bool[] memory allow = new bool[](1);
            shardIds[0] = SHARD_1_ID;
            allow[0] = true;
            shard.setMinterAllowedShardIds(bob, shardIds, allow);
            shard.setShardUri(SHARD_1_ID, SHARD_1_URI);
            shard.setShardUri(SHARD_2_ID, SHARD_2_URI);
            shard.setShardUri(SHARD_3_ID, SHARD_3_URI);
            shard.setShardUri(SHARD_4_ID, SHARD_4_URI);

            vm.startPrank(operator);
            shardIds = new uint256[](2);
            uint256[] memory amounts = new uint256[](2);
            shardIds[0] = SHARD_1_ID;
            shardIds[1] = SHARD_2_ID;
            amounts[0] = 5;
            amounts[1] = 10;
            shard.mintBatch(bob, shardIds, amounts);
        }
        vm.stopPrank();
    }

    function _setRecipe1() internal {
        Shard.Recipe memory recipe = _getRecipe1();
        vm.startPrank(executor);
        shard.addRecipe(recipe);
    }

    function _getRecipe1() internal pure returns (Shard.Recipe memory recipe) {
        uint256[] memory inputShardIds = new uint256[](2);
        inputShardIds[0] = SHARD_1_ID;
        inputShardIds[1] = SHARD_2_ID;
        uint256[] memory inputShardAmounts = new uint256[](2);
        inputShardAmounts[0] = 2;
        inputShardAmounts[1] = 1;
        uint256[] memory outputShardIds = new uint256[](1);
        outputShardIds[0] = SHARD_3_ID;
        uint256[] memory outputShardAmounts = new uint256[](1);
        outputShardAmounts[0] = 1;

        recipe.inputShardIds = inputShardIds;
        recipe.inputShardAmounts = inputShardAmounts;
        recipe.outputShardIds =  outputShardIds;
        recipe.outputShardAmounts = outputShardAmounts;
    }

    function _getInvalidRecipe() internal pure returns (Shard.Recipe memory recipe) {
        uint256[] memory inputShardIds = new uint256[](1);
        recipe.inputShardIds = inputShardIds;
    }

    function _unsetMinterShards(address minter) internal {
        uint256[] memory shardIds = new uint256[](4);
        bool[] memory allow = new bool[](4);
        allow[0] = allow[1] = allow[2] = allow[3] = false;
        shardIds[0] = SHARD_1_ID;
        shardIds[1] = SHARD_2_ID;
        shardIds[2] = SHARD_2_ID;
        shardIds[3] = SHARD_3_ID;
        shard.setMinterAllowedShardIds(minter, shardIds, allow);
    }
}

contract ShardTestView is ShardTestBase {
    function test_initialization() public {
        assertEq(address(shard.relic()), address(relic));
        assertEq(shard.executor(), executor);
        assertEq(shard.uri(SHARD_1_ID), SHARD_1_URI);
        assertEq(shard.uri(SHARD_2_ID), SHARD_2_URI);
        assertEq(shard.uri(SHARD_3_ID), SHARD_3_URI);
        assertEq(shard.uri(SHARD_4_ID), SHARD_4_URI);
        assertEq(shard.nextTokenId(), 5);
        assertEq(shard.nextRecipeId(), 1);
    }

    function test_nextTokenId() public {
        uint256 currentId = shard.nextTokenId() - 1;
        vm.startPrank(executor);
        address[] memory minters = new address[](1);
        minters[0] = alice;
        shard.setNewMinterShards(minters);
        assertEq(shard.nextTokenId(), currentId + 2);
        shard.setNewMinterShards(minters);
        assertEq(shard.nextTokenId(), currentId + 3);
    }

    function test_getMinterAllowedShardIds() public {
        vm.startPrank(executor);
        _unsetMinterShards(bob);
        uint256[] memory shards = shard.getMinterAllowedShardIds(bob);
        assertEq(shards.length, 0);

        uint256[] memory shardIds = new uint256[](1);
        bool[] memory allow = new bool[](1);
        allow[0] = true;
        shardIds[0] = SHARD_1_ID;
        shard.setMinterAllowedShardIds(bob, shardIds, allow);
        shards = shard.getMinterAllowedShardIds(bob);
        assertEq(shards.length, 1);
        assertEq(shards[0], SHARD_1_ID);
        shardIds = new uint256[](1);
        shardIds[0] = SHARD_3_ID;
        shard.setMinterAllowedShardIds(bob, shardIds, allow);
        shards = shard.getMinterAllowedShardIds(bob);
        assertEq(shards.length, 2);
        // no remove operation yet on UintSet, so safe index access
        assertEq(shards[0], SHARD_1_ID);
        assertEq(shards[1], SHARD_3_ID);
    }

    function test_getMintInfo() public {
        vm.startPrank(executor);
        uint256[] memory shards = new uint256[](2);
        bool[] memory allow = new bool[](2);
        shards[0] = SHARD_4_ID;
        shards[1] = SHARD_2_ID;
        allow[0] = allow[1] = true;
        shard.setMinterAllowedShardIds(alice, shards, allow);
        vm.startPrank(alice);
        Shard.MintInfo[] memory mintInfo = shard.getMintInfo(alice);
    
        assertEq(mintInfo.length, 2);
        uint256 shard1BalanceBefore = mintInfo[0].balance;
        uint256 shard1CapBefore = mintInfo[0].cap;
        uint256 shard2BalanceBefore = mintInfo[1].balance;
        uint256 shard2CapBefore = mintInfo[1].cap;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 5;
        amounts[1] = 10;
        shard.mintBatch(bob, shards, amounts);

        mintInfo = shard.getMintInfo(alice);
        assertEq(mintInfo.length, 2);
        assertEq(mintInfo[0].balance, shard1BalanceBefore+5);
        assertEq(mintInfo[1].balance, shard2BalanceBefore+10);
        assertEq(mintInfo[0].cap, shard1CapBefore);
        assertEq(mintInfo[1].cap, shard2CapBefore);
    
        vm.startPrank(executor);
        uint256[] memory caps = new uint256[](2);
        caps[0] = 1_000;
        caps[1] = 10_000;
        shard.setAllowedShardCaps(alice, shards, caps);
        vm.startPrank(alice);
        shard.mintBatch(bob, shards, amounts);
        mintInfo = shard.getMintInfo(alice);
        assertEq(mintInfo[0].balance, shard1BalanceBefore+10);
        assertEq(mintInfo[1].balance, shard2BalanceBefore+20);
        assertEq(mintInfo[0].cap, 1_000);
        assertEq(mintInfo[1].cap, 10_000);
    }

    function test_getRecipeInfo() public {
        _setRecipe1();
        Shard.Recipe memory info = shard.getRecipeInfo(1);
        assertEq(info.inputShardAmounts[0], 2);
        assertEq(info.inputShardAmounts[1], 1);
        assertEq(info.inputShardIds[0], SHARD_1_ID);
        assertEq(info.inputShardIds[1], SHARD_2_ID);
        assertEq(info.outputShardAmounts[0], 1);
        assertEq(info.outputShardIds[0], SHARD_3_ID);
    }

    function test_isShardId() public {
        vm.startPrank(executor);
        address[] memory minters = new address[](1);
        minters[0] = operator;
        uint256[] memory shards = shard.setNewMinterShards(minters);
        assertEq(shard.isShardId(shards[0]), true);
        assertEq(shard.isShardId(shards[0]+1), false);

        minters = new address[](2);
        minters[0] = minters[1] = operator;
        shards = shard.setNewMinterShards(minters);
        assertEq(shard.isShardId(shards[0]), true);
        assertEq(shard.isShardId(shards[1]), true);
        assertEq(shard.isShardId(shards[1]+1), false);
        assertEq(shard.nextTokenId(), shards[1] + 1);
    }
}


contract ShardTestAccess is ShardTestBase {

     function test_access_setNexusCommonFail(address caller) public {
        /// use fuzzing
        vm.assume(caller != executor && caller != rescuer);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        vm.startPrank(caller);
        relic.setNexusCommon(address(nexusCommon));
    }

    function test_access_setNexusCommonSuccess() public {
        vm.startPrank(executor);
        relic.setNexusCommon(address(nexusCommon));
    }
    
    function test_access_setShardCapsFail(address caller) public {
        uint256[] memory caps = new uint256[](2);
        uint256[] memory shardIds = new uint256[](2);
        caps[0] = caps[1] = 9999;
        shardIds[0] = SHARD_1_ID;
        shardIds[1] = SHARD_2_ID;
        vm.assume(caller != executor && caller != rescuer);
        vm.startPrank(caller);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        shard.setAllowedShardCaps(alice, shardIds, caps);
    }

    function test_access_addRecipeFail(address caller) public {
        Shard.Recipe memory recipe = _getRecipe1();
        vm.assume(caller != executor && caller != rescuer);
        vm.startPrank(caller);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        shard.addRecipe(recipe);
    }

    function test_access_deleteRecipeFail(address caller) public {
        vm.assume(caller != executor && caller != rescuer);
        vm.startPrank(caller);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        shard.deleteRecipe(RECIPE_1_ID);
    }

    function test_access_setShardUriFail(address caller) public {
        vm.assume(caller != executor && caller != rescuer);
        vm.startPrank(caller);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        shard.setShardUri(SHARD_1_ID, SHARD_1_URI);
    }

    function test_access_setMinterAllowedShardIdsFail(address caller) public {
        vm.assume(caller != executor && caller != rescuer);
        vm.startPrank(caller);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        uint256[] memory shardIds = new uint256[](1);
        bool[] memory allow = new bool[](1);
        shardIds[0] = SHARD_1_ID;
        allow[0] = true;
        shard.setMinterAllowedShardIds(alice, shardIds, allow);
    }

    function test_access_setNewMinterShardsFail(address caller) public {
        vm.assume(caller != executor && caller != rescuer);
        address[] memory minters = new address[](2);
        minters[0] = bob;
        minters[1] = alice;
        vm.startPrank(caller);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        shard.setNewMinterShards(minters);
    }

    function test_access_setNewMinterShardsSuccess() public {
        address[] memory minters = new address[](2);
        minters[0] = bob;
        minters[1] = alice;
        vm.startPrank(executor);
        shard.setNewMinterShards(minters);
    }

    function test_access_setMinterAllowedShardIdsSuccess() public {
        vm.startPrank(executor);
        uint256[] memory shardIds = new uint256[](1);
        bool[] memory allows = new bool[](1);
        shardIds[0] = SHARD_1_ID;
        allows[0] = true;
        shard.setMinterAllowedShardIds(alice, shardIds, allows);
    }

    function test_access_setShardCapsSuccess() public {
        uint256[] memory caps = new uint256[](2);
        uint256[] memory shardIds = new uint256[](2);
        caps[0] = caps[1] = 9999;
        shardIds[0] = SHARD_1_ID;
        shardIds[1] = SHARD_2_ID;
        vm.startPrank(executor);
        shard.setAllowedShardCaps(operator, shardIds, caps);
    }

    function test_access_addRecipeSuccess() public {
        Shard.Recipe memory recipe = _getRecipe1();
        vm.startPrank(executor);
        shard.addRecipe(recipe);
    }

     function test_access_deleteRecipeSuccess() public {
        Shard.Recipe memory recipe = _getRecipe1();
        vm.startPrank(executor);
        shard.addRecipe(recipe);
        shard.deleteRecipe(RECIPE_1_ID);
    }

    function test_access_setShardUriSuccess() public {
        vm.startPrank(executor);
        shard.setShardUri(SHARD_1_ID, SHARD_1_URI);
    }
}

contract ShardTest is ShardTestBase {

    function test_setNexusCommon() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        shard.setNexusCommon(address(0));

        vm.expectEmit(address(shard));
        emit NexusCommonSet(address(nexusCommon));
        shard.setNexusCommon(address(nexusCommon));
    }

    function test_setMinterAllowedShardIds() public {
        vm.startPrank(executor);
        _unsetMinterShards(operator);
        uint256[] memory shardIds = new uint256[](3);
        bool[] memory allows = new bool[](1);
        // invalid length
        vm.expectRevert(abi.encodeWithSelector(IShard.InvalidParamLength.selector));
        shard.setMinterAllowedShardIds(alice, shardIds, allows);
        // zero address
        allows = new bool[](3);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        shard.setMinterAllowedShardIds(address(0), shardIds, allows);
        
        // cannot mint
        shardIds[0] = 100; // invalid
        shardIds[1] = SHARD_3_ID;
        shardIds[2] = SHARD_4_ID;
        allows = new bool[](3);
        allows[0] = allows[1] = allows[2] = true;

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        shard.setMinterAllowedShardIds(alice, shardIds, allows);

        shardIds[0] = SHARD_2_ID;
        vm.expectEmit(address(shard));
        emit MinterAllowedShardIdSet(alice, shardIds[0], allows[0]);
        vm.expectEmit(address(shard));
        emit MinterAllowedShardIdSet(alice, shardIds[1], allows[1]);
        vm.expectEmit(address(shard));
        emit MinterAllowedShardIdSet(alice, shardIds[2], allows[2]);
        shard.setMinterAllowedShardIds(alice, shardIds, allows);
        
        uint256[] memory shards = shard.getMinterAllowedShardIds(alice);
        assertEq(shards.length, 3);
        assertEq(shards[0], SHARD_2_ID);
        assertEq(shards[1], SHARD_3_ID);
        assertEq(shards[2], SHARD_4_ID);
        allows[1] = false;
        shard.setMinterAllowedShardIds(alice, shardIds, allows);
        shards = shard.getMinterAllowedShardIds(alice);
        assertEq(shards.length, 2);
        assertEq(shards[0], SHARD_2_ID);
        assertEq(shards[1], SHARD_4_ID);
    }

    function test_setNewMinterShards() public {
        vm.startPrank(executor);
        address[] memory minters = new address[](0);
        vm.expectRevert(abi.encodeWithSelector(IShard.InvalidParamLength.selector));
        shard.setNewMinterShards(minters);
        minters = new address[](2);
        minters[0] = bob;
        minters[1] = alice;
        uint256 nextId = shard.nextTokenId();
        vm.expectEmit(address(shard));
        emit MinterAllowedShardIdSet(bob, nextId, true);
        vm.expectEmit(address(shard));
        emit MinterAllowedShardIdSet(alice, nextId+1, true);
        shard.setNewMinterShards(minters);
        assertEq(shard.nextTokenId(), nextId+2);
        assertEq(shard.isShardId(nextId), true);
        assertEq(shard.isShardId(nextId+1), true);
        assertEq(shard.isShardId(nextId+2), false);
        uint256[] memory bobShards = shard.getMinterAllowedShardIds(bob);
        uint256[] memory aliceShards = shard.getMinterAllowedShardIds(alice);
        assertEq(bobShards[bobShards.length-1], nextId);
        assertEq(aliceShards[aliceShards.length-1], nextId+1);
    }

    function test_setShardCaps() public {
        uint256[] memory caps = new uint256[](2);
        uint256[] memory shardIds = new uint256[](2);
        caps[0] = 9999;
        caps[1] = 7777;
        shardIds[0] = SHARD_1_ID;
        shardIds[1] = SHARD_2_ID;

        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        shard.setAllowedShardCaps(address(0), shardIds, caps);

        shardIds = new uint256[](3);
        shardIds[0] = SHARD_1_ID;
        shardIds[1] = SHARD_2_ID;
        shardIds[2] = SHARD_3_ID;
        vm.expectRevert(abi.encodeWithSelector(IShard.InvalidParamLength.selector));
        shard.setAllowedShardCaps(alice, shardIds, caps);

        shardIds = new uint256[](2);
        shardIds[0] = SHARD_1_ID;
        shardIds[1] = SHARD_2_ID;
        // alice is not an allowed minter
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        shard.setAllowedShardCaps(alice, shardIds, caps);
        vm.expectEmit(address(shard));
        emit MinterAllowedShardCapSet(operator, SHARD_1_ID, caps[0]);
        vm.expectEmit(address(shard));
        emit MinterAllowedShardCapSet(operator, SHARD_2_ID, caps[1]);
        shard.setAllowedShardCaps(operator, shardIds, caps);
        assertEq(shard.allowedShardCaps(operator, shardIds[0]), caps[0]);
        assertEq(shard.allowedShardCaps(operator, shardIds[1]), caps[1]);
    }

    function test_addRecipe() public {
        vm.startPrank(executor);
        uint256 recipeId = RECIPE_1_ID;
        Shard.Recipe memory recipe;
        uint256[] memory inputShardIds = new uint256[](1);
        inputShardIds[0] = SHARD_1_ID;
        uint256[] memory inputShardAmounts = new uint256[](2);
        inputShardAmounts[0] = 2;
        inputShardAmounts[1] = 1;
        recipe.inputShardAmounts = inputShardAmounts;
        recipe.inputShardIds = inputShardIds;
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        shard.addRecipe(recipe);
        inputShardIds = new uint256[](2);
        inputShardIds[0] = SHARD_1_ID;
        inputShardIds[1] = SHARD_2_ID;
        recipe.inputShardIds = inputShardIds;

        uint256[] memory outputShardIds = new uint256[](1);
        outputShardIds[0] = SHARD_3_ID;
        uint256[] memory outputShardAmounts = new uint256[](2);
        outputShardAmounts[0] = 1;
        outputShardAmounts[1] = 2;
        recipe.outputShardIds = outputShardIds;
        recipe.outputShardAmounts = outputShardAmounts;
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        shard.addRecipe(recipe);

        outputShardAmounts = new uint256[](1);
        outputShardAmounts[0] = 1;
        recipe.outputShardAmounts = outputShardAmounts;
        vm.expectEmit(address(shard));
        emit RecipeSet(recipeId, recipe);
        shard.addRecipe(recipe);
        Shard.Recipe memory _recipe = shard.getRecipeInfo(recipeId);
        assertEq(_recipe.inputShardIds, recipe.inputShardIds);
        assertEq(_recipe.inputShardAmounts, recipe.inputShardAmounts);
        assertEq(_recipe.outputShardIds, recipe.outputShardIds);
        assertEq(_recipe.outputShardAmounts, recipe.outputShardAmounts);
    }

    function test_deleteRecipe() public {
        vm.startPrank(executor);
        uint256 recipeId = RECIPE_1_ID;
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        shard.deleteRecipe(recipeId);

        Shard.Recipe memory recipe = _getRecipe1();
        shard.addRecipe(recipe);
        Shard.Recipe memory _recipe = shard.getRecipeInfo(recipeId);
        assertEq(_recipe.inputShardIds, recipe.inputShardIds);
        assertEq(_recipe.inputShardAmounts, recipe.inputShardAmounts);
        assertEq(_recipe.outputShardIds, recipe.outputShardIds);
        assertEq(_recipe.outputShardAmounts, recipe.outputShardAmounts);

        vm.expectEmit(address(shard));
        emit RecipeDeleted(recipeId);
        shard.deleteRecipe(recipeId);
        _recipe = shard.getRecipeInfo(recipeId);
        uint256[] memory empty;
        assertEq(_recipe.inputShardIds, empty);
        assertEq(_recipe.inputShardAmounts, empty);
        assertEq(_recipe.outputShardIds, empty);
        assertEq(_recipe.outputShardAmounts, empty);
    }

    function test_setShardUri() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        shard.setShardUri(SHARD_1_ID, "");

        vm.expectEmit(address(shard));
        emit ShardUriSet(SHARD_1_ID, SHARD_1_URI);
        shard.setShardUri(SHARD_1_ID, SHARD_1_URI);
        assertEq(shard.uri(SHARD_1_ID), SHARD_1_URI);
        shard.setShardUri(SHARD_2_ID, SHARD_2_URI);
        assertEq(shard.uri(SHARD_2_ID), SHARD_2_URI);
    }

    function test_transmute() public {
        _setRecipe1();
        vm.startPrank(bob);
        vm.expectRevert(abi.encodeWithSelector(IShard.InvalidRecipe.selector, RECIPE_2_ID));
        shard.transmute(RECIPE_2_ID);

        vm.startPrank(operator);
        uint256[] memory shards = new uint256[](2);
        uint256[] memory amounts = new uint256[](2);
        shards[0] = SHARD_1_ID;
        shards[1] = SHARD_2_ID;
        amounts[0] = amounts[1] = 5;
        shard.mintBatch(bob, shards, amounts);

        vm.startPrank(bob);
        shard.setApprovalForAll(address(shard), true);
        uint256 shard1BalanceBefore = shard.balanceOf(bob, SHARD_1_ID);
        uint256 shard2BalanceBefore = shard.balanceOf(bob, SHARD_2_ID);
        uint256 shard3BalanceBefore = shard.balanceOf(bob, SHARD_3_ID);

        vm.expectEmit(address(shard));
        emit Transmuted(bob, RECIPE_1_ID);
        shard.transmute(RECIPE_1_ID);
        assertEq(shard.balanceOf(bob, SHARD_1_ID), shard1BalanceBefore-2);
        assertEq(shard.balanceOf(bob, SHARD_2_ID), shard2BalanceBefore-1);
        assertEq(shard.balanceOf(bob, SHARD_3_ID), shard3BalanceBefore+1);
    }

    function test_mintBatch() public {
        uint256[] memory amounts = new uint256[](2);
        uint256[] memory shardIds = new uint256[](2);
        uint256[] memory caps = new uint256[](2);

        // blacklisting
        {   
            vm.startPrank(operator);
            uint256 relicId = relic.nextTokenId();
            relic.mintRelic(alice, CHAOS_ID);
            vm.startPrank(executor);
            relic.setBlacklistAccount(alice, relicId, true);
            vm.startPrank(operator);
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.AccountBlacklisted.selector, alice));
            shard.mintBatch(alice, shardIds, amounts);
            vm.startPrank(executor);
            relic.setBlacklistAccount(alice, relicId, false);
        }
        // param length
        {
            vm.startPrank(operator);
            shardIds = new uint256[](1);
            vm.expectRevert(abi.encodeWithSelector(IShard.InvalidParamLength.selector));
            shard.mintBatch(alice, shardIds, amounts);
        }
        shardIds = new uint256[](2);
        shardIds[0] = SHARD_2_ID;
        shardIds[1] = SHARD_3_ID;
        amounts[0] = 2;
        amounts[1] = 1;
        vm.startPrank(executor);
        address[] memory minters = new address[](1);
        minters[0] = alice;
        uint256[] memory newShardIds = shard.setNewMinterShards(minters);
        // cannot mint
        {
            // shard id not set
            shardIds[0] = newShardIds[0];
            vm.startPrank(operator);
            vm.expectRevert(abi.encodeWithSelector(IShard.CannotMint.selector, shardIds[0]));
            shard.mintBatch(alice, shardIds, amounts);
            
        }
        // reset
        vm.startPrank(executor);
        bool[] memory allow = new bool[](2);
        allow[0] = allow[1] = true;
        shard.setMinterAllowedShardIds(operator, shardIds, allow);
        // mint cap exceeded
        {
            caps[0] = caps[1] = 1;
            shard.setAllowedShardCaps(operator, shardIds, caps);
            vm.startPrank(operator);
            vm.expectRevert(abi.encodeWithSelector(IShard.MintCapExceeded.selector, 1, 2));
            shard.mintBatch(alice, shardIds, amounts);
        }
        vm.startPrank(executor);
        caps[0] = caps[1] = 100;
        shard.setAllowedShardCaps(operator, shardIds, caps);
        vm.startPrank(operator);
        uint256 aliceShard2BalanceBefore = shard.balanceOf(alice, newShardIds[0]);
        uint256 aliceShard3BalanceBefore = shard.balanceOf(alice, SHARD_3_ID);
        uint256 shard2MintBalanceBefore = shard.mintBalances(operator, newShardIds[0]);
        uint256 shard3MintBalanceBefore = shard.mintBalances(operator, SHARD_3_ID);
        uint256 totalShard2MintsBefore = shard.totalShardMints(newShardIds[0]);
        uint256 totalShard3MintsBefore = shard.totalShardMints(SHARD_3_ID);
        shard.mintBatch(alice, shardIds, amounts);
        assertEq(shard.balanceOf(alice, newShardIds[0]), aliceShard2BalanceBefore + 2);
        assertEq(shard.balanceOf(alice, SHARD_3_ID), aliceShard3BalanceBefore + 1);
        assertEq(shard.totalShardMints(newShardIds[0]), totalShard2MintsBefore + 2);
        assertEq(shard.totalShardMints(SHARD_3_ID), totalShard3MintsBefore + 1);
        assertEq(shard.mintBalances(operator, newShardIds[0]), shard2MintBalanceBefore + 2);
        assertEq(shard.mintBalances(operator, SHARD_3_ID), shard3MintBalanceBefore + 1);
    }
    
    function test_burnBatch() public {
        // shard owners can burn shards 
        uint256[] memory amounts = new uint256[](2);
        uint256[] memory shardIds = new uint256[](2);
        amounts[0] = amounts[1] = 1;
        shardIds[0] = SHARD_1_ID;
        shardIds[1] = SHARD_2_ID;
        uint256 bobShard1BalanceBefore = shard.balanceOf(bob, SHARD_1_ID);
        uint256 bobShard2BalanceBefore = shard.balanceOf(bob, SHARD_2_ID);
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(IShard.ERC1155MissingApprovalForAll.selector, alice, bob));
        shard.burnBatch(bob, shardIds, amounts);
        vm.startPrank(bob);
        shard.burn(bob, SHARD_1_ID, 1);
        shard.burnBatch(bob, shardIds, amounts);
        assertEq(shard.balanceOf(bob, SHARD_1_ID), bobShard1BalanceBefore-1-amounts[0]);
        assertEq(shard.balanceOf(bob, SHARD_2_ID), bobShard2BalanceBefore-amounts[1]);

        // relic can only burn blacklisted account shards which are equipped
        shard.setApprovalForAll(address(relic), true);
        relic.batchEquipShards(RELIC_1_ID, shardIds, amounts);
        uint256 relicShard1BalanceBefore = shard.balanceOf(address(relic), shardIds[0]);
        uint256 relicShard2BalanceBefore = shard.balanceOf(address(relic), shardIds[1]);
        vm.startPrank(executor);
        relic.setBlacklistAccount(bob, RELIC_1_ID, true);
        relic.setBlacklistedShards(bob, RELIC_1_ID, shardIds, amounts);
        relic.burnBlacklistedRelicShards(bob, RELIC_1_ID, shardIds, amounts);
        assertEq(shard.balanceOf(address(relic), shardIds[0]), relicShard1BalanceBefore-amounts[0]);
        assertEq(shard.balanceOf(address(relic), shardIds[1]), relicShard2BalanceBefore-amounts[1]);

        // test burn by owner and approved
        vm.startPrank(operator);
        shardIds = new uint256[](1);
        amounts = new uint256[](1);
        amounts[0] = 2;
        shardIds[0] = SHARD_2_ID;
        shard.mintBatch(alice, shardIds, amounts);
        // set approval for bob
        vm.startPrank(alice);
        shard.setApprovalForAll(bob, true);
        uint256[] memory burnAmount = new uint256[](1);
        burnAmount[0] = 1;
        shard.burnBatch(alice, shardIds, burnAmount);
        assertEq(shard.balanceOf(alice, shardIds[0]), 1);
        vm.startPrank(bob);
        shard.burnBatch(alice, shardIds, burnAmount);
        assertEq(shard.balanceOf(alice, shardIds[0]), 0);
    }
}