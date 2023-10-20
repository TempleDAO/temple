 pragma solidity 0.8.19;
// // SPDX-License-Identifier: AGPL-3.0-or-later

// import { TempleTest } from "../TempleTest.sol";
// import { Relic } from "../../../contracts/nexus/Relic.sol";
// import { Shard } from "../../../contracts/nexus/Shard.sol";
// import { FakeERC20 } from "../../../contracts/fakes/FakeERC20.sol";
// import { CommonEventsAndErrors } from "../../../contracts/common/CommonEventsAndErrors.sol";
// import { IERC1155Receiver } from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";


// contract RelicTestBase is TempleTest {
//     Relic public relic;
//     Shard public shard;

//     FakeERC20 public temple = new FakeERC20("TEMPLE", "TEMPLE", address(0), 0);
//     FakeERC20 public dai = new FakeERC20("DAI", "DAI", address(0), 0);

//     string private constant NAME = "RELIC";
//     string private constant SYMBOL = "REL";
//     string internal constant BASE_URI = "http://example.com/";

//     uint256 internal constant RARITIES_COUNT = 0x05;
//     uint256 internal constant ENCLAVES_COUNT = 0x05;
//     address internal constant ZERO_ADDRESS = 0x0000000000000000000000000000000000000000;
//     uint256 internal constant PER_MINT_QUANTITY = 0x01;
//     bytes internal constant ZERO_BYTES = "";

//     uint256 internal constant SHARD_1_ID = 0x01;
//     uint256 internal constant SHARD_2_ID = 0x02;
//     uint256 internal constant SHARD_3_ID = 0x03; 
//     uint256 internal constant RELIC_1_ID = 0x01;

//     Relic.Rarity public commRarity = Relic.Rarity.Common;
//     Relic.Rarity public uncommonRarity = Relic.Rarity.Uncommon;
//     Rarity public invalidRarity = Rarity.InvalidRarity;

//     enum Enclave {
//         Chaos,
//         Mystery,
//         Logic,
//         Order,
//         Structure,
//         InvalidEnclave
//     }

//     enum Rarity {
//         Common,
//         Uncommon,
//         Rare,
//         Epic,
//         Legendary,
//         InvalidRarity
//     }

//     struct RelicInfo {
//         Enclave enclave;
//         Rarity rarity;
//         uint128 xp;
//     }

//     event RarityXPThresholdSet(Relic.Rarity rarity, uint256 threshold);
//     event RarityBaseUriSet(Relic.Rarity rarity, string uri);
//     event RelicMinterSet(address minter, bool allow);
//     event ShardSet(address shard);
//     event RelicMinted(address msgSender, uint256 nextTokenId, uint256 quantity);
//     event XPControllerSet(address controller, bool flag);
//     event RelicXPSet(uint256 relicId, uint256 xp);
//     event ShardEquipped(address caller, uint256 relicId, uint256 shardId, uint256 amount);
//     event ShardsEquipped(address caller, uint256 relicId, uint256[] shardIds, uint256[] amounts);
//     event ShardUnequipped(address caller, uint256 relicId, uint256 shardId, uint256 amount);
//     event ShardsUnequipped(address recipient, uint256 relicId, uint256[] shardIds, uint256[] amounts);
//     event AccountBlacklistSet(address account, bool blacklist, uint256[] shardIds, uint256[] amounts);

//     function setUp() public {
//         relic = new Relic(NAME, SYMBOL, rescuer, executor);
//         shard = new Shard(address(relic), rescuer, executor, BASE_URI);
//         vm.startPrank(executor);
//         relic.setRelicMinter(operator, true);
//         relic.setShard(address(shard));
//         changePrank(operator);
//         relic.mintRelic(bob, Relic.Enclave.Logic);
//         relic.mintRelic(bob, Relic.Enclave.Mystery);

//         {
//             changePrank(executor);
//             uint256 shardId = shard.setNewMinterShard(operator); // ID 1
//             shard.setMinterAllowedShardId(bob, shardId, true);
//             shard.setNewMinterShard(operator); // ID 2
//             shard.setNewMinterShard(operator); // ID 3
//             shard.setNewMinterShard(operator); // ID 4

//             changePrank(operator);
//             shard.mint(bob, 1, 5);
//             shard.mint(bob, 2, 10);
//         }
        
//         vm.stopPrank();
//     }

//     function test_initialization() public {
//         assertEq(relic.name(), NAME);
//         assertEq(relic.symbol(), SYMBOL);
//         assertEq(relic.rescuer(), rescuer);
//         assertEq(relic.executor(), executor);
//     }

//     function _mintRelicNew(address to, Relic.Enclave enclave) internal returns (uint256) {
//         changePrank(operator);
//         uint256 nextId = relic.getNextTokenId();
//         relic.mintRelic(to, enclave);
//         return nextId;
//     }

