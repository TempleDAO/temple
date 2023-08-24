pragma solidity 0.8.18;

// SPDX-License-Identifier: AGPL-3.0-or-later

import { TempleTest } from "../TempleTest.sol";
import { Relic } from "../../../contracts/nexus/Relic.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import "forge-std/console.sol";


contract RelicTestBase is TempleTest {
    Relic public relic;

    string private constant name = "RELIC";
    string private constant symbol = "REL";

    uint256 internal constant RARITIES_COUNT = 0x05;
    uint256 internal constant ENCLAVES_COUNT = 0x05;
    address internal constant ZERO_ADDRESS = 0x0000000000000000000000000000000000000000;
    uint256 internal constant PER_MINT_QUANTITY = 0x01;
    bytes internal constant ZERO_BYTES = "";

    Relic.Rarity public commRarity = Relic.Rarity.Common;
    Relic.Rarity public uncommonRarity = Relic.Rarity.Uncommon;
    Rarity public invalidRarity = Rarity.InvalidRarity;

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

    struct RelicInfo {
        Enclave enclave;
        Rarity rarity;
        uint128 xp;
    }

    event RarityXPThresholdSet(Relic.Rarity rarity, uint256 threshold);
    event RarityBaseUriSet(Relic.Rarity rarity, string uri);
    event RelicMinterSet(address minter, bool allow);
    event ShardSet(address shard);
    event RelicMinted(address msgSender, uint256 nextTokenId, uint256 quantity);
    event XPControllerSet(address controller, bool flag);
    event RelicXPSet(uint256 relicId, uint256 oldXp, uint256 xp);
    event ShardEquipped(address caller, uint256 relicId, uint256 shardId, uint256 amount);
    event ShardsEquipped(address caller, uint256 relicId, uint256[] shardIds, uint256[] amounts);
    event ShardUnequipped(address caller, uint256 relicId, uint256 shardId, uint256 amount);
    event ShardsUnequipped(address recipient, uint256 relicId, uint256[] shardIds, uint256[] amounts);
    event AccountBlacklistSet(address account, bool blacklist, uint256[] shardIds, uint256[] amounts);

    function setUp() public {
        relic = new Relic(name, symbol, rescuer, executor);
        vm.startPrank(executor);
        relic.setRelicMinter(operator, true);
        relic.setXPController(operator, true);
        changePrank(operator);
        relic.mintRelic(bob, Relic.Enclave.Logic);
        relic.mintRelic(bob, Relic.Enclave.Mystery);
        vm.stopPrank();
    }

    function test_initialization() public {
        assertEq(relic.name(), name);
        assertEq(relic.symbol(), symbol);
        assertEq(relic.rescuer(), rescuer);
        assertEq(relic.executor(), executor);
    }
}

