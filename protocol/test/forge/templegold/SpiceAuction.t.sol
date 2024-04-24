pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// (tests/forge/templegold/SpiceAuction.t.sol)

import { TempleTest } from "../TempleTest.sol";
import { ISpiceAuction } from "contracts/interfaces/templegold/ISpiceAuction.sol";

contract SpiceAuctionTestBase is TempleTest {
    event AuctionConfigSet(uint256 epoch, ISpiceAuction.SpiceAuctionConfig config);
    event AuctionConfigRemoved(uint256 epochId);

    /// @notice Auctions run for minimum 1 week
    uint32 public constant MINIMUM_AUCTION_PERIOD = 604_800;

    function setUp() public {

    }

}