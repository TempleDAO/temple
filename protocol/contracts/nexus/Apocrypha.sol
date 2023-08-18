//         __...--~~~~~-._   _.-~~~~~--...__
//        //               `V'               \\ 
//       //                 |                 \\ 
//      //__...--~~~~~~-._  |  _.-~~~~~~--...__\\ 
//     //__.....----~~~~._\ | /_.~~~~----.....__\\
//    ====================\\|//====================
//                        `---`
//
//                 Temple's Apocrypha

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IRelic {
    function balanceOf(address) external returns (uint256);

    function tokenOfOwnerByIndex(address, uint256) external returns (uint256);
}

interface IShards {
    function partnerMint(
        address account,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) external;
}

contract Apocrypha is Ownable {
    IShards private SHARDS;
    IRelic private RELIC;
    uint256 public SHARD_ID = 1;

    modifier canMint() {
        uint256 balance = RELIC.balanceOf(msg.sender);
        require(balance > 0, "You don't own a Relic");
        uint256 freeRelic = 100000;
        for (uint i = 0; i < balance; i++) {
            uint256 relicId = RELIC.tokenOfOwnerByIndex(msg.sender, i);
            if (!relicIdToMinted[relicId]) {
                freeRelic = relicId;
                break;
            }
        }
        require(freeRelic != 100000, "You already collected this Shard");
        relicIdToMinted[freeRelic] = true;
        _;
    }

    mapping(uint256 => bool) relicIdToMinted;

    function mintShard() external canMint {
        SHARDS.partnerMint(msg.sender, SHARD_ID, 1, "");
    }

    function setRelicShards(
        address _relic,
        address _shards
    ) external onlyOwner {
        RELIC = IRelic(_relic);
        SHARDS = IShards(_shards);
    }
}
