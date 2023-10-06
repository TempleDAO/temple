pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later


import { TempleTest } from "../TempleTest.sol";
import { Relic } from "../../../contracts/nexus/Relic.sol";
import { Shard } from "../../../contracts/nexus/Shard.sol";
import { CommonEventsAndErrors } from "../../../contracts/common/CommonEventsAndErrors.sol";


contract ShardTestBase is TempleTest {
    Relic public relic;
    Shard public shard;

    string private constant name = "RELIC";
    string private constant symbol = "REL";

    string internal constant SHARD_1_URI = "https://example1.com";
    string internal constant SHARD_2_URI = "https://example2.com";
    string internal constant SHARD_3_URI = "https://example3.com";
    string internal constant SHARD_4_URI = "https://example4.com";

    uint256 internal constant SHARD_1_ID = 0x01; 
    uint256 internal constant SHARD_2_ID = 0x02;
    uint256 internal constant SHARD_3_ID = 0x03;
    uint256 internal constant SHARD_4_ID = 0x04;

    uint256 internal constant RECIPE_1_ID = 0x01; // 1
    uint256 internal constant RECIPE_2_ID = 0x02; // 2
    uint256 internal constant RECIPE_3_ID = 0x03; // 3

    uint256 internal constant RELIC_1_ID = 0x01; // 1

     enum Enclave {
        Chaos,
        Mystery,
        Logic,
        Order,
        Structure,
        InvalidEnclave
    }

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

    event Transmuted(address caller, uint256 recipeId);
    event ShardMinted();
    event ShardUriSet(uint256 shardId, string uri);
    event RecipeSet(uint256 recipeId, Shard.Recipe recipe);
    event RecipeDeleted(uint256 recipeId);
    event PartnerAllowedShardIdSet(address partner, uint256 shardId, bool allow);
    event TransferSingle(address operator, address from, address to, uint256 id, uint256 value);
    event ShardEnclaveSet(Shard.Enclave enclave, uint256 shardId);
    event RegularShardIdSet(uint256 shardId, bool allow);
    event MinterAllowedShardIdSet(address minter, uint256 shardId, bool allow);
    event MinterAllowedShardCapSet(address minter, uint256 shardId, uint256 cap);
    event ShardIdSet(uint256 shardId, bool allow);
    
    function setUp() public {
        relic = new Relic(name, symbol, rescuer, executor);
        shard = new Shard(address(relic), rescuer, executor, "http://example.com");

        vm.startPrank(executor);
        // relic setup
        {
            relic.setRelicMinter(operator, true);
            relic.setShard(address(shard));
            changePrank(operator);
            relic.mintRelic(bob, Relic.Enclave.Logic);
            relic.mintRelic(bob, Relic.Enclave.Mystery);
        }
        // shard setup
        uint256 shardId;
        {
            changePrank(executor);
            shardId = shard.setNewMinterShard(operator); // ID 1
            shard.setMinterAllowedShardId(bob, shardId, true);
            shard.setNewMinterShard(operator); // ID 2
            shard.setNewMinterShard(operator); // ID 3
            shard.setNewMinterShard(operator); // ID 4
            shard.setShardUri(SHARD_1_ID, SHARD_1_URI);
            shard.setShardUri(SHARD_2_ID, SHARD_2_URI);
            shard.setShardUri(SHARD_3_ID, SHARD_3_URI);
            shard.setShardUri(SHARD_4_ID, SHARD_4_URI);

            changePrank(operator);
            shard.mint(bob, SHARD_1_ID, 5);
            shard.mint(bob, SHARD_2_ID, 10);
        }
        vm.stopPrank();
    }

    function test_initialization() public {
        assertEq(address(shard.relic()), address(relic));
        assertEq(shard.rescuer(), rescuer);
        assertEq(shard.executor(), executor);
        assertEq(shard.uri(SHARD_1_ID), SHARD_1_URI);
        assertEq(shard.uri(SHARD_2_ID), SHARD_2_URI);
        assertEq(shard.uri(SHARD_3_ID), SHARD_3_URI);
        assertEq(shard.uri(SHARD_4_ID), SHARD_4_URI);
        assertEq(shard.nextTokenId(), 5);
        assertEq(shard.nextRecipeId(), 1);
    }

    function _setRecipe1() internal {
        Shard.Recipe memory recipe = _getRecipe1();
        vm.startPrank(executor);
        shard.setRecipe(recipe);
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
        shard.setMinterAllowedShardId(minter, SHARD_1_ID, false);
        shard.setMinterAllowedShardId(minter, SHARD_2_ID, false);
        shard.setMinterAllowedShardId(minter, SHARD_3_ID, false);
        shard.setMinterAllowedShardId(minter, SHARD_4_ID, false);
    }
}

