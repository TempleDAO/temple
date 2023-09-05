pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (nexus/IRelic.sol)

import { IERC721A } from "./IERC721A.sol";

interface IRelic {
    enum Rarity {
        Common,
        Uncommon,
        Rare,
        Epic,
        Legendary
    }

    enum Enclave {
        Chaos,
        Mystery,
        Logic,
        Order,
        Structure
    }

    struct RelicInfo {
        Enclave enclave;
        Rarity rarity;
        uint128 xp;
        /// @notice shards equipped to this contract. can extract owner of relic from ownerOf(relicId)
        mapping(uint256 => uint256) equippedShards;
    }

    function balanceOf(address owner) external view returns (uint256);
    function ownerOf(uint256 tokenId) external view returns (address);
    function setShard(address _shard) external;
    function setXPRarityThreshold(Rarity rarity, uint256 threshold) external;
    function setRelicMinter(address minter, bool allow) external;
    function setXPController(address controller, bool flag) external;
    function setXPRarityThresholds(
        Rarity[] calldata rarities,
        uint256[] calldata thresholds
    ) external;
    function setBaseUriRarity(Rarity rarity, string memory uri) external;
    function setBlacklistAccount(
        address account,
        bool blacklist,
        uint256[] memory shardIds,
        uint256[] memory amounts
    ) external;
    function setRelicXP(uint256 relicId, uint256 xp) external;
    function burnShards(uint256[] memory shardIds, uint256[] memory amounts) external;
    function relicsOfOwner(address _owner) external view returns (uint256[] memory ownerRelics);
    function getBalanceBatch(
        uint256 relicId,
        uint256[] memory shardIds
    ) external view returns(uint256[] memory balances);
    function getBaseUriRarity(Rarity rarity) external view returns (string memory uri);
    function mintRelic(address to, Enclave enclave) external;
    function equipShard(
        uint256 relicId,
        uint256 shardId,
        uint256 amount
    ) external;
    function batchEquipShards(
        uint256 relicId,
        uint256[] memory shardIds,
        uint256[] memory amounts
    ) external;
    function unequipShard(
        uint256 relicId,
        uint256 shardId,
        uint256 amount
    ) external;
    function batchUnequipShards(
        uint256 relicId,
        uint256[] memory shardIds,
        uint256[] memory amounts
    ) external;
    function totalMinted() external view returns (uint256);
    function recoverToken(address token, address to, uint256 amount) external ;
    function recoverNFT(IERC721A nft, address to, uint256 tokenId) external;
    function burnBlacklistedAccountShards(
        address account,
        bool whitelistAfterBurn,
        uint256[] memory shardIds
    ) external;
    function getRarityBaseUri(Rarity rarity) external view returns(string memory uri);
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
    function blacklistedAccounts(address account) external view returns (bool);
}