//     function _equipShards(
//         uint256 relicId,
//         address account,
//         uint256[] memory shardIds,
//         uint256[] memory amounts
//     ) internal {
//         changePrank(operator);
//         shard.mintBatch(account, shardIds, amounts);
//         changePrank(account);
//         shard.setApprovalForAll(address(relic), true);
//         relic.batchEquipShards(relicId, shardIds, amounts);   
//     }

//     function _blacklistAccount(
//         bool blacklist,
//         bool newRelic,
//         uint256 relicId,
//         address account,
//         uint256[] memory shardIds,
//         uint256[] memory amounts
//     ) internal returns (uint256) {
//         changePrank(operator);
//         if (newRelic) {
//             relicId = _mintRelicNew(account, Relic.Enclave.Chaos);
//         }
//         // equip shards first
//         if (shardIds.length > 0) {
//             _equipShards(relicId, account, shardIds, amounts);
//         }
//         changePrank(executor);
//         relic.setBlacklistAccount(account, blacklist, relicId, shardIds, amounts);
//         return relicId;
//     }

//     function _emptyUintArray(uint256 size) internal pure returns (uint256[] memory arr) {
//         arr = new uint256[](size);
//     }

//     function _setRarityThresholds() internal {
//         Relic.Rarity[] memory rarities = new Relic.Rarity[](4);
//         uint256[] memory thresholds = new uint256[](4);
//         rarities[0] = Relic.Rarity.Uncommon;
//         rarities[1] = Relic.Rarity.Rare;
//         rarities[2] = Relic.Rarity.Epic;
//         rarities[3] = Relic.Rarity.Legendary;
//         thresholds[0] = 10;
//         thresholds[1] = 30;
//         thresholds[2] = 60;
//         thresholds[3] = 100;
//         relic.setXPRarityThresholds(rarities, thresholds);
//     }

//     function _toString(uint256 value) internal pure returns (string memory str) {
//         assembly {
//             // The maximum value of a uint256 contains 78 digits (1 byte per digit), but
//             // we allocate 0xa0 bytes to keep the free memory pointer 32-byte word aligned.
//             // We will need 1 word for the trailing zeros padding, 1 word for the length,
//             // and 3 words for a maximum of 78 digits. Total: 5 * 0x20 = 0xa0.
//             let m := add(mload(0x40), 0xa0)
//             // Update the free memory pointer to allocate.
//             mstore(0x40, m)
//             // Assign the `str` to the end.
//             str := sub(m, 0x20)
//             // Zeroize the slot after the string.
//             mstore(str, 0)

//             // Cache the end of the memory to calculate the length later.
//             let end := str

//             // We write the string from rightmost digit to leftmost digit.
//             // The following is essentially a do-while loop that also handles the zero case.
//             // prettier-ignore
//             for { let temp := value } 1 {} {
//                 str := sub(str, 1)
//                 // Write the character to the pointer.
//                 // The ASCII index of the '0' character is 48.
//                 mstore8(str, add(48, mod(temp, 10)))
//                 // Keep dividing `temp` until zero.
//                 temp := div(temp, 10)
//                 // prettier-ignore
//                 if iszero(temp) { break }
//             }

//             let length := sub(end, str)
//             // Move the pointer 32 bytes leftwards to make room for the length.
//             str := sub(str, 0x20)
//             // Store the length.
//             mstore(str, length)
//         }
//     }
// }

// contract RelicTestAccess is RelicTestBase {

//     // address internal constant relicAddress = address(relic);
//     function test_access_setShardFail(address caller) public {
//         /// use fuzzing
//         vm.assume(caller != executor && caller != rescuer);
//         vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
//         vm.startPrank(caller);
//         relic.setShard(alice);
//     }

//     function test_access_setShardSuccess() public {
//         vm.startPrank(executor);
//         relic.setShard(alice);
//     }

//     function test_access_setRelicMinterFail(address caller) public {
//         vm.assume(caller != executor && caller != rescuer);
//         vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
//         vm.startPrank(caller);
//         relic.setRelicMinter(alice, true);
//     }

//     function test_access_setRelicMinterSuccess() public {
//         vm.startPrank(executor);
//         relic.setRelicMinter(alice, true);
//     }

//     function test_access_setXPRarityThresholdsFail(address caller) public {
//         vm.assume(caller != executor && caller != rescuer);
//         vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
//         Relic.Rarity[] memory rarities = new Relic.Rarity[](1);
//         rarities[0] = commRarity;
//         uint256[] memory thresholds = new uint256[](1);
//         thresholds[0] = 100;
//         vm.startPrank(caller);
//         relic.setXPRarityThresholds(rarities, thresholds);
//     }