contract RelicTestAccess is RelicTestBase {

    // address internal constant relicAddress = address(relic);
    function test_access_setShardFail(address caller) public {
        /// use fuzzing
        vm.assume(caller != executor && caller != rescuer);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        vm.startPrank(caller);
        relic.setShard(alice);
    }

    function test_access_setShardSuccess() public {
        // vm.expectEmit(address(relic));
        // emit ShardSet(alice);
        vm.startPrank(executor);
        relic.setShard(alice);
        // assertEq(address(relic.shard()), alice);
    }

    function test_access_setXPRarityThresholdFail(address caller) public {
        vm.assume(caller != executor && caller != rescuer);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        Relic.Rarity rarity = commRarity;
        vm.startPrank(caller);
        relic.setXPRarityThreshold(rarity, 100);
    }

    function test_access_setXPRarityThresholdSuccess() public {
        vm.startPrank(executor);
        Relic.Rarity rarity = commRarity;
        relic.setXPRarityThreshold(rarity, 100);
    }

    function test_access_setRelicMinterFail(address caller) public {
        vm.assume(caller != executor && caller != rescuer);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        vm.startPrank(caller);
        relic.setRelicMinter(alice, true);
    }

    function test_access_setRelicMinterSuccess() public {
        vm.startPrank(executor);
        relic.setRelicMinter(alice, true);
    }

    function test_access_setXPControllerFail(address caller) public {
        vm.assume(caller != executor && caller != rescuer);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        vm.startPrank(caller);
        relic.setXPController(alice, true);
    }

    function test_access_setXPControllerSuccess() public {
        vm.startPrank(executor);
        relic.setXPController(alice, true);
    }

    function test_access_setXPRarityThresholdsFail(address caller) public {
        vm.assume(caller != executor && caller != rescuer);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        Relic.Rarity[] memory rarities = new Relic.Rarity[](1);
        rarities[0] = commRarity;
        uint256[] memory thresholds = new uint256[](1);
        thresholds[0] = 100;
        vm.startPrank(caller);
        relic.setXPRarityThresholds(rarities, thresholds);
    }

    function test_access_setXPRarityThresholdsSuccess() public {
        Relic.Rarity[] memory rarities = new Relic.Rarity[](1);
        rarities[0] = commRarity;
        uint256[] memory thresholds = new uint256[](1);
        thresholds[0] = 100;
        vm.startPrank(executor);
        relic.setXPRarityThresholds(rarities, thresholds);
    }

    function test_access_setBaseUriRarityFail(address caller) public {
        vm.assume(caller != executor && caller != rescuer);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        vm.startPrank(caller);
        relic.setBaseUriRarity(commRarity, "some string");
    }

    function test_access_setBaseUriRaritySuccess() public {
        vm.startPrank(executor);
        relic.setBaseUriRarity(commRarity, "some string");
    }

    function test_access_setBlacklistAccuntFail(address caller) public {
        vm.assume(caller != executor && caller != rescuer);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        uint256[] memory ids = new uint256[](1);
        uint256[] memory amounts = new uint256[](1);
        ids[0] = amounts[0] = 1;
        vm.startPrank(caller);
        relic.setBlacklistAccount(alice, false, ids, amounts);
    }

    function test_access_setBlacklistAccuntSuccess() public {
        uint256[] memory ids = new uint256[](1);
        uint256[] memory amounts = new uint256[](1);
        ids[0] = amounts[0] = 1;
        vm.startPrank(executor);
        relic.setBlacklistAccount(alice, false, ids, amounts);
    }

    function test_access_setRelicXPFail(address caller) public {
        vm.assume(caller != executor && caller != rescuer);
        vm.startPrank(caller);
        vm.expectRevert(abi.encodeWithSelector(Relic.InvalidAccess.selector, caller));
        relic.setRelicXP(1, 100);
    }

     function test_access_setRelicXPSuccess() public {
        vm.startPrank(executor);
        relic.setXPController(address(this), true);
        vm.stopPrank();
        vm.expectRevert(abi.encodeWithSelector(Relic.InvalidRelic.selector, 1));
        relic.setRelicXP(1, 100);
    }
}