contract ShardTestView is ShardTestBase {

    function test_nextTokenId() public {
        uint256 currentId = shard.nextTokenId() - 1;
        vm.startPrank(executor);
        shard.setNewMinterShard(alice);
        assertEq(shard.nextTokenId(), currentId + 2);
        shard.setNewMinterShard(alice);
        assertEq(shard.nextTokenId(), currentId + 3);
    }

    function test_getMinterAllowedShardIds() public {
        vm.startPrank(executor);
        _unsetMinterShards(operator);
        uint256[] memory shards = shard.getMinterAllowedShardIds(operator);
        assertEq(shards.length, 0);

        shard.setMinterAllowedShardId(operator, SHARD_1_ID, true);
        shards = shard.getMinterAllowedShardIds(operator);
        assertEq(shards.length, 1);
        assertEq(shards[0], SHARD_1_ID);
        shard.setMinterAllowedShardId(operator, SHARD_3_ID, true);
        shards = shard.getMinterAllowedShardIds(operator);
        assertEq(shards.length, 2);
        // no remove operation yet on UintSet, so safe index access
        assertEq(shards[0], SHARD_1_ID);
        assertEq(shards[1], SHARD_3_ID);
    }

    function test_enclaveShards() public {
        vm.startPrank(executor);
        shard.setShardEnclave(Shard.Enclave.Mystery, SHARD_2_ID);
        uint256[] memory mysteryShards = shard.getEnclaveShards(Shard.Enclave.Mystery);
        assertEq(mysteryShards.length, 1);
        assertEq(mysteryShards[0], SHARD_2_ID);
        shard.setShardEnclave(Shard.Enclave.Chaos, SHARD_3_ID);
        mysteryShards = shard.getEnclaveShards(Shard.Enclave.Mystery);
        assertEq(mysteryShards.length, 1);
        assertEq(mysteryShards[0], SHARD_2_ID);
        assertEq(shard.isEnclaveShard(Shard.Enclave.Mystery, SHARD_2_ID), true);
        assertEq(shard.isEnclaveShard(Shard.Enclave.Mystery, SHARD_3_ID), false);
        assertEq(shard.isEnclaveShard(Shard.Enclave.Chaos, SHARD_2_ID), false);
        assertEq(shard.isEnclaveShard(Shard.Enclave.Chaos, SHARD_3_ID), true);
    }

    function test_getMintInfo() public {
        vm.startPrank(executor);
        shard.setMinterAllowedShardId(alice, SHARD_4_ID, true);
        shard.setMinterAllowedShardId(alice, SHARD_2_ID, true);
        changePrank(alice);
        Shard.MintInfo memory mintInfo = shard.getMintInfo(alice);
        uint256[] memory shardIdsBefore = mintInfo.shardIds;
        uint256[] memory balancesBefore = mintInfo.balances;
        uint256[] memory capsBefore = mintInfo.caps;
        assertEq(capsBefore.length, 2);
        assertEq(balancesBefore.length, 2);
        assertEq(shardIdsBefore.length, 2);

        shard.mint(bob, SHARD_2_ID, 10);
        shard.mint(operator, SHARD_4_ID, 5);
        shard.mint(bob, SHARD_2_ID, 10);
        mintInfo = shard.getMintInfo(alice);
        uint256[] memory shardIdsAfter = mintInfo.shardIds;
        uint256[] memory balancesAfter = mintInfo.balances;
        uint256[] memory capsAfter = mintInfo.caps;
        assertEq(capsAfter.length, 2);
        assertEq(balancesAfter.length, 2);
        assertEq(shardIdsAfter.length, 2);
        assertEq(balancesAfter[0], 5);
        assertEq(balancesAfter[1], 20);
        assertEq(shardIdsAfter[0], SHARD_4_ID);
        assertEq(shardIdsAfter[1], SHARD_2_ID);
        assertEq(capsAfter[0], 0);
        assertEq(capsAfter[1], 0);
        changePrank(executor);
        uint256[] memory caps = new uint256[](2);
        caps[0] = 1_000;
        caps[1] = 10_000;
        shard.setAllowedShardCaps(alice, shardIdsBefore, caps);
        changePrank(alice);
        shard.mint(bob, SHARD_2_ID, 100);
        shard.mint(operator, SHARD_4_ID, 20);
        mintInfo = shard.getMintInfo(alice);
        shardIdsAfter = mintInfo.shardIds;
        balancesAfter = mintInfo.balances;
        capsAfter = mintInfo.caps;
        assertEq(capsAfter.length, 2);
        assertEq(balancesAfter.length, 2);
        assertEq(shardIdsAfter.length, 2);
        assertEq(balancesAfter[0], 25);
        assertEq(balancesAfter[1], 120);
        assertEq(shardIdsAfter[0], SHARD_4_ID);
        assertEq(shardIdsAfter[1], SHARD_2_ID);
        assertEq(capsAfter[0], 1_000);
        assertEq(capsAfter[1], 10_000);
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
        uint256 currentId = shard.setNewMinterShard(operator);
        assertEq(shard.isShardId(currentId), true);
        assertEq(shard.isShardId(currentId+1), false);
        
        currentId = shard.setNewMinterShard(operator);
        assertEq(shard.isShardId(currentId), true);
        currentId = shard.setNewMinterShard(operator);
        assertEq(shard.isShardId(currentId), true);
        assertEq(shard.isShardId(currentId+1), false);
        assertEq(shard.nextTokenId(), currentId + 1);
    }
}