//     function test_access_setXPRarityThresholdsSuccess() public {
//         Relic.Rarity[] memory rarities = new Relic.Rarity[](1);
//         rarities[0] = commRarity;
//         uint256[] memory thresholds = new uint256[](1);
//         thresholds[0] = 100;
//         vm.startPrank(executor);
//         relic.setXPRarityThresholds(rarities, thresholds);
//     }

//     function test_access_setBaseUriRarityFail(address caller) public {
//         vm.assume(caller != executor && caller != rescuer);
//         vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
//         vm.startPrank(caller);
//         relic.setBaseUriRarity(commRarity, "some string");
//     }

//     function test_access_setBaseUriRaritySuccess() public {
//         vm.startPrank(executor);
//         relic.setBaseUriRarity(commRarity, "some string");
//     }

//     function test_access_setBlacklistAccuntFail(address caller) public {
//         vm.assume(caller != executor && caller != rescuer);
//         vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
//         uint256[] memory ids = new uint256[](1);
//         uint256[] memory amounts = new uint256[](1);
//         ids[0] = amounts[0] = 1;
//         vm.startPrank(caller);
//         relic.setBlacklistAccount(alice, true, RELIC_1_ID, ids, amounts);
//     }

//     function test_access_setBlacklistAccuntSuccess() public {
//         uint256[] memory ids = new uint256[](1);
//         uint256[] memory amounts = new uint256[](1);
//         ids[0] = amounts[0] = 1;
//         vm.startPrank(executor);
//         _blacklistAccount(false, true, 0, alice, _emptyUintArray(0), _emptyUintArray(0));
//     }

//     function test_access_setRelicXPFail(address caller) public {
//         vm.assume(caller != executor && caller != rescuer && caller != operator);
//         vm.startPrank(caller);
//         vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
//         relic.setRelicXP(1, 100);
//     }

//      function test_access_setRelicXPSuccess() public {
//         vm.startPrank(executor);
//         relic.setRelicXP(1, 100);
//     }
// }

// contract RelicSettersTest is RelicTestAccess {
    
//     function test_setShard() public {
//         address relicAddress = address(relic);
//         vm.startPrank(executor);
//         vm.expectRevert(abi.encodeWithSelector(Relic.InvalidAddress.selector, ZERO_ADDRESS));
//         relic.setShard(ZERO_ADDRESS);
//         vm.expectEmit(relicAddress);
//         emit ShardSet(alice);
//         relic.setShard(alice);
//         assertEq(address(relic.shard()), alice);
//     }

//     function test_setRelicMinter() public {
//         address relicAddress = address(relic);
//         vm.startPrank(executor);
//         vm.expectRevert(abi.encodeWithSelector(Relic.ZeroAddress.selector));
//         relic.setRelicMinter(ZERO_ADDRESS, true);

//         vm.expectEmit(relicAddress);
//         emit RelicMinterSet(alice, true);
//         relic.setRelicMinter(alice, true);
//         assertEq(relic.relicMinters(alice), true);
//     }

//     function test_setXPRarityThresholds() public {
//         vm.startPrank(executor);
//         Relic.Rarity[] memory rarities = new Relic.Rarity[](2);
//         uint256[] memory thresholds = new uint256[](3);
//         rarities[0] = commRarity;
//         rarities[1] = uncommonRarity;
//         thresholds[0] = 10;
//         thresholds[1] = 100;
//         thresholds[2] = 120;
//         vm.expectRevert(abi.encodeWithSelector(Relic.InvalidParamLength.selector));
//         relic.setXPRarityThresholds(rarities, thresholds);
//         thresholds = new uint256[](2);
//         thresholds[0] = 10;
//         thresholds[1] = 100;
//         vm.expectEmit(address(relic));
//         emit RarityXPThresholdSet(rarities[0], thresholds[0]);
//         emit RarityXPThresholdSet(rarities[1], thresholds[1]);
//         relic.setXPRarityThresholds(rarities, thresholds);
//         assertEq(relic.rarityXPThresholds(rarities[0]), thresholds[0]);
//         assertEq(relic.rarityXPThresholds(rarities[1]), thresholds[1]);
//     }

//     function test_setBaseUriRarity() public {
//         string memory uri = "http://example.com";
//         vm.startPrank(executor);
//         vm.expectEmit(address(relic));
//         emit RarityBaseUriSet(commRarity, uri);
//         relic.setBaseUriRarity(commRarity, uri);
//         assertEq(relic.getRarityBaseUri(commRarity), uri);
//     }

