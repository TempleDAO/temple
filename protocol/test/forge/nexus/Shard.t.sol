pragma solidity 0.8.18;
// SPDX-License-Identifier: AGPL-3.0-or-later


import { TempleTest } from "../TempleTest.sol";
import { Relic } from "../../../contracts/nexus/Relic.sol";
import { Shard } from "../../../contracts/nexus/Shard.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import "forge-std/console.sol";


contract ShardTestBase is TempleTest {
    Relic public relic;
    Shard public shard;

    string private constant name = "RELIC";
    string private constant symbol = "REL";

    string internal constant SHARD_1_URI = "https://example1.com";
    string internal constant SHARD_2_URI = "https://example2.com";
    string internal constant SHARD_3_URI = "https://example3.com";
    string internal constant SHARD_4_URI = "https://example4.com";

    uint256 internal constant SHARD_1_ID = 0x7B;  // 123
    uint256 internal constant SHARD_2_ID = 0x1C8; // 456
    uint256 internal constant SHARD_3_ID = 0x315; // 789
    uint256 internal constant SHARD_4_ID = 0x1A4; // 420

    uint256 internal constant RECIPE_1_ID = 0x01; // 1
    uint256 internal constant RECIPE_2_ID = 0x02; // 2
    uint256 internal constant RECIPE_3_ID = 0x03; // 3

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
    event PartnerAllowedShardIdsSet(address partner, uint256[] shardIds, bool[] allowances);
    event PartnerAllowedShardCapsSet(address partner, uint256[] shardIds, uint256[] caps);
    event TemplarMinterSet(address minter, bool allowed);
    event RecipeDeleted(uint256 recipeId);
    event PartnerAllowedShardIdSet(address partner, uint256 shardId, bool allow);

    function setUp() public {
        relic = new Relic(name, symbol, rescuer, executor);
        shard = new Shard(address(relic), rescuer, executor, "http://example.com");

        vm.startPrank(executor);
        // relic setup
        {
            relic.setRelicMinter(operator, true);
            relic.setXPController(operator, true);
            relic.setShard(address(shard));
            changePrank(operator);
            relic.mintRelic(bob, Relic.Enclave.Logic);
            relic.mintRelic(bob, Relic.Enclave.Mystery);
        }
        // shard setup
        {
            changePrank(executor);
            shard.setTemplarMinter(operator, true);
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
    }

    function _setRecipe1() internal {
        Shard.Recipe memory recipe = _getRecipe1();
        vm.startPrank(executor);
        shard.setRecipe(RECIPE_1_ID, recipe);
    }

    function _getRecipe1() internal returns (Shard.Recipe memory recipe) {
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

    function _getInvalidRecipe() internal returns (Shard.Recipe memory recipe) {
        uint256[] memory inputShardIds = new uint256[](1);
        recipe.inputShardIds = inputShardIds;
    }
}


contract ShardTestAccess is ShardTestBase {

    function test_access_setPartnerAllowedShardIdFail(address caller) public {
        vm.assume(caller != executor && caller != rescuer);
        vm.startPrank(caller);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        shard.setPartnerAllowedShardId(alice, SHARD_1_ID, true);
    }

    function test_access_setTemplarMinterFail(address caller) public {
        vm.assume(caller != executor && caller != rescuer);
        vm.startPrank(caller);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        shard.setTemplarMinter(alice, false);
    }

    function test_access_setPartnerAllowedShardIdsFail(address caller) public {
        bool[] memory flags = new bool[](2);
        uint256[] memory shardIds = new uint256[](2);
        flags[0] = flags[1] = true;
        shardIds[0] = SHARD_1_ID;
        shardIds[1] = SHARD_2_ID;
        vm.assume(caller != executor && caller != rescuer);
        vm.startPrank(caller);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        shard.setPartnerAllowedShardIds(alice, shardIds, flags);
    }
    
    function test_access_setPartnerAllowedShardCapsFail(address caller) public {
        uint256[] memory caps = new uint256[](2);
        uint256[] memory shardIds = new uint256[](2);
        caps[0] = caps[1] = 9999;
        shardIds[0] = SHARD_1_ID;
        shardIds[1] = SHARD_2_ID;
        vm.assume(caller != executor && caller != rescuer);
        vm.startPrank(caller);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        shard.setPartnerAllowedShardCaps(alice, shardIds, caps);
    }

    function test_access_setRecipeFail(address caller) public {
        Shard.Recipe memory recipe = _getRecipe1();
        vm.assume(caller != executor && caller != rescuer);
        vm.startPrank(caller);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        shard.setRecipe(RECIPE_1_ID, recipe);
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

    function test_access_setPartnerAllowedShardIdSuccess() public {
        vm.startPrank(executor);
        vm.expectEmit(address(shard));
        emit PartnerAllowedShardIdSet(alice, SHARD_1_ID, true);
        shard.setPartnerAllowedShardId(alice, SHARD_1_ID, true);
        uint256[] memory shardIds = shard.getPartnerAllowedShardIds(alice);
        // assertEq(shardIds[0], SHARD_1_ID);
    }

    function test_access_setTemplarMinterSuccess() public {
        vm.startPrank(executor);
        // vm.expectEmit(address(shard));
        // emit TemplarMinterSet(alice, true);
        shard.setTemplarMinter(alice, true);
        // assertEq(shard.templarMinters(alice), true);
    }

    function test_access_setPartnerAllowedShardIdsSuccess() public {
        bool[] memory flags = new bool[](2);
        uint256[] memory shardIds = new uint256[](2);
        flags[0] = flags[1] = true;
        shardIds[0] = SHARD_1_ID;
        shardIds[1] = SHARD_2_ID;
        
        vm.startPrank(executor);
        // vm.expectEmit(address(shard));
        // emit PartnerAllowedShardIdsSet(alice, shardIds, flags);
        shard.setPartnerAllowedShardIds(alice, shardIds, flags);
    }

    function test_access_setPartnerAllowedShardCapsSuccess() public {
        uint256[] memory caps = new uint256[](2);
        uint256[] memory shardIds = new uint256[](2);
        caps[0] = caps[1] = 9999;
        shardIds[0] = SHARD_1_ID;
        shardIds[1] = SHARD_2_ID;
        vm.startPrank(executor);
        shard.setPartnerAllowedShardCaps(alice, shardIds, caps);
    }

    function test_access_setRecipeSuccess() public {
        Shard.Recipe memory recipe = _getRecipe1();
        vm.startPrank(executor);
        shard.setRecipe(RECIPE_1_ID, recipe);
    }

     function test_access_deleteRecipeSuccess() public {
        Shard.Recipe memory recipe = _getRecipe1();
        vm.startPrank(executor);
        shard.setRecipe(RECIPE_1_ID, recipe);
        shard.deleteRecipe(RECIPE_1_ID);
    }

    function test_access_setShardUriSuccess() public {
        vm.startPrank(executor);
        shard.setShardUri(SHARD_1_ID, SHARD_1_URI);
    }
}

contract ShardTest is ShardTestAccess {

    function test_setTemplarMinter() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(Shard.ZeroAddress.selector));
        shard.setTemplarMinter(address(0), true);
        vm.expectEmit(address(shard));
        emit TemplarMinterSet(alice, true);
        shard.setTemplarMinter(alice, true);
        assertEq(shard.templarMinters(alice), true);
        // reset
        vm.expectEmit(address(shard));
        emit TemplarMinterSet(alice, false);
        shard.setTemplarMinter(alice, false);
        assertEq(shard.templarMinters(alice), false);
    }

    function test_setPartnerAllowedShardId() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(Shard.ZeroAddress.selector));
        shard.setPartnerAllowedShardId(address(0), SHARD_1_ID, true);
        // try to remove id not existing
        vm.expectRevert(abi.encodeWithSelector(Shard.PartnerAllowShardFailed.selector, alice, SHARD_1_ID, false));
        shard.setPartnerAllowedShardId(alice, SHARD_1_ID, false);
        // add and test adding twice
        vm.expectEmit(address(shard));
        emit PartnerAllowedShardIdSet(alice, SHARD_1_ID, true);
        shard.setPartnerAllowedShardId(alice, SHARD_1_ID, true);
        assertEq(shard.isPartnerShard(SHARD_1_ID), true);
        vm.expectRevert(abi.encodeWithSelector(Shard.PartnerAllowShardFailed.selector, alice, SHARD_1_ID, true));
        shard.setPartnerAllowedShardId(alice, SHARD_1_ID, true);

        vm.expectEmit(address(shard));
        emit PartnerAllowedShardIdSet(alice, SHARD_1_ID, false);
        shard.setPartnerAllowedShardId(alice, SHARD_1_ID, false);
        assertEq(shard.isPartnerShard(SHARD_1_ID), false);
    }

    function test_setPartnerAllowedShardIds() public {
        bool[] memory flags = new bool[](2);
        uint256[] memory shardIds = new uint256[](2);
        flags[0] = flags[1] = true;
        shardIds[0] = SHARD_1_ID;
        shardIds[1] = SHARD_2_ID;

        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(Shard.ZeroAddress.selector));
        shard.setPartnerAllowedShardIds(address(0), shardIds, flags);

        shardIds = new uint256[](3);
        shardIds[0] = SHARD_1_ID;
        shardIds[1] = SHARD_2_ID;
        shardIds[2] = SHARD_3_ID;
        vm.expectRevert(abi.encodeWithSelector(Shard.InvalidParamLength.selector));
        shard.setPartnerAllowedShardIds(alice, shardIds, flags);

        shardIds = new uint256[](2);
        shardIds[0] = SHARD_1_ID;
        shardIds[1] = SHARD_2_ID;

        vm.expectEmit(address(shard));
        emit PartnerAllowedShardIdsSet(alice, shardIds, flags);
        shard.setPartnerAllowedShardIds(alice, shardIds, flags);
        assertEq(shard.isPartnerShard(SHARD_1_ID), true);
        assertEq(shard.isPartnerShard(SHARD_2_ID), true);

        flags[1] = false;
        shard.setPartnerAllowedShardIds(alice, shardIds, flags);
        assertEq(shard.isPartnerShard(SHARD_2_ID), false);
    }

    function test_setPartnerAllowedShardCaps() public {
        uint256[] memory caps = new uint256[](2);
        uint256[] memory shardIds = new uint256[](2);
        caps[0] = 9999;
        caps[1] = 7777;
        shardIds[0] = SHARD_1_ID;
        shardIds[1] = SHARD_2_ID;

        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(Shard.ZeroAddress.selector));
        shard.setPartnerAllowedShardCaps(address(0), shardIds, caps);

        shardIds = new uint256[](3);
        shardIds[0] = SHARD_1_ID;
        shardIds[1] = SHARD_2_ID;
        shardIds[2] = SHARD_3_ID;
        vm.expectRevert(abi.encodeWithSelector(Shard.InvalidParamLength.selector));
        shard.setPartnerAllowedShardCaps(alice, shardIds, caps);

        shardIds = new uint256[](2);
        shardIds[0] = SHARD_1_ID;
        shardIds[1] = SHARD_2_ID;
        vm.expectEmit(address(shard));
        emit PartnerAllowedShardCapsSet(alice, shardIds, caps);
        shard.setPartnerAllowedShardCaps(alice, shardIds, caps);
        assertEq(shard.allowedPartnersShardCaps(alice, shardIds[0]), caps[0]);
        assertEq(shard.allowedPartnersShardCaps(alice, shardIds[1]), caps[1]);
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
        shard.setRecipe(recipeId, recipe);
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
        shard.setRecipe(recipeId, recipe);

        outputShardAmounts = new uint256[](1);
        outputShardAmounts[0] = 1;
        recipe.outputShardAmounts = outputShardAmounts;
        vm.expectEmit(address(shard));
        emit RecipeSet(recipeId, recipe);
        shard.setRecipe(recipeId, recipe);
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
        shard.setRecipe(recipeId, recipe);
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

        
    }
}