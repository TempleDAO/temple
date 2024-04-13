pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/governance/Util.sol)


import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";


contract Util {

}

contract DSNote {
    event LogNote(
        bytes4   indexed  sig,
        address  indexed  guy,
        bytes32  indexed  foo,
        bytes32  indexed  bar,
        uint256           wad,
        bytes             fax
    ) anonymous;

    modifier note {
        bytes32 foo;
        bytes32 bar;
        uint256 wad;

        assembly {
            foo := calldataload(4)
            bar := calldataload(36)
            wad := callvalue()
        }

        _;

        emit LogNote(msg.sig, msg.sender, foo, bar, wad, msg.data);
    }
}

contract DSThing is TempleElevatedAccess, DSNote {

    constructor(address _rescuer, address _executor) TempleElevatedAccess(_rescuer, _executor) {}
    // solhint-ignroe-var-name-mixedcase
    function S(string memory s) internal pure returns (bytes4) {
        return bytes4(keccak256(abi.encodePacked(s)));
    }
}