//     function test_setBlacklistAccount() public {
//         uint256[] memory shardIds = new uint256[](2);
//         uint256[] memory amounts = new uint256[](2);
//         shardIds[0] = SHARD_1_ID;
//         shardIds[1] = SHARD_2_ID;
//         amounts[0] = 10;
//         amounts[1] = 20;
//         vm.startPrank(executor);
//         vm.expectRevert(abi.encodeWithSelector(Relic.ZeroAddress.selector));
//         relic.setBlacklistAccount(ZERO_ADDRESS, true, RELIC_1_ID, shardIds, amounts);

//         amounts = new uint256[](3);
//         amounts[0] = 10;
//         amounts[1] = 20;
//         amounts[2] = 30;
//         vm.expectRevert(abi.encodeWithSelector(Relic.InvalidParamLength.selector));
//         relic.setBlacklistAccount(alice, true, RELIC_1_ID, shardIds, amounts);

//         amounts = new uint256[](2);
//         amounts[0] = 10;
//         amounts[1] = 20;
//         vm.expectRevert(abi.encodeWithSelector(Relic.NotEnoughShardBalance.selector, 0, 10));
//         relic.setBlacklistAccount(alice, true, RELIC_1_ID, shardIds, amounts);

//         // mint new relic and shards. then equip
//         uint256 relicId = _mintRelicNew(alice, Relic.Enclave.Mystery);
//         _equipShards(relicId, alice, shardIds, amounts);

//         changePrank(executor);
//         vm.expectEmit(address(relic));
//         emit AccountBlacklistSet(alice, true, shardIds, amounts);
//         relic.setBlacklistAccount(alice, true, relicId, shardIds, amounts);

//         assertEq(relic.blacklistedAccounts(alice), true);
//         assertEq(relic.blacklistedAccountShards(alice, shardIds[0]), amounts[0]);
//         assertEq(relic.blacklistedAccountShards(alice, shardIds[1]), amounts[1]);

//         // now set blacklist to false, reducing amounts but not all
//         amounts[0] = 5;
//         amounts[1] = 10;
//         vm.expectEmit(address(relic));
//         emit AccountBlacklistSet(alice, false, shardIds, amounts);
//         relic.setBlacklistAccount(alice, false, relicId, shardIds, amounts);
//         assertEq(relic.blacklistedAccounts(alice), true);
//         assertEq(relic.blacklistedAccountShards(alice, shardIds[0]), 5);
//         assertEq(relic.blacklistedAccountShards(alice, shardIds[1]), 10);
//         // now reduce all amounts to 0
//         relic.setBlacklistAccount(alice, false, relicId, shardIds, amounts);
//         assertEq(relic.blacklistedAccounts(alice), false);
//         assertEq(relic.blacklistedAccountShards(alice, shardIds[0]), 0);
//         assertEq(relic.blacklistedAccountShards(alice, shardIds[1]), 0);
//     }

//     function test_setRelicXP() public {
//         uint256[] memory relicIds = relic.relicsOfOwner(bob);
//         uint256 invalidRelicId = 999;
//         uint256 xp = 100;
//         vm.startPrank(executor);
//         vm.expectRevert(abi.encodeWithSelector(Relic.InvalidRelic.selector, invalidRelicId));
//         relic.setRelicXP(invalidRelicId, xp);
//         uint256 relicId = relicIds[0];
//         (, Relic.Rarity rarity,uint256 newXp) = relic.relicInfos(relicId);
//         _setRarityThresholds();
//         assertEq(uint8(rarity), uint8(Relic.Rarity.Common));
        
//         vm.expectEmit(address(relic));
//         emit RelicXPSet(relicId, xp);
//         relic.setRelicXP(relicId, xp);

//         (, rarity, newXp) = relic.relicInfos(relicId);
//         assertEq(newXp, xp);
//         assertEq(uint8(rarity), uint8(Relic.Rarity.Legendary));
//     }
// }

// contract RelicViewTest is RelicSettersTest {
//     function test_baseURI() public {
//         vm.startPrank(executor);
//         string memory commonBaseUri = string.concat(BASE_URI, "common/");
//         string memory uncommonBaseUri = string.concat(BASE_URI, "uncommon/");
//         relic.setBaseUriRarity(Relic.Rarity.Common, commonBaseUri);
//         relic.setBaseUriRarity(Relic.Rarity.Uncommon, uncommonBaseUri);

//         assertEq(relic.getRarityBaseUri(Relic.Rarity.Common), commonBaseUri);
//         assertEq(relic.getRarityBaseUri(Relic.Rarity.Uncommon), uncommonBaseUri);

//         changePrank(operator);
//         uint256 relicId = relic.nextTokenId();
//         relic.mintRelic(alice, Relic.Enclave.Structure);
//         changePrank(executor);
//         relic.setBaseUriRarity(commRarity, BASE_URI);

