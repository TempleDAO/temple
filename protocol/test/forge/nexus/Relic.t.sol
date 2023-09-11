pragma solidity 0.8.18;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TempleTest } from "../TempleTest.sol";
import { Relic } from "../../../contracts/nexus/Relic.sol";
import { Shard } from "../../../contracts/nexus/Shard.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { IERC1155Receiver } from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "forge-std/console.sol";


contract RelicTestBase is TempleTest {
    Relic public relic;
    Shard public shard;

    FakeERC20 public temple = new FakeERC20("TEMPLE", "TEMPLE", address(0), 0);
    FakeERC20 public dai = new FakeERC20("DAI", "DAI", address(0), 0);

    string private constant name = "RELIC";
    string private constant symbol = "REL";

    uint256 internal constant RARITIES_COUNT = 0x05;
    uint256 internal constant ENCLAVES_COUNT = 0x05;
    address internal constant ZERO_ADDRESS = 0x0000000000000000000000000000000000000000;
    uint256 internal constant PER_MINT_QUANTITY = 0x01;
    bytes internal constant ZERO_BYTES = "";

    uint256 internal SHARD_1_ID = 0x7B;  // 123
    uint256 internal SHARD_2_ID = 0x1C8; // 456
    uint256 internal RELIC_1_ID = 0x01;

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
        shard = new Shard(address(relic), rescuer, executor, "http://example.com");
        vm.startPrank(executor);
        relic.setRelicMinter(operator, true);
        relic.setXPController(operator, true);
        relic.setShard(address(shard));
        changePrank(operator);
        relic.mintRelic(bob, Relic.Enclave.Logic);
        relic.mintRelic(bob, Relic.Enclave.Mystery);
        // mint some shards to bob
        changePrank(executor);
        shard.setTemplarMinter(operator, true);
        changePrank(operator);
        shard.mint(bob, SHARD_1_ID, 5);
        shard.mint(bob, SHARD_2_ID, 10);
        
        vm.stopPrank();
    }

    function test_initialization() public {
        assertEq(relic.name(), name);
        assertEq(relic.symbol(), symbol);
        assertEq(relic.rescuer(), rescuer);
        assertEq(relic.executor(), executor);
    }

    function _mintRelicNew(address to, Relic.Enclave enclave) internal returns (uint256) {
        changePrank(operator);
        uint256 nextId = relic.getNextTokenId();
        relic.mintRelic(to, enclave);
        return nextId;
    }

    function _equipShards(
        uint256 relicId,
        address account,
        uint256[] memory shardIds,
        uint256[] memory amounts
    ) internal {
        changePrank(operator);
        shard.mintBatch(account, shardIds, amounts);
        changePrank(account);
        shard.setApprovalForAll(address(relic), true);
        relic.batchEquipShards(relicId, shardIds, amounts);   
    }

    function _blacklistAccount(
        bool blacklist,
        bool newRelic,
        uint256 relicId,
        address account,
        uint256[] memory shardIds,
        uint256[] memory amounts
    ) internal returns (uint256) {
        changePrank(operator);
        if (newRelic) {
            relicId = _mintRelicNew(account, Relic.Enclave.Chaos);
        }
        // equip shards first
        if (shardIds.length > 0) {
            _equipShards(relicId, account, shardIds, amounts);
        }
        changePrank(executor);
        relic.setBlacklistAccount(account, blacklist, relicId, shardIds, amounts);
        return relicId;
    }

    function _emptyUintArray(uint256 size) internal returns (uint256[] memory arr) {
        arr = new uint256[](size);
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
        relic.setBlacklistAccount(alice, true, RELIC_1_ID, ids, amounts);
        // _blacklistAccount(true, true, 0, alice, ids, amounts);
    }

    function test_access_setBlacklistAccuntSuccess() public {
        uint256[] memory ids = new uint256[](1);
        uint256[] memory amounts = new uint256[](1);
        ids[0] = amounts[0] = 1;
        vm.startPrank(executor);
        _blacklistAccount(false, true, 0, alice, _emptyUintArray(0), _emptyUintArray(0));
    }

    function test_access_setRelicXPFail(address caller) public {
        vm.assume(caller != executor && caller != rescuer && caller != operator);
        vm.startPrank(caller);
        vm.expectRevert(abi.encodeWithSelector(Relic.InvalidAccess.selector, caller));
        relic.setRelicXP(1, 100);
    }

     function test_access_setRelicXPSuccess() public {
        vm.startPrank(executor);
        relic.setXPController(address(this), true);
        vm.stopPrank();
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
        relic.setBlacklistAccount(ZERO_ADDRESS, true, RELIC_1_ID, shardIds, amounts);

        amounts = new uint256[](3);
        amounts[0] = 10;
        amounts[1] = 20;
        amounts[2] = 30;
        vm.expectRevert(abi.encodeWithSelector(Relic.InvalidParamLength.selector));
        relic.setBlacklistAccount(alice, true, RELIC_1_ID, shardIds, amounts);

        amounts = new uint256[](2);
        amounts[0] = 10;
        amounts[1] = 20;
        vm.expectRevert(abi.encodeWithSelector(Relic.NotEnoughShardBalance.selector, 0, 10));
        relic.setBlacklistAccount(alice, true, RELIC_1_ID, shardIds, amounts);

        // mint new relic and shards. then equip
        // _blacklistAccount(true, true, 0, alice, shardIds, amounts);
        uint256 relicId = _mintRelicNew(alice, Relic.Enclave.Mystery);
        _equipShards(relicId, alice, shardIds, amounts);

        changePrank(executor);
        vm.expectEmit(address(relic));
        emit AccountBlacklistSet(alice, true, shardIds, amounts);
        relic.setBlacklistAccount(alice, true, relicId, shardIds, amounts);

        assertEq(relic.blacklistedAccounts(alice), true);
        assertEq(relic.blacklistedAccountShards(alice, shardIds[0]), amounts[0]);
        assertEq(relic.blacklistedAccountShards(alice, shardIds[1]), amounts[1]);

        // now set blacklist to false, reducing amounts but not all
        amounts[0] = 5;
        amounts[1] = 10;
        vm.expectEmit(address(relic));
        emit AccountBlacklistSet(alice, false, shardIds, amounts);
        relic.setBlacklistAccount(alice, false, relicId, shardIds, amounts);
        assertEq(relic.blacklistedAccounts(alice), true);
        assertEq(relic.blacklistedAccountShards(alice, shardIds[0]), 5);
        assertEq(relic.blacklistedAccountShards(alice, shardIds[1]), 10);
        // now reduce all amounts to 0
        relic.setBlacklistAccount(alice, false, relicId, shardIds, amounts);
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

contract RelicTest is RelicSettersTest {

    event ApprovalForAll(address caller, address operator, bool approved);

    function test_mintRelic() public {
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(Relic.CallerCannotMint.selector, alice));
        relic.mintRelic(bob, Relic.Enclave.Mystery);

        // blacklist account 
        uint256[] memory shardIds = new uint256[](2);
        uint256[] memory amounts = new uint256[](2);
        shardIds[0] = 123;
        shardIds[1] = 456;
        amounts[0] = 10;
        amounts[1] = 20;
        changePrank(executor);
        // relic.setBlacklistAccount(alice, true, RELIC_1_ID, shardIds, amounts);
        uint256 relicId = _blacklistAccount(true, true, 0, alice, shardIds, amounts);

        // zero address test
        changePrank(operator);
        vm.expectRevert(abi.encodeWithSelector(Relic.ZeroAddress.selector));
        relic.mintRelic(ZERO_ADDRESS, Relic.Enclave.Structure);

        vm.expectRevert(abi.encodeWithSelector(Relic.AccountBlacklisted.selector, alice));
        relic.mintRelic(alice, Relic.Enclave.Chaos);
        // reset blacklist
        changePrank(executor);
        // relic.setBlacklistAccount(alice, false, RELIC_1_ID, shardIds, amounts);
        _blacklistAccount(false, false, relicId, alice, _emptyUintArray(0), _emptyUintArray(0));

        changePrank(operator);
        uint256[] memory relicsBefore = relic.relicsOfOwner(alice);
        uint256 nextTokenId = relic.totalMinted();
        vm.expectEmit(address(relic));
        emit RelicMinted(alice, nextTokenId, 1);
        relic.mintRelic(alice, Relic.Enclave.Chaos);

        uint256[] memory relicsAfter = relic.relicsOfOwner(alice);
        (Relic.Enclave enclave, Relic.Rarity rarity, uint256 xp) = relic.relicInfos(relicsAfter[0]);
        assertEq(relic.balanceOf(alice), 2);
        assertEq(relic.ownerOf(relicsAfter[0]), alice);
        assertEq(relicsAfter.length, relicsBefore.length + 1);
        assertEq(relicsAfter[0], nextTokenId-1);
        assertEq(relicsAfter[1], nextTokenId);
        assertEq(relic.totalMinted(), nextTokenId + 1);
        assertEq(uint(enclave), uint(Relic.Enclave.Chaos));
        assertEq(uint(rarity), uint(Relic.Rarity.Common));
        assertEq(xp, 0);
    }

    function test_shardApproval() public {
        // todo
        uint256[] memory shardIds = new uint256[](2);
        uint256[] memory amounts = new uint256[](2);
        shardIds[0] = SHARD_1_ID;
        shardIds[1] = SHARD_2_ID;
        amounts[0] = amounts[1] = 1;
        vm.startPrank(operator);
        shard.mintBatch(alice, shardIds, amounts);
        uint256 relicId = _mintRelicNew(alice, Relic.Enclave.Mystery);
        changePrank(alice);
        vm.expectRevert("ERC1155: caller is not token owner or approved");
        relic.batchEquipShards(relicId, shardIds, amounts);

        shard.setApprovalForAll(address(relic), true);
        relic.batchEquipShards(relicId, shardIds, amounts);
        // {
        //     relicId = _mintRelicNew(alice, Relic.Enclave.Mystery);
        //     _equipShards(relicId, alice, shardIds, amounts);
        // }
        {
            // transfer amount exceeds allowance
            // vm.expectRevert("ERC1155: caller is not token owner or approved");
            // relic.equipShard(RELIC_1_ID, SHARD_1_ID, 5);
        }
    }

    function test_equipShard() public {
        uint256[] memory relicIds = relic.relicsOfOwner(bob);
        uint256 relicId = relicIds[relicIds.length-1];
        uint256 shard1BalanceBefore = shard.balanceOf(bob, SHARD_1_ID);

        {
            vm.startPrank(alice);
            vm.expectRevert(abi.encodeWithSelector(Relic.InvalidAccess.selector, alice));
            relic.equipShard(relicId, SHARD_1_ID, 2);
        }

        // test blacklist
        {
            uint256[] memory shardIds = new uint256[](2);
            uint256[] memory amounts = new uint256[](2);
            shardIds[0] = SHARD_1_ID;
            shardIds[1] = SHARD_2_ID;
            amounts[0] = 5;
            amounts[1] = 5;
            changePrank(executor);
            _blacklistAccount(true, false, RELIC_1_ID, bob, shardIds, amounts);
            // relic.setBlacklistAccount(bob, true, RELIC_1_ID, shardIds, amounts);
            changePrank(bob);
            vm.expectRevert(abi.encodeWithSelector(Relic.AccountBlacklisted.selector, bob));
            relic.equipShard(RELIC_1_ID, SHARD_1_ID, 2);
            // reset blacklist
            changePrank(executor);
            _blacklistAccount(false, false, RELIC_1_ID, bob, _emptyUintArray(0), _emptyUintArray(0));
            // relic.setBlacklistAccount(bob, false, RELIC_1_ID, shardIds, amounts);
            assertEq(relic.blacklistedAccounts(bob), false);
        }
        
        //
        changePrank(bob);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        relic.equipShard(relicId, SHARD_1_ID, 0);

        uint256 equippedShardId1AmountBefore = relic.getEquippedShardAmount(relicId, SHARD_1_ID);
        {
            shard.setApprovalForAll(address(relic), true);
            vm.expectEmit(address(relic));
            emit ShardEquipped(bob, relicId, SHARD_1_ID, 5);
            relic.equipShard(relicId, SHARD_1_ID, 5);
        }
        
        uint256 equippedShardId1AmountAfter = relic.getEquippedShardAmount(relicId, SHARD_1_ID);
        assertEq(equippedShardId1AmountAfter, equippedShardId1AmountBefore + 5);
        assertEq(shard.balanceOf(bob, SHARD_1_ID), shard1BalanceBefore - 5);
    } 

    function test_batchEquipShards() public {
        uint256[] memory relicIds = relic.relicsOfOwner(bob);
        uint256 relicId = relicIds[relicIds.length-1];
        uint256[] memory shardIds = new uint256[](2);
        uint256[] memory amounts = new uint256[](2);
        uint256 shard1BalanceBefore = shard.balanceOf(bob, SHARD_1_ID);
        uint256 shard2BalanceBefore = shard.balanceOf(bob, SHARD_2_ID);
        amounts[0] = amounts[1] = 5;

        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(Relic.InvalidAccess.selector, alice));
        relic.batchEquipShards(relicId, shardIds, amounts);

        // test blacklist
        shardIds[0] = SHARD_1_ID;
        shardIds[1] = SHARD_2_ID;
        changePrank(executor);
        _blacklistAccount(true, false, RELIC_1_ID, bob, shardIds, amounts);
        // relic.setBlacklistAccount(bob, true, RELIC_1_ID, shardIds, amounts);
        changePrank(bob);
        vm.expectRevert(abi.encodeWithSelector(Relic.AccountBlacklisted.selector, bob));
        relic.batchEquipShards(relicId, shardIds, amounts);
        // reset blacklist
        changePrank(executor);
        _blacklistAccount(false, false, RELIC_1_ID, bob, _emptyUintArray(0), _emptyUintArray(0));
        // relic.setBlacklistAccount(bob, false, RELIC_1_ID, shardIds, amounts);
        assertEq(relic.blacklistedAccounts(bob), false);

        // invalid param length
        changePrank(bob);
        amounts = new uint256[](3);
        amounts[0] = amounts[1] = amounts[2] = 5;
        vm.expectRevert(abi.encodeWithSelector(Relic.InvalidParamLength.selector));
        relic.batchEquipShards(relicId, shardIds, amounts);

        amounts = new uint256[](2);
        amounts[0] = amounts[1] = 5;
        shard.setApprovalForAll(address(relic), true);
        relic.batchEquipShards(relicId, shardIds, amounts);

        assertEq(shard.balanceOf(bob, SHARD_1_ID), shard1BalanceBefore-amounts[0]);
        assertEq(shard.balanceOf(bob, SHARD_2_ID), shard2BalanceBefore-amounts[1]);
    }

    function test_unequipShard() public {
        uint256[] memory relicIds = relic.relicsOfOwner(bob);
        uint256 relicId = relicIds[relicIds.length-1];
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(Relic.InvalidAccess.selector, alice));
        relic.unequipShard(relicId, SHARD_1_ID, 2);

        // test blacklist
        uint256[] memory shardIds = new uint256[](2);
        uint256[] memory amounts = new uint256[](2);
        shardIds[0] = SHARD_1_ID;
        shardIds[1] = SHARD_2_ID;
        amounts[0] = 5;
        amounts[1] = 5;
        changePrank(executor);
        _blacklistAccount(true, false, RELIC_1_ID, bob, shardIds, amounts);
        // relic.setBlacklistAccount(bob, true, RELIC_1_ID, shardIds, amounts);
        changePrank(bob);
        vm.expectRevert(abi.encodeWithSelector(Relic.AccountBlacklisted.selector, bob));
        relic.equipShard(relicId, SHARD_1_ID, 2);
        // reset blacklist
        changePrank(executor);
        // _blacklistAccount(false, false, RELIC_1_ID, bob, shardIds, amounts);
        relic.setBlacklistAccount(bob, false, RELIC_1_ID, shardIds, amounts);
        assertEq(relic.blacklistedAccounts(bob), false);
        //
        changePrank(bob);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        relic.unequipShard(relicId, SHARD_1_ID, 0);
        uint256 equippedAmount = relic.getEquippedShardAmount(relicId, SHARD_1_ID);
        uint256 invalidAmount = equippedAmount + 1;
        vm.expectRevert(abi.encodeWithSelector(Relic.InsufficientShardBalance.selector, equippedAmount, invalidAmount));
        relic.unequipShard(relicId, SHARD_1_ID, invalidAmount);

        shard.setApprovalForAll(address(relic), true);
        {
            relic.equipShard(relicId, SHARD_1_ID, 5);
        }
        equippedAmount = relic.getEquippedShardAmount(relicId, SHARD_1_ID);
        assertEq(shard.balanceOf(bob, SHARD_1_ID), 0);
        vm.expectEmit(address(relic));
        emit ShardUnequipped(bob, relicId, SHARD_1_ID, equippedAmount);
        relic.unequipShard(relicId, SHARD_1_ID, equippedAmount);

        assertEq(relic.getEquippedShardAmount(relicId, SHARD_1_ID), 0);
        assertEq(shard.balanceOf(bob, SHARD_1_ID), equippedAmount);
    }

    function test_batchUnequipShards() public {
        uint256[] memory relicIds = relic.relicsOfOwner(bob);
        uint256 relicId = relicIds[relicIds.length-1];
        uint256[] memory shardIds = new uint256[](2);
        uint256[] memory amounts = new uint256[](2);
        uint256 shard1BalanceBefore = shard.balanceOf(bob, SHARD_1_ID);
        uint256 shard2BalanceBefore = shard.balanceOf(bob, SHARD_2_ID);
        amounts[0] = amounts[1] = 5;

        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(Relic.InvalidAccess.selector, alice));
        relic.batchUnequipShards(relicId, shardIds, amounts);

        // test blacklist
        {
            shardIds[0] = SHARD_1_ID;
            shardIds[1] = SHARD_2_ID;
            changePrank(executor);
            _blacklistAccount(true, false, RELIC_1_ID, bob, shardIds, amounts);
            // relic.setBlacklistAccount(bob, true, RELIC_1_ID, shardIds, amounts);
            changePrank(bob);
            vm.expectRevert(abi.encodeWithSelector(Relic.AccountBlacklisted.selector, bob));
            relic.batchUnequipShards(relicId, shardIds, amounts);
            // reset blacklist
            changePrank(executor);
            relic.setBlacklistAccount(bob, false, RELIC_1_ID, shardIds, amounts);
            assertEq(relic.blacklistedAccounts(bob), false);
        }
        // invalid param length
        {
            changePrank(bob);
            amounts = new uint256[](3);
            amounts[0] = amounts[1] = amounts[2] = 5;
            vm.expectRevert(abi.encodeWithSelector(Relic.InvalidParamLength.selector));
            relic.batchUnequipShards(relicId, shardIds, amounts);
        }
        // insufficient shard balance
        uint256 equippedAmount1;
        uint256 equippedAmount2;
        uint256 amount = 5;
        amounts = new uint256[](2);
        shard.setApprovalForAll(address(relic), true);
        {
            relic.equipShard(relicId, SHARD_1_ID, amount);
            equippedAmount1 = relic.getEquippedShardAmount(relicId, SHARD_1_ID);
            assertEq(equippedAmount1, amount + 5);
            relic.equipShard(relicId, SHARD_2_ID, amount);
            equippedAmount2 = relic.getEquippedShardAmount(relicId, SHARD_2_ID);
            assertEq(equippedAmount2, amount + 5);
            amounts[0] = 5;
            amounts[1] = equippedAmount2 + 1;
            vm.expectRevert(abi.encodeWithSelector(Relic.InsufficientShardBalance.selector, equippedAmount2, amounts[1]));
            relic.batchUnequipShards(relicId, shardIds, amounts);
        }

        amounts[1] = equippedAmount2;
        // shards are already equipped in relicId at this point
        shard1BalanceBefore = shard.balanceOf(bob, SHARD_1_ID);
        shard2BalanceBefore = shard.balanceOf(bob, SHARD_2_ID);
        vm.expectEmit(address(relic));
        emit ShardsUnequipped(bob, relicId, shardIds, amounts);
        relic.batchUnequipShards(relicId, shardIds, amounts);

        assertEq(shard.balanceOf(bob, SHARD_1_ID), shard1BalanceBefore + amounts[0]);
        assertEq(shard.balanceOf(bob, SHARD_2_ID), shard2BalanceBefore + amounts[1]);

    }

    function test_recoverToken() public {
        uint256 amount = 100 ether;
        deal(address(dai), address(relic), amount, true);

        vm.expectEmit();
        emit CommonEventsAndErrors.TokenRecovered(alice, address(dai), amount);

        vm.startPrank(executor);
        relic.recoverToken(address(dai), alice, amount);
        assertEq(dai.balanceOf(alice), amount);
        assertEq(dai.balanceOf(address(relic)), 0);
    }

    // is blacklisting enough?
    // burning adds no incentive per supply/demand
    function test_burnBlacklistedAccountShards() public {
        uint256[] memory shardIds = new uint256[](2);
        shardIds[0] = SHARD_1_ID;
        shardIds[1] = SHARD_2_ID;

        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        relic.burnBlacklistedAccountShards(alice, true, shardIds);
    }

    function test_beforeTokenTransfersBlacklisted() public {
        // blacklist account 
        uint256[] memory shardIds = new uint256[](2);
        uint256[] memory amounts = new uint256[](2);
        shardIds[0] = SHARD_2_ID;
        shardIds[1] = SHARD_2_ID;
        amounts[0] = 10;
        amounts[1] = 20;
        vm.startPrank(operator);
        relic.mintRelic(alice, Relic.Enclave.Structure);
        relic.mintRelic(alice, Relic.Enclave.Chaos);
        uint256[] memory aliceRelics = relic.relicsOfOwner(alice);
        uint256[] memory bobRelics = relic.relicsOfOwner(bob);
        changePrank(executor);
        // mint new relic for alice, equip shards and blacklist
        uint256 aliceRelicId = _blacklistAccount(true, true, 0, alice, shardIds, amounts);
        // relic.setBlacklistAccount(alice, true, RELIC_1_ID, shardIds, amounts);
        // validate transfers for blacklisted accounts

        // sending from and to alice should fail
        changePrank(alice);
        vm.expectRevert(abi.encodeWithSelector(Relic.AccountBlacklisted.selector, alice));
        relic.safeTransferFrom(alice, bob, aliceRelics[1]);
        changePrank(bob);
        vm.expectRevert(abi.encodeWithSelector(Relic.AccountBlacklisted.selector, alice));
        relic.safeTransferFrom(bob, alice, bobRelics[0]);

        // check new owner
        changePrank(executor);
        _blacklistAccount(false, false, aliceRelicId, alice, _emptyUintArray(0), _emptyUintArray(0));
        // relic.setBlacklistAccount(alice, false, aliceRelicId, shardIds, amounts);
        changePrank(bob);
        relic.safeTransferFrom(bob, alice, bobRelics[0]);
        assertEq(relic.ownerOf(bobRelics[0]), alice);
    }
}







