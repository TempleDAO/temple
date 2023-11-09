pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (tests/forge/nexus/Relic.t.sol)

import { TempleTest } from "../TempleTest.sol";
import { Relic } from "../../../contracts/nexus/Relic.sol";
import { NexusCommon } from "../../../contracts/nexus/NexusCommon.sol";
import { IRelic } from "../../../contracts/interfaces/nexus/IRelic.sol";
import { IERC721A } from "../../../contracts/interfaces/nexus/IERC721A.sol";
import { Shard } from "../../../contracts/nexus/Shard.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { FakeERC20 } from "../../../contracts/fakes/FakeERC20.sol";
import { CommonEventsAndErrors } from "../../../contracts/common/CommonEventsAndErrors.sol";
import { IERC1155Receiver } from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";


contract RelicTestBase is TempleTest {
    using EnumerableSet for EnumerableSet.UintSet;

    Relic public relic;
    Shard public shard;
    NexusCommon public nexusCommon;

    FakeERC20 public temple = new FakeERC20("TEMPLE", "TEMPLE", address(0), 0);
    FakeERC20 public dai = new FakeERC20("DAI", "DAI", address(0), 0);

    string private constant NAME = "RELIC";
    string private constant SYMBOL = "REL";
    string internal constant BASE_URI = "http://example.com/";

    uint256 internal constant RARITIES_COUNT = 0x05;
    uint256 internal constant ENCLAVES_COUNT = 0x05;
    uint256 internal constant PER_MINT_QUANTITY = 0x01;
    bytes internal constant ZERO_BYTES = "";

    uint256 internal constant SHARD_1_ID = 0x01;
    uint256 internal constant SHARD_2_ID = 0x02;
    uint256 internal constant SHARD_3_ID = 0x03;
    uint256 internal constant RELIC_1_ID = 0x01;

    uint256 internal constant MYSTERY_ID = 0x01;
    uint256 internal constant CHAOS_ID = 0x02;
    uint256 internal constant ORDER_ID = 0x03;
    uint256 internal constant STRUCTURE_ID = 0x04;
    uint256 internal constant LOGIC_ID = 0x05;

    string internal constant MYSTERY = "MYSTERY";
    string internal constant CHAOS = "CHAOS";
    string internal constant ORDER = "ORDER";
    string internal constant STRUCTURE = "STRUCTURE";
    string internal constant LOGIC = "LOGIC";


    Relic.Rarity public commRarity = IRelic.Rarity.Common;
    Relic.Rarity public uncommonRarity = IRelic.Rarity.Uncommon;
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
        uint256 enclaveId;
        Rarity rarity;
        uint128 xp;
        /// @notice shards equipped to this contract. can extract owner of relic from ownerOf(relicId)
        mapping(uint256 => uint256) equippedShards;
        /// @notice keep track of equipped shards as set
        EnumerableSet.UintSet shards;
    }

    struct RelicInfoView {
        uint256 enclaveId;
        Rarity rarity;
        uint128 xp;
        uint256[] shards;
    }

    event RarityXPThresholdSet(Relic.Rarity rarity, uint256 threshold);
    event RarityBaseUriSet(Relic.Rarity rarity, string uri);
    event RelicMinterSet(address minter, bool allow);
    event RelicMinted(address indexed to, uint256 relicId, uint256 enclaveId);
    event ShardSet(address shard);
    event XPControllerSet(address controller, bool flag);
    event RelicXPSet(uint256 relicId, uint256 xp);
    event ShardEquipped(address caller, uint256 relicId, uint256 shardId, uint256 amount);
    event ShardsEquipped(address caller, uint256 relicId, uint256[] shardIds, uint256[] amounts);
    event ShardUnequipped(address caller, uint256 relicId, uint256 shardId, uint256 amount);
    event ShardsUnequipped(address indexed recipient, uint256 relicId, uint256[] shardIds, uint256[] amounts);
    event AccountBlacklistSet(address account, bool blacklist, uint256[] shardIds, uint256[] amounts);
    event AccountBlacklisted(address account, bool blacklist);
    event ShardBlacklistUpdated(uint256 relicId, uint256 shardId, uint256 amount);
    event NexusCommonSet(address nexusCommon);

    function setUp() public {
        nexusCommon = new NexusCommon(executor);
        relic = new Relic(NAME, SYMBOL, address(nexusCommon), executor);
        shard = new Shard(address(relic), address(nexusCommon), executor, BASE_URI);
        vm.startPrank(executor);
        relic.setRelicMinter(operator, true);
        relic.setShard(address(shard));
        relic.setNexusCommon(address(nexusCommon));
        dai.mint(executor, 10 ether);
        {
            changePrank(executor);
            nexusCommon.setEnclaveName(MYSTERY_ID, MYSTERY);
            nexusCommon.setEnclaveName(CHAOS_ID, CHAOS);
            nexusCommon.setEnclaveName(LOGIC_ID, LOGIC);
            nexusCommon.setEnclaveName(STRUCTURE_ID, STRUCTURE);
            nexusCommon.setEnclaveName(ORDER_ID, ORDER);
        }

        {
            changePrank(operator);
            relic.mintRelic(bob, LOGIC_ID);
            relic.mintRelic(bob, MYSTERY_ID);
        }

        {
            changePrank(executor);
            address[] memory newMinters = new address[](4);
            newMinters[0] = newMinters[1] = newMinters[2] = newMinters[3] = operator;
            shard.setNewMinterShards(newMinters); // Ids: 1,2,3,4
            uint256[] memory shardIds = new uint256[](1);
            bool[] memory allow = new bool[](1);
            allow[0] = true;
            shardIds[0] = SHARD_1_ID;
            shard.setMinterAllowedShardIds(bob, shardIds, allow);

            changePrank(operator);
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

    function test_initialization() public {
        assertEq(relic.name(), NAME);
        assertEq(relic.symbol(), SYMBOL);
        assertEq(relic.executor(), executor);
        assertEq(relic.relicMinters(operator), true);
        assertEq(address(relic.shard()), address(shard));
    }

    function _mintRelicNew(address to, uint256 enclaveId) internal returns (uint256) {
        changePrank(operator);
        uint256 nextId = relic.nextTokenId();
        relic.mintRelic(to, enclaveId);
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

    function _emptyUintArray(uint256 size) internal pure returns (uint256[] memory arr) {
        arr = new uint256[](size);
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
            relicId = _mintRelicNew(account, CHAOS_ID);
        }
        // equip shards first
        if (shardIds.length > 0) {
            _equipShards(relicId, account, shardIds, amounts);
        }
        changePrank(executor);
        relic.setBlacklistAccount(account, relicId, blacklist);
        if (shardIds.length > 0) {
            relic.setBlacklistedShards(account, relicId, shardIds, amounts);
        }
        return relicId;
    }

    function _setRarityThresholds() internal {
        Relic.Rarity[] memory rarities = new Relic.Rarity[](4);
        uint256[] memory thresholds = new uint256[](4);
        rarities[0] = IRelic.Rarity.Uncommon;
        rarities[1] = IRelic.Rarity.Rare;
        rarities[2] = IRelic.Rarity.Epic;
        rarities[3] = IRelic.Rarity.Legendary;
        thresholds[0] = 10;
        thresholds[1] = 30;
        thresholds[2] = 60;
        thresholds[3] = 100;
        relic.setXPRarityThresholds(rarities, thresholds);
    }

    function _toString(uint256 value) internal pure returns (string memory str) {
        assembly {
            // The maximum value of a uint256 contains 78 digits (1 byte per digit), but
            // we allocate 0xa0 bytes to keep the free memory pointer 32-byte word aligned.
            // We will need 1 word for the trailing zeros padding, 1 word for the length,
            // and 3 words for a maximum of 78 digits. Total: 5 * 0x20 = 0xa0.
            let m := add(mload(0x40), 0xa0)
            // Update the free memory pointer to allocate.
            mstore(0x40, m)
            // Assign the `str` to the end.
            str := sub(m, 0x20)
            // Zeroize the slot after the string.
            mstore(str, 0)

            // Cache the end of the memory to calculate the length later.
            let end := str

            // We write the string from rightmost digit to leftmost digit.
            // The following is essentially a do-while loop that also handles the zero case.
            // prettier-ignore
            for { let temp := value } 1 {} {
                str := sub(str, 1)
                // Write the character to the pointer.
                // The ASCII index of the '0' character is 48.
                mstore8(str, add(48, mod(temp, 10)))
                // Keep dividing `temp` until zero.
                temp := div(temp, 10)
                // prettier-ignore
                if iszero(temp) { break }
            }

            let length := sub(end, str)
            // Move the pointer 32 bytes leftwards to make room for the length.
            str := sub(str, 0x20)
            // Store the length.
            mstore(str, length)
        }
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
        vm.startPrank(executor);
        relic.setShard(alice);
    }

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

    function test_access_setBlacklistAccountFail(address caller) public {
        vm.assume(caller != executor && caller != rescuer);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        vm.startPrank(caller);
        relic.setBlacklistAccount(bob, RELIC_1_ID, true);
    }

    function test_access_setBlacklistAccountSuccess() public {
        vm.startPrank(executor);
        relic.setBlacklistAccount(bob, RELIC_1_ID, true);
    }

    function test_access_setBlacklistedShardsFail(address caller) public {
        vm.assume(caller != executor && caller != rescuer);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        vm.startPrank(caller);
        uint256[] memory shardIds = new uint256[](1);
        uint256[] memory amounts = new uint256[](1);
        shardIds[0] = amounts[0] = 1;
        relic.setBlacklistedShards(bob, RELIC_1_ID, shardIds, amounts);
    }

    function test_access_setBlacklistedShardsSuccess() public {
        uint256[] memory shardIds = new uint256[](1);
        uint256[] memory amounts = new uint256[](1);
        shardIds[0] = amounts[0] = 1;
        vm.startPrank(operator);
        _equipShards(RELIC_1_ID, bob, shardIds, amounts);
        changePrank(executor);
        relic.setBlacklistedShards(bob, RELIC_1_ID, shardIds, amounts);
    }

    function test_access_unsetBlacklistedShardsFail(address caller) public {
        vm.assume(caller != executor && caller != rescuer);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        vm.startPrank(caller);
        uint256[] memory shardIds = new uint256[](1);
        uint256[] memory amounts = new uint256[](1);
        shardIds[0] = amounts[0] = 1;
        relic.unsetBlacklistedShards(bob, RELIC_1_ID, shardIds, amounts);
    }

    function test_access_unsetBlacklistedShardsSuccess() public {
        vm.startPrank(executor);
        uint256[] memory shardIds = new uint256[](1);
        uint256[] memory amounts = new uint256[](1);
        shardIds[0] = amounts[0] = 1;
        _equipShards(RELIC_1_ID, bob, shardIds, amounts);
        changePrank(executor);
        relic.setBlacklistedShards(bob, RELIC_1_ID, shardIds, amounts);
        relic.unsetBlacklistedShards(bob, RELIC_1_ID, shardIds, amounts);
    }

    function test_access_setRelicXPFail(address caller) public {
        vm.assume(caller != executor && caller != rescuer && caller != operator);
        vm.startPrank(caller);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        relic.setRelicXP(1, 100);
    }

    function test_access_setRelicXPSuccess() public {
        vm.startPrank(executor);
        relic.setRelicXP(1, 100);
    }

    function test_recoverTokenFail(address caller) public {
        vm.assume(caller != executor && caller != rescuer);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        vm.startPrank(caller);
        relic.recoverToken(address(dai), alice, 1 ether);
    }

    function test_recoverTokenSuccess() public {
        vm.startPrank(executor);
        dai.transfer(address(relic), 1 ether);
        relic.recoverToken(address(dai), alice, 1 ether);
    }

    function test_burnBlacklistedRelicShardsFail(address caller) public {
        vm.assume(caller != executor && caller != rescuer);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        vm.startPrank(caller);
        uint256[] memory shardIds = new uint256[](1);
        uint256[] memory amounts = new uint256[](1);
        shardIds[0] = amounts[0] = 1;
        relic.burnBlacklistedRelicShards(bob, RELIC_1_ID, shardIds, amounts);
    }

    function test_burnBlacklistedRelicShardsSuccess() public {
        vm.startPrank(executor);
        uint256[] memory shardIds = new uint256[](1);
        uint256[] memory amounts = new uint256[](1);
        shardIds[0] = amounts[0] = 1;
        _equipShards(RELIC_1_ID, bob, shardIds, amounts);
        changePrank(executor);
        relic.setBlacklistedShards(bob, RELIC_1_ID, shardIds, amounts);
        relic.burnBlacklistedRelicShards(bob, RELIC_1_ID, shardIds, amounts);
    }
}

contract RelicSettersTest is RelicTestAccess {
    
    function test_setShard() public {
        address relicAddress = address(relic);
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        relic.setShard(address(0));
        vm.expectEmit(relicAddress);
        emit ShardSet(alice);
        relic.setShard(alice);
        assertEq(address(relic.shard()), alice);
    }

    function test_setNexusCommon() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        relic.setNexusCommon(address(0));

        vm.expectEmit(address(relic));
        emit NexusCommonSet(address(nexusCommon));
        relic.setNexusCommon(address(nexusCommon));
    }

    function test_setRelicMinter() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        relic.setRelicMinter(address(0), true);

        /// @dev commented out because expect emit oddly fails
        // vm.expectEmit(address(relic));
        // emit RelicMinterSet(alice, true);
        relic.setRelicMinter(alice, true);
        assertEq(relic.relicMinters(alice), true);

        /// @dev commented out because expect emit oddly fails
        // vm.expectEmit(address(relic));
        // emit RelicMinterSet(alice, false);
        relic.setRelicMinter(alice, false);
        assertEq(relic.relicMinters(alice), false);
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
        vm.expectRevert(abi.encodeWithSelector(IRelic.InvalidParamLength.selector));
        relic.setXPRarityThresholds(rarities, thresholds);
        thresholds = new uint256[](2);
        thresholds[0] = 10;
        thresholds[1] = 100;
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
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        relic.setBlacklistAccount(address(0), RELIC_1_ID, true);
        
        vm.expectRevert(abi.encodeWithSelector(IERC721A.URIQueryForNonexistentToken.selector));
        relic.setBlacklistAccount(bob, 100, true);

        // invalid owner
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        relic.setBlacklistAccount(alice, RELIC_1_ID, true);

        uint256[] memory shardIds = new uint256[](1);
        uint256[] memory amounts = new uint256[](1);
        shardIds[0] = SHARD_1_ID;
        amounts[0] = 2;
        changePrank(operator);
        shard.mintBatch(bob, shardIds, amounts);
        changePrank(bob);
        shard.setApprovalForAll(address(relic), true);
        relic.batchEquipShards(RELIC_1_ID, shardIds, amounts);

        changePrank(executor);
        // blacklist relic shards to trigger error
        relic.setBlacklistedShards(bob, RELIC_1_ID, shardIds, amounts);

        /// @dev commented out because expect emit oddly fails
        // vm.expectEmit(address(relic));
        // emit AccountBlacklisted(bob, true);
        relic.setBlacklistAccount(bob, RELIC_1_ID, true);

        assertEq(relic.blacklistedAccounts(bob), true);
        
        vm.expectRevert(abi.encodeWithSelector(IRelic.CannotWhitelist.selector, RELIC_1_ID));
        relic.setBlacklistAccount(bob, RELIC_1_ID, false);
        // unset blacklisted shards
        relic.unsetBlacklistedShards(bob, RELIC_1_ID, shardIds, amounts);

        /// @dev commented out because expect emit oddly fails
        // vm.expectEmit(address(relic));
        // emit AccountBlacklisted(bob, false);
        relic.setBlacklistAccount(bob, RELIC_1_ID, false);
        assertEq(relic.blacklistedAccounts(bob), false);
    }

    function test_setBlacklistedShards() public {
        uint256[] memory shardIds = new uint256[](1);
        uint256[] memory amounts = new uint256[](1);
        shardIds[0] = SHARD_1_ID;
        amounts[0] = 2;

        vm.startPrank(operator);
        shard.mintBatch(bob, shardIds, amounts);
        changePrank(bob);
        shard.setApprovalForAll(address(relic), true);
        relic.batchEquipShards(RELIC_1_ID, shardIds, amounts);

        changePrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        relic.setBlacklistedShards(address(0), RELIC_1_ID, shardIds, amounts);
        
        vm.expectRevert(abi.encodeWithSelector(IERC721A.URIQueryForNonexistentToken.selector));
        relic.setBlacklistedShards(bob, 100, shardIds, amounts);

        // invalid owner
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        relic.setBlacklistedShards(alice, RELIC_1_ID, shardIds, amounts);

        amounts = new uint256[](2);
        amounts[0] = amounts[1] = 2;
        vm.expectRevert(abi.encodeWithSelector(IRelic.InvalidParamLength.selector));
        relic.setBlacklistedShards(bob, RELIC_1_ID, shardIds, amounts);
        amounts = new uint256[](1);
        amounts[0] = 3;
        vm.expectRevert(abi.encodeWithSelector(IRelic.NotEnoughShardBalance.selector, 2, 3));
        relic.setBlacklistedShards(bob, RELIC_1_ID, shardIds, amounts);

        amounts[0] = 1;
        vm.expectEmit(address(relic));
        emit ShardBlacklistUpdated(RELIC_1_ID, shardIds[0], amounts[0]);
        relic.setBlacklistedShards(bob, RELIC_1_ID, shardIds, amounts);

        assertEq(relic.blacklistedAccounts(bob), true);
        assertEq(relic.blacklistedRelicShards(RELIC_1_ID, shardIds[0]), 1);
        assertEq(relic.blacklistedShardsCount(shardIds[0]), 1);

        vm.expectEmit(address(relic));
        emit ShardBlacklistUpdated(RELIC_1_ID, shardIds[0], amounts[0]);
        relic.setBlacklistedShards(bob, RELIC_1_ID, shardIds, amounts);

        assertEq(relic.blacklistedAccounts(bob), true);
        assertEq(relic.blacklistedRelicShards(RELIC_1_ID, shardIds[0]), 2);
        assertEq(relic.blacklistedShardsCount(shardIds[0]), 2);
    }

    function test_unsetBlacklistedShards() public {
        uint256[] memory shardIds = new uint256[](1);
        uint256[] memory amounts = new uint256[](1);
        shardIds[0] = SHARD_1_ID;
        amounts[0] = 2;
        // setup mint, equipping and blacklisting
        {
            vm.startPrank(operator);
            shard.mintBatch(bob, shardIds, amounts);
            changePrank(bob);
            shard.setApprovalForAll(address(relic), true);
            relic.batchEquipShards(RELIC_1_ID, shardIds, amounts);

            changePrank(executor);
            relic.setBlacklistedShards(bob, RELIC_1_ID, shardIds, amounts);
        }

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        relic.unsetBlacklistedShards(address(0), RELIC_1_ID, shardIds, amounts);
        
        vm.expectRevert(abi.encodeWithSelector(IERC721A.URIQueryForNonexistentToken.selector));
        relic.unsetBlacklistedShards(bob, 100, shardIds, amounts);

        // invalid owner
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        relic.unsetBlacklistedShards(alice, RELIC_1_ID, shardIds, amounts);

        amounts[0] = 3;
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        relic.unsetBlacklistedShards(bob, RELIC_1_ID, shardIds, amounts);

        amounts[0] = 1;
        vm.expectEmit(address(relic));
        emit ShardBlacklistUpdated(RELIC_1_ID, shardIds[0], amounts[0]);
        relic.unsetBlacklistedShards(bob, RELIC_1_ID, shardIds, amounts);

        assertEq(relic.blacklistedAccounts(bob), true);
        assertEq(relic.blacklistedShardsCount(shardIds[0]), 1);
        assertEq(relic.blacklistedRelicShards(RELIC_1_ID, shardIds[0]), 1);

        vm.expectEmit(address(relic));
        emit ShardBlacklistUpdated(RELIC_1_ID, shardIds[0], amounts[0]);
        relic.unsetBlacklistedShards(bob, RELIC_1_ID, shardIds, amounts);

        assertEq(relic.blacklistedAccounts(bob), false);
        assertEq(relic.blacklistedShardsCount(shardIds[0]), 0);
        assertEq(relic.blacklistedRelicShards(RELIC_1_ID, shardIds[0]), 0);

    }

    function test_setRelicXP() public {
        uint256[] memory relicIds = relic.relicsOfOwner(bob);
        uint256 invalidRelicId = 999;
        uint256 xp = 100;
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(IRelic.InvalidRelic.selector, invalidRelicId));
        relic.setRelicXP(invalidRelicId, xp);
        uint256 relicId = relicIds[0];
        IRelic.RelicInfoView memory relicInfoView = relic.getRelicInfo(relicId);
        _setRarityThresholds();
        assertEq(uint8(relicInfoView.rarity), uint8(IRelic.Rarity.Common));
        
        /// @dev commented out because expect emit oddly fails
        // vm.expectEmit(address(relic));
        // emit RelicXPSet(relicId, xp);
        relic.setRelicXP(relicId, xp);

        relicInfoView = relic.getRelicInfo(relicId);
        assertEq(relicInfoView.xp, xp);
        assertEq(uint8(relicInfoView.rarity), uint8(IRelic.Rarity.Legendary));
    }
}