//         string memory expectedUri = string(
//             abi.encodePacked(
//                 BASE_URI,
//                 _toString(uint256(uint8(Relic.Enclave.Structure)))
//             )
//         );
//         assertEq(expectedUri, relic.tokenURI(relicId));
//         // another enclave
//         relicId = relic.nextTokenId();
//         changePrank(operator);
//         relic.mintRelic(alice, Relic.Enclave.Mystery);
//         changePrank(executor);
//         relic.setBaseUriRarity(commRarity, BASE_URI);
//         expectedUri = string(
//             abi.encodePacked(
//                 BASE_URI,
//                 _toString(uint256(uint8(Relic.Enclave.Mystery)))
//             )
//         );
//         assertEq(expectedUri, relic.tokenURI(relicId));
//     }

//     function test_getBalanceBatch() public {
//         uint256 invalidRelic = 100;
//         uint256[] memory shardIds = new uint256[](2);
//         uint256[] memory amounts = new uint256[](2);
//         shardIds[0] = SHARD_1_ID;
//         shardIds[1] = SHARD_2_ID;
//         vm.expectRevert(abi.encodeWithSelector(Relic.InvalidRelic.selector, invalidRelic));
//         relic.getBalanceBatch(invalidRelic, shardIds);

//         uint256 relicId = relic.nextTokenId() - 1;
//         uint256[] memory balancesBefore = relic.getBalanceBatch(relicId, shardIds);
//         assertEq(balancesBefore[0], 0);
//         assertEq(balancesBefore[1], 0);

//         // mint new relic
//         vm.startPrank(operator);
//         relic.mintRelic(alice, Relic.Enclave.Chaos);
//         relicId += 1;
        
//         shard.mint(alice, SHARD_1_ID, 10);
//         shard.mint(alice, SHARD_2_ID, 15);
//         shard.mint(alice, SHARD_3_ID, 20);
//         amounts[0] = amounts[1] = 5;
//         changePrank(alice);
//         shard.setApprovalForAll(address(relic), true);
//         relic.batchEquipShards(relicId, shardIds, amounts);

//         uint256[] memory balancesAfter = relic.getBalanceBatch(relicId, shardIds);
//         assertEq(balancesAfter[0], 5);
//         assertEq(balancesAfter[1], 5);
//         // equip again same amounts
//         relic.batchEquipShards(relicId, shardIds, amounts);
//         balancesAfter = relic.getBalanceBatch(relicId, shardIds);
//         assertEq(balancesAfter[0], 10);
//         assertEq(balancesAfter[1], 10);
//     }
// }

// contract RelicTest is RelicViewTest {

//     event ApprovalForAll(address caller, address operator, bool approved);

//     function test_mintRelic() public {
//         vm.startPrank(alice);
//         vm.expectRevert(abi.encodeWithSelector(Relic.CallerCannotMint.selector, alice));
//         relic.mintRelic(bob, Relic.Enclave.Mystery);

//         // blacklist account 
//         uint256[] memory shardIds = new uint256[](2);
//         uint256[] memory amounts = new uint256[](2);
//         shardIds[0] = SHARD_1_ID;
//         shardIds[1] = SHARD_2_ID;
//         amounts[0] = 10;
//         amounts[1] = 20;
//         changePrank(executor);
//         uint256 relicId = _blacklistAccount(true, true, 0, alice, shardIds, amounts);

//         // zero address test
//         changePrank(operator);
//         vm.expectRevert(abi.encodeWithSelector(Relic.ZeroAddress.selector));
//         relic.mintRelic(ZERO_ADDRESS, Relic.Enclave.Structure);

//         vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.AccountBlacklisted.selector, alice));
//         relic.mintRelic(alice, Relic.Enclave.Chaos);

//         // reset blacklist
//         changePrank(executor);
//         _blacklistAccount(false, false, relicId, alice, _emptyUintArray(0), _emptyUintArray(0));

//         changePrank(operator);
//         uint256[] memory relicsBefore = relic.relicsOfOwner(alice);
//         uint256 nextTokenId = relic.totalMinted();
//         vm.expectEmit(address(relic));
//         emit RelicMinted(alice, nextTokenId, 1);
//         relic.mintRelic(alice, Relic.Enclave.Chaos);

//         uint256[] memory relicsAfter = relic.relicsOfOwner(alice);
//         (Relic.Enclave enclave, Relic.Rarity rarity, uint256 xp) = relic.relicInfos(relicsAfter[0]);
//         assertEq(relic.balanceOf(alice), 2);
//         assertEq(relic.ownerOf(relicsAfter[0]), alice);
//         assertEq(relicsAfter.length, relicsBefore.length + 1);
//         assertEq(relicsAfter[0], nextTokenId-1);
//         assertEq(relicsAfter[1], nextTokenId);
//         assertEq(relic.totalMinted(), nextTokenId + 1);
//         assertEq(uint(enclave), uint(Relic.Enclave.Chaos));
//         assertEq(uint(rarity), uint(Relic.Rarity.Common));
//         assertEq(xp, 0);
//     }