contract RelicSettersTest is RelicTestAccess {
    
    function test_setShard() public {
        address relicAddress = address(relic);
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(Relic.InvalidAddress.selector, ZERO_ADDRESS));
        relic.setShard(ZERO_ADDRESS);
        vm.expectEmit(relicAddress);
        emit ShardSet(alice);
        relic.setShard(alice);
        assertEq(address(relic.shard()), alice);
        // todo setUp() for other contracts and addresses
    }

    function test_setXPRarityThreshold() public {
        address relicAddress = address(relic);
        uint256 threshold = 100;
        vm.startPrank(executor);
        // not allowed rarity
        // vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        // relic.setXPRarityThreshold(invalidRarity, threshold);
        vm.expectEmit(relicAddress);
        emit RarityXPThresholdSet(commRarity, threshold);
        relic.setXPRarityThreshold(commRarity, threshold);
        uint256 _threshold = relic.rarityXPThresholds(commRarity);
        console.logString("THRESHOLD");
        console.logUint(_threshold);
        assertEq(_threshold, threshold);
    }

    function test_setRelicMinter() public {
        address relicAddress = address(relic);
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(Relic.ZeroAddress.selector));
        relic.setRelicMinter(ZERO_ADDRESS, true);

        vm.expectEmit(relicAddress);
        emit RelicMinterSet(alice, true);
        relic.setRelicMinter(alice, true);
        assertEq(relic.relicMinters(alice), true);
    }

    function test_setXPController() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(Relic.ZeroAddress.selector));
        relic.setXPController(ZERO_ADDRESS, true);

        vm.expectEmit(address(relic));
        emit XPControllerSet(alice, true);
        relic.setXPController(alice, true);
        assertEq(relic.xpControllers(alice), true);
    }

    function test_setXPRarityThresholds() public {
        vm.startPrank(executor);
        Relic.Rarity[] memory rarities = new Relic.Rarity[](2);
        uint256[] memory thresholds = new uint256[](3);
        rarities[0] = commRarity;
        rarities[1] = uncommonRarity;
        thresholds[0] = 10;
        thresholds[1] = 100;
        thresholds[2] = 120;
        vm.expectRevert(abi.encodeWithSelector(Relic.InvalidParamLength.selector));
        relic.setXPRarityThresholds(rarities, thresholds);
        thresholds = new uint256[](2);
        thresholds[0] = 10;
        thresholds[1] = 100;
        // rarities[1] = invalidRarity;
        // vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        // relic.setXPRarityThresholds(rarities, thresholds);
        vm.expectEmit(address(relic));
        emit RarityXPThresholdSet(rarities[0], thresholds[0]);
        emit RarityXPThresholdSet(rarities[1], thresholds[1]);
        relic.setXPRarityThresholds(rarities, thresholds);
        assertEq(relic.rarityXPThresholds(rarities[0]), thresholds[0]);
        assertEq(relic.rarityXPThresholds(rarities[1]), thresholds[1]);
    }

    function test_setBaseUriRarity() public {
        string memory uri = "http://example.com";
        vm.startPrank(executor);
        vm.expectEmit(address(relic));
        emit RarityBaseUriSet(commRarity, uri);
        relic.setBaseUriRarity(commRarity, uri);
        assertEq(relic.getRarityBaseUri(commRarity), uri);
    }

    function test_setBlacklistAccount() public {
        uint256[] memory shardIds = new uint256[](2);
        uint256[] memory amounts = new uint256[](2);
        shardIds[0] = 123;
        shardIds[1] = 456;
        amounts[0] = 10;
        amounts[1] = 20;
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(Relic.ZeroAddress.selector));
        relic.setBlacklistAccount(ZERO_ADDRESS, true, shardIds, amounts);

        amounts = new uint256[](3);
        amounts[0] = 10;
        amounts[1] = 20;
        amounts[2] = 30;
        vm.expectRevert(abi.encodeWithSelector(Relic.InvalidParamLength.selector));
        relic.setBlacklistAccount(alice, true, shardIds, amounts);

        amounts = new uint256[](2);
        amounts[0] = 10;
        amounts[1] = 20;
        vm.expectEmit(address(relic));
        emit AccountBlacklistSet(alice, true, shardIds, amounts);
        relic.setBlacklistAccount(alice, true, shardIds, amounts);

        assertEq(relic.blacklistedAccounts(alice), true);
        assertEq(relic.blacklistedAccountShards(alice, shardIds[0]), amounts[0]);
        assertEq(relic.blacklistedAccountShards(alice, shardIds[1]), amounts[1]);

        // now set blacklist to false, reducing amounts but not all
        amounts[0] = 5;
        amounts[1] = 10;
        vm.expectEmit(address(relic));
        emit AccountBlacklistSet(alice, false, shardIds, amounts);
        relic.setBlacklistAccount(alice, false, shardIds, amounts);
        assertEq(relic.blacklistedAccounts(alice), true);
        assertEq(relic.blacklistedAccountShards(alice, shardIds[0]), 5);
        assertEq(relic.blacklistedAccountShards(alice, shardIds[1]), 10);
        // now reduce all amounts to 0
        relic.setBlacklistAccount(alice, false, shardIds, amounts);
        assertEq(relic.blacklistedAccounts(alice), false);
        assertEq(relic.blacklistedAccountShards(alice, shardIds[0]), 0);
        assertEq(relic.blacklistedAccountShards(alice, shardIds[1]), 0);
    }

    function test_setRelicXP() public {
        uint256[] memory relicIds = relic.relicsOfOwner(bob);
        uint256 invalidRelicId = 999;
        uint256 xp = 100;
        vm.startPrank(operator);
        vm.expectRevert(abi.encodeWithSelector(Relic.InvalidRelic.selector, invalidRelicId));
        relic.setRelicXP(invalidRelicId, xp);

        uint256 relicId = relicIds[0];
        // Relic.RelicInfo storage relicInfo = relic.relicInfos(relicId);
        // uint256 oldXp = relicInfo.xp;
        (,,uint256 oldXp) = relic.relicInfos(relicId);
        vm.expectEmit(address(relic));
        emit RelicXPSet(relicId, oldXp, xp);
        relic.setRelicXP(relicId, xp);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        relic.setRelicXP(relicId, xp-1);
         (,,uint256 newXp) = relic.relicInfos(relicId);
        assertEq(newXp, xp);
    }
}







