pragma solidity 0.8.10;

import {DSTest} from "ds-test/test.sol";
import {Hevm} from "./HEVM.t.sol";

contract TempleTest is DSTest {
    Hevm internal constant vm = Hevm(HEVM_ADDRESS);

    function assertFalse(bool data) internal virtual {
        assertTrue(!data);
    }
}