//     function test_shardApproval() public {
//         uint256[] memory shardIds = new uint256[](2);
//         uint256[] memory amounts = new uint256[](2);
//         shardIds[0] = SHARD_1_ID;
//         shardIds[1] = SHARD_2_ID;
//         amounts[0] = amounts[1] = 1;
//         vm.startPrank(operator);
//         shard.mintBatch(alice, shardIds, amounts);
//         uint256 relicId = _mintRelicNew(alice, Relic.Enclave.Mystery);
//         changePrank(alice);
//         vm.expectRevert("ERC1155: caller is not token owner or approved");
//         relic.batchEquipShards(relicId, shardIds, amounts);

//         shard.setApprovalForAll(address(relic), true);
//         relic.batchEquipShards(relicId, shardIds, amounts);
//     }

//     function test_batchEquipShards() public {
//         uint256[] memory relicIds = relic.relicsOfOwner(bob);
//         uint256 relicId = relicIds[relicIds.length-1];
//         uint256[] memory shardIds = new uint256[](2);
//         uint256[] memory amounts = new uint256[](2);
//         uint256 shard1BalanceBefore = shard.balanceOf(bob, SHARD_1_ID);
//         uint256 shard2BalanceBefore = shard.balanceOf(bob, SHARD_2_ID);
//         amounts[0] = amounts[1] = 5;

//         vm.startPrank(alice);
//         vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
//         relic.batchEquipShards(relicId, shardIds, amounts);

//         // test blacklist
//         shardIds[0] = SHARD_1_ID;
//         shardIds[1] = SHARD_2_ID;
//         changePrank(executor);
//         _blacklistAccount(true, false, RELIC_1_ID, bob, shardIds, amounts);
//         changePrank(bob);
//         vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.AccountBlacklisted.selector, bob));
//         relic.batchEquipShards(relicId, shardIds, amounts);
//         // reset blacklist
//         changePrank(executor);
//         _blacklistAccount(false, false, RELIC_1_ID, bob, _emptyUintArray(0), _emptyUintArray(0));
//         assertEq(relic.blacklistedAccounts(bob), false);

//         // invalid param length
//         changePrank(bob);
//         amounts = new uint256[](3);
//         amounts[0] = amounts[1] = amounts[2] = 5;
//         vm.expectRevert(abi.encodeWithSelector(Relic.InvalidParamLength.selector));
//         relic.batchEquipShards(relicId, shardIds, amounts);

//         amounts = new uint256[](2);
//         amounts[0] = amounts[1] = 5;
//         shard.setApprovalForAll(address(relic), true);
//         relic.batchEquipShards(relicId, shardIds, amounts);

//         assertEq(shard.balanceOf(bob, SHARD_1_ID), shard1BalanceBefore-amounts[0]);
//         assertEq(shard.balanceOf(bob, SHARD_2_ID), shard2BalanceBefore-amounts[1]);
//     }

//     function test_batchUnequipShards() public {
//         uint256[] memory relicIds = relic.relicsOfOwner(bob);
//         uint256 relicId = relicIds[relicIds.length-1];
//         uint256[] memory shardIds = new uint256[](2);
//         uint256[] memory amounts = new uint256[](2);
//         uint256 shard1BalanceBefore = shard.balanceOf(bob, SHARD_1_ID);
//         uint256 shard2BalanceBefore = shard.balanceOf(bob, SHARD_2_ID);
//         amounts[0] = amounts[1] = 5;

//         vm.startPrank(alice);
//         vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
//         relic.batchUnequipShards(relicId, shardIds, amounts);

//         // test blacklist
//         {
//             shardIds[0] = SHARD_1_ID;
//             shardIds[1] = SHARD_2_ID;
//             changePrank(executor);
//             _blacklistAccount(true, false, RELIC_1_ID, bob, shardIds, amounts);
//             changePrank(bob);
//             vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.AccountBlacklisted.selector, bob));
//             relic.batchUnequipShards(relicId, shardIds, amounts);
//             // reset blacklist
//             changePrank(executor);
//             relic.setBlacklistAccount(bob, false, RELIC_1_ID, shardIds, amounts);
//             assertEq(relic.blacklistedAccounts(bob), false);
//         }
//         // invalid param length
//         {
//             changePrank(bob);
//             amounts = new uint256[](3);
//             amounts[0] = amounts[1] = amounts[2] = 5;
//             vm.expectRevert(abi.encodeWithSelector(Relic.InvalidParamLength.selector));
//             relic.batchUnequipShards(relicId, shardIds, amounts);
//         }
//         // insufficient shard balance
//         uint256 equippedAmount1;
//         uint256 equippedAmount2;
//         uint256 amount = 5;
//         amounts = new uint256[](2);
//         shard.setApprovalForAll(address(relic), true);
//         uint256[] memory amountsOne = new uint256[](1);
//         uint256[] memory shardsOne = new uint256[](1);
//         {
//             // relic.equipShard(relicId, SHARD_1_ID, amount);
//             amountsOne[0] = 5;
//             shardsOne[0] = SHARD_1_ID;
//             relic.batchEquipShards(relicId, shardsOne, amountsOne);
//             equippedAmount1 = relic.getEquippedShardAmount(relicId, SHARD_1_ID);
//             assertEq(equippedAmount1, amount + 5);

