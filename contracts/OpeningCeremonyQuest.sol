pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * Temple opening ceremony contract
 */
contract OpeningCeremonyQuest is Ownable {

    struct QuestData {
        // data version so dapps can map the data field
        uint256 version;
        // templar data as JSON.stringify
        string data;
    }

    // opening ceremony data from a templar
    mapping(address => QuestData) public dataOf;

    // use to update data for a templar
    function setData(address templar, uint256 version, string memory data) external onlyOwner {
        dataOf[templar].version = version;
        dataOf[templar].data = data;
    }
}