contract RelicViewTest is RelicSettersTest {
    function test_baseURI() public {
        vm.startPrank(executor);
        string memory commonBaseUri = string.concat(BASE_URI, "common/");
        string memory uncommonBaseUri = string.concat(BASE_URI, "uncommon/");
        relic.setBaseUriRarity(IRelic.Rarity.Common, commonBaseUri);
        relic.setBaseUriRarity(IRelic.Rarity.Uncommon, uncommonBaseUri);

        assertEq(relic.getRarityBaseUri(IRelic.Rarity.Common), commonBaseUri);
        assertEq(relic.getRarityBaseUri(IRelic.Rarity.Uncommon), uncommonBaseUri);

        changePrank(operator);
        uint256 relicId = relic.nextTokenId();
        relic.mintRelic(alice, STRUCTURE_ID);
        changePrank(executor);
        relic.setBaseUriRarity(commRarity, BASE_URI);

        string memory expectedUri = string(
            abi.encodePacked(
                BASE_URI,
                _toString(STRUCTURE_ID)
            )
        );
        assertEq(expectedUri, relic.tokenURI(relicId));
        // another enclave
        relicId = relic.nextTokenId();
        changePrank(operator);
        relic.mintRelic(alice, MYSTERY_ID);
        changePrank(executor);
        relic.setBaseUriRarity(commRarity, BASE_URI);
        expectedUri = string(
            abi.encodePacked(
                BASE_URI,
                _toString(MYSTERY_ID)
            )
        );
        assertEq(expectedUri, relic.tokenURI(relicId));
    }

    function test_getEquippedShards() public {
        uint256 invalidRelic = 100;
        uint256[] memory shardIds = new uint256[](2);
        uint256[] memory amounts = new uint256[](2);
        shardIds[0] = SHARD_1_ID;
        shardIds[1] = SHARD_2_ID;
        vm.expectRevert(abi.encodeWithSelector(IRelic.InvalidRelic.selector, invalidRelic));
        relic.getEquippedShards(invalidRelic, shardIds);

        uint256 relicId = relic.nextTokenId() - 1;
        uint256[] memory balancesBefore = relic.getEquippedShards(relicId, shardIds);
        assertEq(balancesBefore[0], 0);
        assertEq(balancesBefore[1], 0);

        // mint new relic
        vm.startPrank(operator);
        relic.mintRelic(alice, CHAOS_ID);
        relicId += 1;
        
        uint256[] memory mintShardIds = new uint256[](3);
        uint256[] memory mintAmounts = new uint256[](3);
        mintShardIds[0] = SHARD_1_ID;
        mintShardIds[1] = SHARD_2_ID;
        mintShardIds[2] = SHARD_3_ID;
        mintAmounts[0] = 10;
        mintAmounts[1] = 15;
        mintAmounts[2] = 20;
        shard.mintBatch(alice, mintShardIds, mintAmounts);
        amounts[0] = amounts[1] = 5;
        changePrank(alice);
        shard.setApprovalForAll(address(relic), true);
        relic.batchEquipShards(relicId, shardIds, amounts);

        uint256[] memory balancesAfter = relic.getEquippedShards(relicId, shardIds);
        assertEq(balancesAfter[0], 5);
        assertEq(balancesAfter[1], 5);
        // equip again same amounts
        relic.batchEquipShards(relicId, shardIds, amounts);
        balancesAfter = relic.getEquippedShards(relicId, shardIds);
        assertEq(balancesAfter[0], 10);
        assertEq(balancesAfter[1], 10);
    }

    function test_getEquippedShardIds() public {
        uint256[] memory relicIds = relic.relicsOfOwner(bob);
        uint256 relicId = relicIds[relicIds.length-1];
        uint256[] memory shardIds = new uint256[](2);
        uint256[] memory amounts = new uint256[](2);
        bool[] memory allow = new bool[](2);
        amounts[0] = amounts[1] = 4;
        shardIds[0] = SHARD_1_ID;
        shardIds[1] = SHARD_2_ID;
        allow[0] = allow[1] = true;

        vm.startPrank(executor);
        shard.setMinterAllowedShardIds(operator, shardIds, allow);
        changePrank(operator);
        shard.mintBatch(bob, shardIds, amounts);
        changePrank(bob);
        shard.setApprovalForAll(address(relic), true);
        relic.batchEquipShards(RELIC_1_ID, shardIds, amounts);
        
        uint256[] memory equipped = relic.getEquippedShards(relicId, shardIds);
        uint256[] memory ids =  relic.getEquippedShardIds(relicId);
        assertEq(equipped[0], amounts[0]);
        assertEq(equipped[1], amounts[1]);
        assertEq(ids[0], shardIds[0]);
        assertEq(ids[1], shardIds[1]);
    }

    function test_getRelicInfo() public {
        /// @dev see test_checkpointRelicRarity, test_setRelicXP, test_mintRelic, test_burnBlacklistedRelicShardsFunc
    }

    function test_nextTokenId() public {
        uint256 _nextTokenId = relic.nextTokenId();
        vm.startPrank(operator);
        relic.mintRelic(alice, CHAOS_ID);
        assertEq(relic.nextTokenId(), _nextTokenId+1);
    }

    function test_totalMinted() public {
        uint256 totalMinted = relic.totalMinted();
        vm.startPrank(operator);
        relic.mintRelic(alice, CHAOS_ID);
        assertEq(relic.totalMinted(), totalMinted+1);
        relic.mintRelic(bob, STRUCTURE_ID);
        assertEq(relic.totalMinted(), totalMinted+2);
    }

    function test_relicsOfOwner() public {
        uint256[] memory aliceRelics = relic.relicsOfOwner(alice);
        uint256 _length = aliceRelics.length;
        vm.startPrank(operator);
        uint256 relicId1 = relic.nextTokenId();
        relic.mintRelic(alice, CHAOS_ID);
        assertEq((relic.relicsOfOwner(alice)).length, _length+1);
        uint256 relicId2 = relic.nextTokenId();
        relic.mintRelic(alice, MYSTERY_ID);
        aliceRelics = relic.relicsOfOwner(alice);
        assertEq((relic.relicsOfOwner(alice)).length, _length+2);
        assertEq(aliceRelics[_length], relicId1);
        assertEq(aliceRelics[_length+1], relicId2);
    }

    function test_tokenURI() public {
        /// @dev see test_baseURI
    }
}