//             shardsOne[0] = SHARD_2_ID;
//             relic.batchEquipShards(relicId, shardsOne, amountsOne);
//             equippedAmount2 = relic.getEquippedShardAmount(relicId, SHARD_2_ID);
//             assertEq(equippedAmount2, amount + 5);
//             amounts[0] = 5;
//             amounts[1] = equippedAmount2 + 1;
//             vm.expectRevert(abi.encodeWithSelector(Relic.InsufficientShardBalance.selector, equippedAmount2, amounts[1]));
//             relic.batchUnequipShards(relicId, shardIds, amounts);
//         }

//         amounts[1] = equippedAmount2;
//         // shards are already equipped in relicId at this point
//         shard1BalanceBefore = shard.balanceOf(bob, SHARD_1_ID);
//         shard2BalanceBefore = shard.balanceOf(bob, SHARD_2_ID);
//         vm.expectEmit(address(relic));
//         emit ShardsUnequipped(bob, relicId, shardIds, amounts);
//         relic.batchUnequipShards(relicId, shardIds, amounts);

//         assertEq(shard.balanceOf(bob, SHARD_1_ID), shard1BalanceBefore + amounts[0]);
//         assertEq(shard.balanceOf(bob, SHARD_2_ID), shard2BalanceBefore + amounts[1]);

//     }

//     function test_recoverToken() public {
//         uint256 amount = 100 ether;
//         deal(address(dai), address(relic), amount, true);

//         vm.startPrank(executor);
//         vm.expectRevert(abi.encodeWithSelector(Relic.ZeroAddress.selector));
//         relic.recoverToken(address(dai), address(0), amount);
        
//         vm.expectEmit();
//         emit CommonEventsAndErrors.TokenRecovered(alice, address(dai), amount);
//         relic.recoverToken(address(dai), alice, amount);
//         assertEq(dai.balanceOf(alice), amount);
//         assertEq(dai.balanceOf(address(relic)), 0);
//     }

//     // burning adds no incentive per supply/demand
//     function test_burnBlacklistedAccountShards() public {
//         uint256[] memory shardIds = new uint256[](2);
//         shardIds[0] = SHARD_1_ID;
//         shardIds[1] = SHARD_2_ID;

//         vm.startPrank(executor);
//         vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
//         relic.burnBlacklistedAccountShards(alice, true, 0, shardIds);

//         // equip shards and blacklist an account
//         changePrank(operator);
//         uint256[] memory amounts = new uint256[](2);
//         amounts[0] = 2;
//         amounts[1] = 3;
//         uint256 relicId = _blacklistAccount(true, true, 0, alice, shardIds, amounts);
//         assertEq(relic.getEquippedShardAmount(relicId, shardIds[0]), amounts[0]);
//         assertEq(relic.getEquippedShardAmount(relicId, shardIds[1]), amounts[1]);
//         // invalid owner. bob is owner of relic Id 0
//         vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
//         relic.burnBlacklistedAccountShards(alice, true, 0, shardIds);
        
//         // invalid length
//         uint256[] memory invalidShardIds = new uint256[](0);
//         vm.expectRevert(abi.encodeWithSelector(Relic.InvalidParamLength.selector));
//         relic.burnBlacklistedAccountShards(alice, true, relicId, invalidShardIds);

//         uint256 relicShard1AmountBefore = shard.balanceOf(address(relic), shardIds[0]);
//         uint256 relicShard2AmountBefore = shard.balanceOf(address(relic), shardIds[1]);
//         uint256 relicShard3AmountBefore = shard.balanceOf(address(relic), SHARD_3_ID);
//         assertEq(relic.blacklistedAccounts(alice), true);
//         assertEq(relic.blacklistedAccountShards(alice, shardIds[0]), amounts[0]);
//         assertEq(relic.blacklistedAccountShards(alice, shardIds[1]), amounts[1]);

