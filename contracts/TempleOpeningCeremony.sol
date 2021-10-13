pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * Temple opening ceremony contract
 */
contract TempleOpeningCeremony is Ownable {

    struct TempleOpeningCeremonyTemplarData {
        // data version so dapps can map the data field
        string version;
        // templar data as JSON.stringify
        string data;
    }

    // opening ceremony data from a templar
    mapping(address => TempleOpeningCeremonyTemplarData) public dataOf;

    // use to update data for a templar
    function setData(address templar, string memory version, string memory data) external onlyOwner {
        dataOf[templar].version = version;
        dataOf[templar].data = data;
    }
}