contract RelicTest is RelicViewTest {

    event ApprovalForAll(address caller, address operator, bool approved);

    function test_mintRelic() public {
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(IRelic.CallerCannotMint.selector, alice));
        relic.mintRelic(bob, MYSTERY_ID);

        // blacklist account 
        uint256[] memory shardIds = new uint256[](2);
        uint256[] memory amounts = new uint256[](2);
        shardIds[0] = SHARD_1_ID;
        shardIds[1] = SHARD_2_ID;
        amounts[0] = 10;
        amounts[1] = 20;
        changePrank(executor);
        uint256 relicId = _blacklistAccount(true, true, 0, alice, shardIds, amounts);

        // zero address test
        changePrank(operator);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        relic.mintRelic(address(0), STRUCTURE_ID);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.AccountBlacklisted.selector, alice));
        relic.mintRelic(alice, CHAOS_ID);

        // reset blacklist
        changePrank(executor);
        relic.unsetBlacklistedShards(alice, relicId, shardIds, amounts);
        _blacklistAccount(false, false, relicId, alice, _emptyUintArray(0), _emptyUintArray(0));

        changePrank(operator);
        uint256[] memory relicsBefore = relic.relicsOfOwner(alice);
        uint256 nextTokenId = relic.nextTokenId();
        vm.expectEmit(address(relic));
        emit RelicMinted(alice, nextTokenId, CHAOS_ID);
        relic.mintRelic(alice, CHAOS_ID);

        uint256[] memory relicsAfter = relic.relicsOfOwner(alice);
        IRelic.RelicInfoView memory relicInfoView = relic.getRelicInfo(relicsAfter[0]);
        assertEq(relic.balanceOf(alice), 2);
        assertEq(relic.ownerOf(relicsAfter[0]), alice);
        assertEq(relicsAfter.length, relicsBefore.length + 1);
        assertEq(relicsAfter[0], nextTokenId-1);
        assertEq(relicsAfter[1], nextTokenId);
        assertEq(relic.totalMinted(), nextTokenId + 1);
        assertEq(relicInfoView.enclaveId, CHAOS_ID);
        assertEq(uint(relicInfoView.rarity), uint(IRelic.Rarity.Common));
        assertEq(relicInfoView.xp, 0);
    }

    function test_shardApproval() public {
        uint256[] memory shardIds = new uint256[](2);
        uint256[] memory amounts = new uint256[](2);
        shardIds[0] = SHARD_1_ID;
        shardIds[1] = SHARD_2_ID;
        amounts[0] = amounts[1] = 1;
        vm.startPrank(operator);
        shard.mintBatch(alice, shardIds, amounts);
        uint256 relicId = _mintRelicNew(alice, MYSTERY_ID);
        changePrank(alice);
        vm.expectRevert(abi.encodeWithSignature("ERC1155MissingApprovalForAll(address,address)", address(relic), alice));
        relic.batchEquipShards(relicId, shardIds, amounts);

        shard.setApprovalForAll(address(relic), true);
        relic.batchEquipShards(relicId, shardIds, amounts);
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
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        relic.batchEquipShards(relicId, shardIds, amounts);

        // test blacklist
        shardIds[0] = SHARD_1_ID;
        shardIds[1] = SHARD_2_ID;
        changePrank(executor);
        _blacklistAccount(true, false, RELIC_1_ID, bob, shardIds, amounts);
        changePrank(bob);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.AccountBlacklisted.selector, bob));
        relic.batchEquipShards(relicId, shardIds, amounts);
        // reset blacklist
        changePrank(executor);
        relic.unsetBlacklistedShards(bob, relicId, shardIds, amounts);
        _blacklistAccount(false, false, RELIC_1_ID, bob, _emptyUintArray(0), _emptyUintArray(0));
        assertEq(relic.blacklistedAccounts(bob), false);

        // invalid param length
        changePrank(bob);
        amounts = new uint256[](3);
        amounts[0] = amounts[1] = amounts[2] = 5;
        vm.expectRevert(abi.encodeWithSelector(IRelic.InvalidParamLength.selector));
        relic.batchEquipShards(relicId, shardIds, amounts);

        amounts = new uint256[](2);
        amounts[0] = amounts[1] = 5;
        shard.setApprovalForAll(address(relic), true);
        relic.batchEquipShards(relicId, shardIds, amounts);

        assertEq(shard.balanceOf(bob, SHARD_1_ID), shard1BalanceBefore-amounts[0]);
        assertEq(shard.balanceOf(bob, SHARD_2_ID), shard2BalanceBefore-amounts[1]);
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
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        relic.batchUnequipShards(relicId, shardIds, amounts);

        // test blacklist
        {
            shardIds[0] = SHARD_1_ID;
            shardIds[1] = SHARD_2_ID;
            changePrank(executor);
            _blacklistAccount(true, false, RELIC_1_ID, bob, shardIds, amounts);
            changePrank(bob);
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.AccountBlacklisted.selector, bob));
            relic.batchUnequipShards(relicId, shardIds, amounts);
            // reset blacklist
            changePrank(executor);
            relic.unsetBlacklistedShards(bob, RELIC_1_ID, shardIds, amounts);
            relic.setBlacklistAccount(bob, RELIC_1_ID, false);
            assertEq(relic.blacklistedAccounts(bob), false);
        }
        // invalid param length
        {
            changePrank(bob);
            amounts = new uint256[](3);
            amounts[0] = amounts[1] = amounts[2] = 5;
            vm.expectRevert(abi.encodeWithSelector(IRelic.InvalidParamLength.selector));
            relic.batchUnequipShards(relicId, shardIds, amounts);
        }
        // insufficient shard balance
        uint256[] memory equippedAmount1;
        uint256[] memory equippedAmount2;
        uint256 amount = 5;
        amounts = new uint256[](2);
        shard.setApprovalForAll(address(relic), true);
        uint256[] memory amountsOne = new uint256[](1);
        uint256[] memory shardsOne = new uint256[](1);
        {
            // relic.equipShard(relicId, SHARD_1_ID, amount);
            amountsOne[0] = 5;
            shardsOne[0] = SHARD_1_ID;
            relic.batchEquipShards(relicId, shardsOne, amountsOne);
            equippedAmount1 = relic.getEquippedShards(relicId, shardsOne);
            assertEq(equippedAmount1[0], amount + 5);

            shardsOne[0] = SHARD_2_ID;
            relic.batchEquipShards(relicId, shardsOne, amountsOne);
            equippedAmount2 = relic.getEquippedShards(relicId, shardsOne);
            assertEq(equippedAmount2[0], amount + 5);
            amounts[0] = 5;
            amounts[1] = equippedAmount2[0] + 1;
            vm.expectRevert(abi.encodeWithSelector(IRelic.InsufficientShardBalance.selector, equippedAmount2[0], amounts[1]));
            relic.batchUnequipShards(relicId, shardIds, amounts);
        }
        amounts[1] = equippedAmount2[0];
        // shards are already equipped in relicId
        shard1BalanceBefore = shard.balanceOf(bob, SHARD_1_ID);
        shard2BalanceBefore = shard.balanceOf(bob, SHARD_2_ID);
        /// @dev commented out because expect emit oddly fails
        // vm.expectEmit(address(relic));
        // emit ShardsUnequipped(bob, relicId, shardIds, amounts);
        relic.batchUnequipShards(relicId, shardIds, amounts);

        assertEq(shard.balanceOf(bob, SHARD_1_ID), shard1BalanceBefore + amounts[0]);
        assertEq(shard.balanceOf(bob, SHARD_2_ID), shard2BalanceBefore + amounts[1]);

    }

    function test_relicRecoverToken() public {
        uint256 amount = 100 ether;
        deal(address(dai), address(relic), amount, true);

        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        relic.recoverToken(address(dai), address(0), amount);
        
        vm.expectEmit();
        emit CommonEventsAndErrors.TokenRecovered(alice, address(dai), amount);
        relic.recoverToken(address(dai), alice, amount);
        assertEq(dai.balanceOf(alice), amount);
        assertEq(dai.balanceOf(address(relic)), 0);
    }

    // burning adds no incentive per supply/demand
    function test_burnBlacklistedRelicShardsFunc() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        relic.setBlacklistAccount(address(0), RELIC_1_ID, true);
        
        vm.expectRevert(abi.encodeWithSelector(IERC721A.URIQueryForNonexistentToken.selector));
        relic.setBlacklistAccount(bob, 100, true);

        // invalid owner
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        relic.setBlacklistAccount(alice, RELIC_1_ID, true);

        uint256[] memory shardIds = new uint256[](2);
        uint256[] memory amounts = new uint256[](1);

        // zero shard Ids
        vm.expectRevert(abi.encodeWithSelector(IRelic.InvalidParamLength.selector));
        relic.burnBlacklistedRelicShards(bob, RELIC_1_ID, shardIds, amounts);

        shardIds[0] = SHARD_1_ID;
        shardIds[1] = SHARD_2_ID;
        amounts[0] = 1;
        // unequal lengths
        vm.expectRevert(abi.encodeWithSelector(IRelic.InvalidParamLength.selector));
        relic.burnBlacklistedRelicShards(bob, RELIC_1_ID, shardIds, amounts);

        // equip shards and blacklist an account
        changePrank(operator);
        amounts = new uint256[](2);
        amounts[0] = 2;
        amounts[1] = 3;
        uint256 relicId = _blacklistAccount(true, true, 0, alice, shardIds, amounts);
        uint256[] memory equipped = relic.getEquippedShards(relicId, shardIds);
        assertEq(equipped[0], amounts[0]);
        assertEq(equipped[1], amounts[1]);
        // invalid owner. bob is owner of relic Id 0
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        relic.burnBlacklistedRelicShards(bob, relicId, shardIds, amounts);

        uint256 relicShard1AmountBefore = shard.balanceOf(address(relic), shardIds[0]);
        uint256 relicShard2AmountBefore = shard.balanceOf(address(relic), shardIds[1]);
        uint256 relicShard3AmountBefore = shard.balanceOf(address(relic), SHARD_3_ID);
        assertEq(relic.blacklistedAccounts(alice), true);
        assertEq(relic.blacklistedRelicShards(relicId, shardIds[0]), amounts[0]);
        assertEq(relic.blacklistedRelicShards(relicId, shardIds[1]), amounts[1]);
        assertEq(relic.blacklistedShardsCount(relicId), amounts[0] + amounts[1]);

        changePrank(executor);
        relic.burnBlacklistedRelicShards(alice, relicId, shardIds, amounts);
        assertEq(relic.blacklistedAccounts(alice), false);
        assertEq(relic.blacklistedRelicShards(relicId, shardIds[0]), 0);
        assertEq(relic.blacklistedRelicShards(relicId, shardIds[1]), 0);
        equipped = relic.getEquippedShards(relicId, shardIds);
        assertEq(equipped[0], 0);
        assertEq(equipped[1], 0);
        assertEq(shard.balanceOf(address(relic), shardIds[0]), relicShard1AmountBefore - amounts[0]);
        assertEq(shard.balanceOf(address(relic), shardIds[1]), relicShard2AmountBefore - amounts[1]);
        assertEq(shard.balanceOf(address(relic), SHARD_3_ID), relicShard3AmountBefore);
        assertEq(relic.blacklistedShardsCount(relicId), 0);
        IRelic.RelicInfoView memory relicInfoView = relic.getRelicInfo(relicId);
        assertEq(relicInfoView.shards.length, 0);
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
        relic.mintRelic(alice, STRUCTURE_ID);
        relic.mintRelic(alice, CHAOS_ID);
        uint256[] memory aliceRelics = relic.relicsOfOwner(alice);
        uint256[] memory bobRelics = relic.relicsOfOwner(bob);
        changePrank(executor);
        // mint new relic for alice, equip shards and blacklist
        uint256 aliceRelicId = _blacklistAccount(true, true, 0, alice, shardIds, amounts);

        // sending from and to alice should fail
        changePrank(alice);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.AccountBlacklisted.selector, alice));
        relic.safeTransferFrom(alice, bob, aliceRelics[1]);
        changePrank(bob);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.AccountBlacklisted.selector, alice));
        relic.safeTransferFrom(bob, alice, bobRelics[0]);

        // check new owner
        changePrank(executor);
        relic.unsetBlacklistedShards(alice, aliceRelicId, shardIds, amounts);
        _blacklistAccount(false, false, aliceRelicId, alice, _emptyUintArray(0), _emptyUintArray(0));
        changePrank(bob);
        relic.safeTransferFrom(bob, alice, bobRelics[0]);
        assertEq(relic.ownerOf(bobRelics[0]), alice);
    }

    function test_checkpointRelicRarity() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(IRelic.InvalidRelic.selector, 100));
        relic.checkpointRelicRarity(100);
        uint256 relicId = relic.nextTokenId() - 1;
        relic.checkpointRelicRarity(relicId);
        IRelic.RelicInfoView memory relicInfoView = relic.getRelicInfo(relicId);
        assertEq(relicInfoView.xp, 0);
        _setRarityThresholds();
        relic.setRelicXP(relicId, 10);
        relic.checkpointRelicRarity(relicId);
        relicInfoView = relic.getRelicInfo(relicId);
        assertEq(relicInfoView.xp, 10);
        assertEq(uint8(relicInfoView.rarity), uint8(IRelic.Rarity.Uncommon));
        relic.setRelicXP(relicId, 31);
        // no checkpoint
        assertEq(uint8(relicInfoView.rarity), uint8(IRelic.Rarity.Uncommon));
        relic.checkpointRelicRarity(relicId);
        relicInfoView = relic.getRelicInfo(relicId);
        assertEq(uint8(relicInfoView.rarity), uint8(IRelic.Rarity.Rare));
        relic.setRelicXP(relicId, 78);
        // no checkpoint
        relicInfoView = relic.getRelicInfo(relicId);
        assertEq(uint8(relicInfoView.rarity), uint8(IRelic.Rarity.Epic));
        relic.setRelicXP(relicId, 101);
        relicInfoView = relic.getRelicInfo(relicId);
        assertEq(uint8(relicInfoView.rarity), uint8(IRelic.Rarity.Legendary));
    }

    function test_supportsInterface() public {
        assertEq(relic.supportsInterface(0x01ffc9a7), true); // ERC165 interface ID for ERC165.
        assertEq(relic.supportsInterface(0x80ac58cd), true); // ERC165 interface ID for ERC721.
        assertEq(relic.supportsInterface(0x5b5e139f), true); // ERC165 interface ID for ERC721Metadata.
    }
}