//         changePrank(executor);
//         relic.burnBlacklistedAccountShards(alice, true, relicId, shardIds);
//         assertEq(relic.blacklistedAccounts(alice), false);
//         assertEq(relic.blacklistedAccountShards(alice, shardIds[0]), 0);
//         assertEq(relic.blacklistedAccountShards(alice, shardIds[1]), 0);
//         assertEq(relic.getEquippedShardAmount(relicId, shardIds[0]), 0);
//         assertEq(relic.getEquippedShardAmount(relicId, shardIds[1]), 0);
//         assertEq(shard.balanceOf(address(relic), shardIds[0]), relicShard1AmountBefore - amounts[0]);
//         assertEq(shard.balanceOf(address(relic), shardIds[1]), relicShard2AmountBefore - amounts[1]);
//         assertEq(shard.balanceOf(address(relic), SHARD_3_ID), relicShard3AmountBefore);

//         // do not whitelist after burn
//         {
//             relicId = _blacklistAccount(true, true, 0, alice, shardIds, amounts);
//             assertEq(relic.blacklistedAccounts(alice), true);
//             relic.burnBlacklistedAccountShards(alice, false, relicId, shardIds);
//             assertEq(relic.blacklistedAccounts(alice), true);
//         }   
//     }

//     function test_beforeTokenTransfersBlacklisted() public {
//         // blacklist account 
//         uint256[] memory shardIds = new uint256[](2);
//         uint256[] memory amounts = new uint256[](2);
//         shardIds[0] = SHARD_2_ID;
//         shardIds[1] = SHARD_2_ID;
//         amounts[0] = 10;
//         amounts[1] = 20;
//         vm.startPrank(operator);
//         relic.mintRelic(alice, Relic.Enclave.Structure);
//         relic.mintRelic(alice, Relic.Enclave.Chaos);
//         uint256[] memory aliceRelics = relic.relicsOfOwner(alice);
//         uint256[] memory bobRelics = relic.relicsOfOwner(bob);
//         changePrank(executor);
//         // mint new relic for alice, equip shards and blacklist
//         uint256 aliceRelicId = _blacklistAccount(true, true, 0, alice, shardIds, amounts);

//         // sending from and to alice should fail
//         changePrank(alice);
//         vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.AccountBlacklisted.selector, alice));
//         relic.safeTransferFrom(alice, bob, aliceRelics[1]);
//         changePrank(bob);
//         vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.AccountBlacklisted.selector, alice));
//         relic.safeTransferFrom(bob, alice, bobRelics[0]);

//         // check new owner
//         changePrank(executor);
//         _blacklistAccount(false, false, aliceRelicId, alice, _emptyUintArray(0), _emptyUintArray(0));
//         changePrank(bob);
//         relic.safeTransferFrom(bob, alice, bobRelics[0]);
//         assertEq(relic.ownerOf(bobRelics[0]), alice);
//     }

//     function test_checkpointRelicRarity() public {
//         vm.startPrank(executor);
//         vm.expectRevert(abi.encodeWithSelector(Relic.InvalidRelic.selector, 100));
//         relic.checkpointRelicRarity(100);
//         uint256 relicId = relic.nextTokenId() - 1;
//         relic.checkpointRelicRarity(relicId);
//         (, Relic.Rarity rarity, uint128 xp) = relic.relicInfos(relicId);
//         assertEq(xp, 0);
//         _setRarityThresholds();
//         relic.setRelicXP(relicId, 10);
//         relic.checkpointRelicRarity(relicId);
//         (, rarity, xp) = relic.relicInfos(relicId);
//         assertEq(xp, 10);
//         assertEq(uint8(rarity), uint8(Relic.Rarity.Uncommon));
//         relic.setRelicXP(relicId, 31);
//         // no checkpoint
//         assertEq(uint8(rarity), uint8(Relic.Rarity.Uncommon));
//         relic.checkpointRelicRarity(relicId);
//         (, rarity, xp) = relic.relicInfos(relicId);
//         assertEq(uint8(rarity), uint8(Relic.Rarity.Rare));
//         relic.setRelicXP(relicId, 78);
//         // no checkpoint
//         (, rarity, xp) = relic.relicInfos(relicId);
//         assertEq(uint8(rarity), uint8(Relic.Rarity.Epic));
//         relic.setRelicXP(relicId, 101);
//         (, rarity, xp) = relic.relicInfos(relicId);
//         assertEq(uint8(rarity), uint8(Relic.Rarity.Legendary));
//     }

//     function test_supportsInterface() public {
//         assertEq(relic.supportsInterface(0x01ffc9a7), true); // ERC165 interface ID for ERC165.
//         assertEq(relic.supportsInterface(0x80ac58cd), true); // ERC165 interface ID for ERC721.
//         assertEq(relic.supportsInterface(0x5b5e139f), true); // ERC165 interface ID for ERC721Metadata.
//     }
// }