contract ShardTestAccess is ShardTestView {

    function test_access_setShardEnclaveFail(address caller) public {
        vm.assume(caller != executor && caller != rescuer);
        vm.startPrank(caller);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        shard.setShardEnclave(Shard.Enclave.Mystery, SHARD_1_ID);
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

    function test_access_setRecipeFail(address caller) public {
        Shard.Recipe memory recipe = _getRecipe1();
        vm.assume(caller != executor && caller != rescuer);
        vm.startPrank(caller);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        shard.setRecipe(recipe);
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

    function test_access_setNewMinterShardFail(address caller) public {
        vm.assume(caller != executor && caller != rescuer);
        vm.startPrank(caller);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        shard.setNewMinterShard(alice);
    }

    function test_access_setNewMinterShardSuccess() public {
        vm.startPrank(executor);
        shard.setNewMinterShard(alice);
    }

    function test_access_setMinterAllowedShardIdFail(address caller) public {
        vm.assume(caller != executor && caller != rescuer);
        vm.startPrank(caller);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        shard.setMinterAllowedShardId(alice, SHARD_1_ID, true);
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

    function test_access_setMinterAllowedShardIdSuccess() public {
        vm.startPrank(executor);
        shard.setMinterAllowedShardId(alice, SHARD_1_ID, true);
    }

     function test_access_setMinterAllowedShardIdsFail(address caller) public {
        vm.assume(caller != executor && caller != rescuer);
        vm.startPrank(caller);
        uint256[] memory shardIds = new uint256[](1);
        bool[] memory allows = new bool[](1);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        shard.setMinterAllowedShardIds(alice, shardIds, allows);
    }

    function test_access_setMinterAllowedShardIdsSuccess() public {
        vm.startPrank(executor);
        uint256[] memory shardIds = new uint256[](1);
        bool[] memory allows = new bool[](1);
        shardIds[0] = SHARD_1_ID;
        allows[0] = true;
        shard.setMinterAllowedShardIds(alice, shardIds, allows);
    }

    function test_access_setShardEnclaveSuccess() public {
        vm.startPrank(executor);
        shard.setShardEnclave(Shard.Enclave.Structure, SHARD_1_ID);
    }

    function test_access_setShardCapsSuccess() public {
        uint256[] memory caps = new uint256[](2);
        uint256[] memory shardIds = new uint256[](2);
        caps[0] = caps[1] = 9999;
        shardIds[0] = SHARD_1_ID;
        shardIds[1] = SHARD_2_ID;
        vm.startPrank(executor);
        shard.setAllowedShardCaps(alice, shardIds, caps);
    }

    function test_access_setRecipeSuccess() public {
        Shard.Recipe memory recipe = _getRecipe1();
        vm.startPrank(executor);
        shard.setRecipe(recipe);
    }

     function test_access_deleteRecipeSuccess() public {
        Shard.Recipe memory recipe = _getRecipe1();
        vm.startPrank(executor);
        shard.setRecipe(recipe);
        shard.deleteRecipe(RECIPE_1_ID);
    }

    function test_access_setShardUriSuccess() public {
        vm.startPrank(executor);
        shard.setShardUri(SHARD_1_ID, SHARD_1_URI);
    }
}

contract ShardTest is ShardTestAccess {

    function test_setShardEnclave() public {
        vm.startPrank(executor);
        vm.expectEmit(address(shard));
        emit ShardEnclaveSet(Shard.Enclave.Chaos, SHARD_1_ID);
        shard.setShardEnclave(Shard.Enclave.Chaos, SHARD_1_ID);
        assertEq(shard.isEnclaveShard(Shard.Enclave.Chaos, SHARD_1_ID), true);
        Shard.Enclave oldEnclave = Shard.Enclave.Chaos;
        Shard.Enclave newEnclave = Shard.Enclave.Mystery;
        shard.setShardEnclave(newEnclave, SHARD_1_ID);
        assertEq(shard.isEnclaveShard(oldEnclave, SHARD_1_ID), false);
        assertEq(shard.isEnclaveShard(newEnclave, SHARD_1_ID), true);
    }

    function test_setMinterAllowedShardId() public {
        vm.startPrank(executor);
        _unsetMinterShards(operator);
        vm.expectRevert(abi.encodeWithSelector(Shard.ZeroAddress.selector));
        shard.setMinterAllowedShardId(address(0), SHARD_1_ID, true);
        uint256 nextShardId = shard.nextTokenId();
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        shard.setMinterAllowedShardId(operator, nextShardId, true);

        vm.expectEmit(address(shard));
        emit MinterAllowedShardIdSet(operator, SHARD_1_ID, true);
        shard.setMinterAllowedShardId(operator, SHARD_1_ID, true);
        uint256[] memory shards = shard.getMinterAllowedShardIds(operator);
        assertEq(shards.length, 1);
        assertEq(shards[0], SHARD_1_ID);

        vm.expectEmit(address(shard));
        emit MinterAllowedShardIdSet(operator, SHARD_2_ID, true);
        shard.setMinterAllowedShardId(operator, SHARD_2_ID, true);
        shards = shard.getMinterAllowedShardIds(operator);
        assertEq(shards.length, 2);
        // safe as no remove operation done yet on UintSet
        assertEq(shards[0], SHARD_1_ID);
        assertEq(shards[1], SHARD_2_ID);
        vm.expectEmit(address(shard));
        emit MinterAllowedShardIdSet(operator, SHARD_2_ID, false);
        shard.setMinterAllowedShardId(operator, SHARD_2_ID, false);
        shards = shard.getMinterAllowedShardIds(operator);
        assertEq(shards.length, 1);
        assertEq(shards[0], SHARD_1_ID);
    }

    function test_setMinterAllowedShardIds() public {
        vm.startPrank(executor);
        _unsetMinterShards(operator);
        uint256[] memory shardIds = new uint256[](3);
        bool[] memory allows = new bool[](1);
        // zero address
        vm.expectRevert(abi.encodeWithSelector(Shard.ZeroAddress.selector));
        shard.setMinterAllowedShardIds(address(0), shardIds, allows);
        // invalid length
        vm.expectRevert(abi.encodeWithSelector(Shard.InvalidParamLength.selector));
        shard.setMinterAllowedShardIds(alice, shardIds, allows);
        // cannot mint
        shardIds[0] = 100; // invalid
        shardIds[1] = SHARD_3_ID;
        shardIds[2] = SHARD_4_ID;
        allows = new bool[](3);
        allows[0] = allows[1] = allows[2] = true;

        vm.expectRevert(abi.encodeWithSelector(Shard.CannotMint.selector, 100));
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

    function test_setNewMinterShard() public {
        vm.startPrank(executor);
        uint256 shardId = shard.nextTokenId();
        vm.expectEmit(address(shard));
        emit MinterAllowedShardIdSet(alice, shardId, true);
        uint256 newId = shard.setNewMinterShard(alice);
        assertEq(shard.nextTokenId(), shardId+1);
        assertEq(newId, shardId);
    }

    function test_setNewMinterShards() public {
        vm.startPrank(executor);
        address[] memory minters = new address[](0);
        vm.expectRevert(abi.encodeWithSelector(Shard.InvalidParamLength.selector));
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
        vm.expectRevert(abi.encodeWithSelector(Shard.ZeroAddress.selector));
        shard.setAllowedShardCaps(address(0), shardIds, caps);

        shardIds = new uint256[](3);
        shardIds[0] = SHARD_1_ID;
        shardIds[1] = SHARD_2_ID;
        shardIds[2] = SHARD_3_ID;
        vm.expectRevert(abi.encodeWithSelector(Shard.InvalidParamLength.selector));
        shard.setAllowedShardCaps(alice, shardIds, caps);

        shardIds = new uint256[](2);
        shardIds[0] = SHARD_1_ID;
        shardIds[1] = SHARD_2_ID;
        vm.expectEmit(address(shard));
        emit MinterAllowedShardCapSet(alice, SHARD_1_ID, caps[0]);
        vm.expectEmit(address(shard));
        emit MinterAllowedShardCapSet(alice, SHARD_2_ID, caps[1]);
        shard.setAllowedShardCaps(alice, shardIds, caps);
        assertEq(shard.allowedShardCaps(alice, shardIds[0]), caps[0]);
        assertEq(shard.allowedShardCaps(alice, shardIds[1]), caps[1]);
    }

    function test_setRecipe() public {
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
        shard.setRecipe(recipe);
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
        shard.setRecipe(recipe);

        outputShardAmounts = new uint256[](1);
        outputShardAmounts[0] = 1;
        recipe.outputShardAmounts = outputShardAmounts;
        vm.expectEmit(address(shard));
        emit RecipeSet(recipeId, recipe);
        shard.setRecipe(recipe);
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
        shard.setRecipe(recipe);
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
        changePrank(bob);
        vm.expectRevert(abi.encodeWithSelector(Shard.InvalidRecipe.selector, RECIPE_2_ID));
        shard.transmute(RECIPE_2_ID);

        changePrank(operator);
        shard.mint(bob, SHARD_1_ID, 5);
        shard.mint(bob, SHARD_2_ID, 5);

        changePrank(bob);
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

    function test_mint() public {
        vm.startPrank(executor);
        shard.setMinterAllowedShardId(operator, SHARD_4_ID, true);
        uint256[] memory caps = new uint256[](1);
        uint256[] memory shardIds = new uint256[](1);
        caps[0] = 1;
        shardIds[0] = SHARD_3_ID;
        shard.setAllowedShardCaps(operator, shardIds, caps);

        uint256[] memory amounts = new uint256[](1);
        relic.setBlacklistAccount(alice, true, RELIC_1_ID, shardIds, amounts);
        changePrank(operator);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.AccountBlacklisted.selector, alice));
        shard.mint(alice, SHARD_3_ID, 1);
        changePrank(executor);
        relic.setBlacklistAccount(alice, false, RELIC_1_ID, shardIds, amounts);
        shard.setMinterAllowedShardId(operator, SHARD_3_ID, false);
        // test cannot mint
        {
            changePrank(operator);
            vm.expectRevert(abi.encodeWithSelector(Shard.CannotMint.selector, SHARD_3_ID));
            shard.mint(alice, SHARD_3_ID, 1);
            changePrank(executor);
            
            changePrank(operator);
            vm.expectRevert(abi.encodeWithSelector(Shard.CannotMint.selector, SHARD_3_ID));
            shard.mint(alice, SHARD_3_ID, 1);
            changePrank(executor);
            shard.setMinterAllowedShardId(operator, SHARD_3_ID, true);
        }
        // invalid param
        {
            changePrank(operator);
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
            shard.mint(alice, SHARD_3_ID, 0);
        }
        // mint cap exceeded
        {
            changePrank(executor);
            shard.setAllowedShardCaps(operator, shardIds, caps);
            changePrank(operator);
            vm.expectRevert(abi.encodeWithSelector(Shard.MintCapExceeded.selector, 1, 2));
            shard.mint(alice, SHARD_3_ID, 2);

            // reset 
            changePrank(executor);
            caps[0] = 5;
            shard.setAllowedShardCaps(operator, shardIds, caps);
        }
        // successful mints and checks
        changePrank(operator);
        uint256 aliceShard3BalanceBefore = shard.balanceOf(alice, SHARD_3_ID);
        uint256 operatorShard3MintBalanceBefore = shard.mintBalances(operator, SHARD_3_ID);
        uint256 totalShard3MintsBefore = shard.totalShardMints(SHARD_3_ID);
        shard.mint(alice, SHARD_3_ID, 3);
        assertEq(shard.balanceOf(alice, SHARD_3_ID), aliceShard3BalanceBefore + 3);
        assertEq(shard.mintBalances(operator, SHARD_3_ID), operatorShard3MintBalanceBefore + 3);
        assertEq(shard.totalShardMints(SHARD_3_ID), totalShard3MintsBefore + 3);
    }

    function test_mintBatch() public {
        uint256[] memory amounts = new uint256[](2);
        uint256[] memory shardIds = new uint256[](2);
        uint256[] memory caps = new uint256[](2);

        // blacklisting
        {   
            vm.startPrank(executor);
            relic.setBlacklistAccount(alice, true, RELIC_1_ID, shardIds, amounts);
            changePrank(operator);
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.AccountBlacklisted.selector, alice));
            shard.mint(alice, SHARD_3_ID, 1);
            changePrank(executor);
            relic.setBlacklistAccount(alice, false, RELIC_1_ID, shardIds, amounts);
        }
        // param length
        {
            changePrank(operator);
            shardIds = new uint256[](1);
            vm.expectRevert(abi.encodeWithSelector(Shard.InvalidParamLength.selector));
            shard.mintBatch(alice, shardIds, amounts);
        }
        shardIds = new uint256[](2);
        shardIds[0] = SHARD_2_ID;
        shardIds[1] = SHARD_3_ID;
        amounts[0] = 2;
        amounts[1] = 1;
        changePrank(executor);
        uint256 newShardId = shard.setNewMinterShard(alice);
        // cannot mint
        {
            // shard id not set
            shardIds[0] = newShardId;
            changePrank(operator);
            vm.expectRevert(abi.encodeWithSelector(Shard.CannotMint.selector, shardIds[0]));
            shard.mintBatch(alice, shardIds, amounts);
            
        }
        // reset
        changePrank(executor);
        shard.setMinterAllowedShardId(operator, newShardId, true);
        shard.setMinterAllowedShardId(operator, SHARD_3_ID, true);
        // mint cap exceeded
        {
            caps[0] = caps[1] = 1;
            shard.setAllowedShardCaps(operator, shardIds, caps);
            changePrank(operator);
            vm.expectRevert(abi.encodeWithSelector(Shard.MintCapExceeded.selector, 1, 2));
            shard.mintBatch(alice, shardIds, amounts);
        }
        changePrank(executor);
        caps[0] = caps[1] = 100;
        shard.setAllowedShardCaps(operator, shardIds, caps);
        changePrank(operator);
        uint256 aliceShard2BalanceBefore = shard.balanceOf(alice, newShardId);
        uint256 aliceShard3BalanceBefore = shard.balanceOf(alice, SHARD_3_ID);
        uint256 shard2MintBalanceBefore = shard.mintBalances(operator, newShardId);
        uint256 shard3MintBalanceBefore = shard.mintBalances(operator, SHARD_3_ID);
        uint256 totalShard2MintsBefore = shard.totalShardMints(newShardId);
        uint256 totalShard3MintsBefore = shard.totalShardMints(SHARD_3_ID);
        shard.mintBatch(alice, shardIds, amounts);
        assertEq(shard.balanceOf(alice, newShardId), aliceShard2BalanceBefore + 2);
        assertEq(shard.balanceOf(alice, SHARD_3_ID), aliceShard3BalanceBefore + 1);
        assertEq(shard.totalShardMints(newShardId), totalShard2MintsBefore + 2);
        assertEq(shard.totalShardMints(SHARD_3_ID), totalShard3MintsBefore + 1);
        assertEq(shard.mintBalances(operator, newShardId), shard2MintBalanceBefore + 2);
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
        vm.expectRevert(abi.encodeWithSelector(Shard.ERC1155MissingApprovalForAll.selector, alice, bob));
        shard.burnBatch(bob, shardIds, amounts);
        changePrank(bob);
        shard.burn(bob, SHARD_1_ID, 1);
        shard.burnBatch(bob, shardIds, amounts);
        assertEq(shard.balanceOf(bob, SHARD_1_ID), bobShard1BalanceBefore-1-amounts[0]);
        assertEq(shard.balanceOf(bob, SHARD_2_ID), bobShard2BalanceBefore-amounts[1]);

        // relic can only burn blacklisted account shards which are equipped
        shard.setApprovalForAll(address(relic), true);
        relic.batchEquipShards(RELIC_1_ID, shardIds, amounts);
        changePrank(executor);
        relic.setBlacklistAccount(bob, true, RELIC_1_ID, shardIds, amounts);
        relic.burnBlacklistedAccountShards(bob, false, RELIC_1_ID, shardIds);

    }
}