pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (tests/forge/nexus/NexusTestBase.t.sol)


import { TempleTest } from "../TempleTest.sol";
import { FakeERC20 } from "../../../contracts/fakes/FakeERC20.sol";
import { IRelic } from "../../../contracts/interfaces/nexus/IRelic.sol";

contract NexusTestBase is TempleTest {

    FakeERC20 public temple = new FakeERC20("TEMPLE", "TEMPLE", address(0), 0);
    FakeERC20 public dai = new FakeERC20("DAI", "DAI", address(0), 0);

    string internal constant NAME = "RELIC";
    string internal constant SYMBOL = "REL";
    string internal constant BASE_URI = "http://example.com/";

    uint256 internal constant RARITIES_COUNT = 0x05;
    uint256 internal constant ENCLAVES_COUNT = 0x05;
    uint256 internal constant PER_MINT_QUANTITY = 0x01;
    bytes internal constant ZERO_BYTES = "";

    uint256 internal constant SHARD_1_ID = 0x01;
    uint256 internal constant SHARD_2_ID = 0x02;
    uint256 internal constant SHARD_3_ID = 0x03;
    uint256 internal constant SHARD_4_ID = 0x04;
    uint256 internal constant SHARD_5_ID = 0x05;

    uint256 internal constant MYSTERY_ID = 0x01;
    uint256 internal constant CHAOS_ID = 0x02;
    uint256 internal constant ORDER_ID = 0x03;
    uint256 internal constant STRUCTURE_ID = 0x04;
    uint256 internal constant LOGIC_ID = 0x05;

    uint256 internal constant RECIPE_1_ID = 0x01; // 1
    uint256 internal constant RECIPE_2_ID = 0x02; // 2
    uint256 internal constant RECIPE_3_ID = 0x03; // 3

    uint256 internal constant RELIC_1_ID = 0x01;

    string internal constant SHARD_1_URI = "https://example1.com";
    string internal constant SHARD_2_URI = "https://example2.com";
    string internal constant SHARD_3_URI = "https://example3.com";
    string internal constant SHARD_4_URI = "https://example4.com";

    string internal constant MYSTERY = "MYSTERY";
    string internal constant CHAOS = "CHAOS";
    string internal constant ORDER = "ORDER";
    string internal constant STRUCTURE = "STRUCTURE";
    string internal constant LOGIC = "LOGIC";

    function _enableAllEnclavesForMinter(IRelic relic, address minter) internal {
        uint256[] memory enclaveIds = new uint256[](5);
        bool[] memory allow = new bool[](5);
        enclaveIds[0] = MYSTERY_ID;
        enclaveIds[1] = CHAOS_ID;
        enclaveIds[2] = STRUCTURE_ID;
        enclaveIds[3] = LOGIC_ID;
        enclaveIds[4] = ORDER_ID;
        allow[0] = allow[1] = allow[2] = allow[3] = allow[4] = true;
        relic.setRelicMinterEnclaveIds(minter, enclaveIds, allow);
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