pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// (tests/forge/templegold/invariant/GoldAuctionHandler.sol)

import { BaseHandler } from "./BaseHandler.sol";
import { IStableGoldAuction } from "contracts/interfaces/templegold/IStableGoldAuction.sol";
import { IAuctionBase } from "contracts/interfaces/templegold/IAuctionBase.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { TimestampStore } from "test/forge/invariant/templegold/stores/TimestampStore.sol";
import { StateStore } from "test/forge/invariant/templegold/stores/StateStore.sol";


contract GoldAuctionHandler is BaseHandler {
    IStableGoldAuction public auction;
    IERC20 public templeGold;
    IERC20 public stableToken;
    uint256 public totalBids;

    constructor(
        TimestampStore timestampStore_,
        StateStore stateStore_,
        address _auction,
        address _stableToken,
        address _templeGold
    )  BaseHandler(timestampStore_, stateStore_) {
        auction = IStableGoldAuction(_auction);
        stableToken = IERC20(_stableToken);
        templeGold = IERC20(_templeGold);
    }

    function bid(uint256 amount) external instrument useSender {
        amount = _bound(amount, 0, 10_000 ether);
        uint256 currentEpoch = auction.currentEpoch();
        IAuctionBase.EpochInfo memory info = auction.getEpochInfo(currentEpoch);
        uint256 bidsBefore = info.totalBidTokenAmount;
        deal(address(stableToken), msg.sender, amount, true);
        approve(address(stableToken), address(auction), amount);
        auction.bid(amount);
        totalBids += amount;
        assertGe(
            totalBids,
            bidsBefore,
            "Invariant violation: totalBids"
        );
    }

    function claim(uint256 jumpTime) external instrument useSender {
        // jump time
        vm.warp(block.timestamp+_bound(jumpTime, 0, 1 days));
        if (!auction.isCurrentEpochEnded()) {
            stateStore.setFinishedEarly();
            return;
        }
        uint256 currentEpoch = auction.currentEpoch();
        IAuctionBase.EpochInfo memory info = auction.getEpochInfo(currentEpoch);
        assertEq(
            info.totalAuctionTokenAmount,
            templeGold.balanceOf(msg.sender),
            "Invariant violation: claim"
        );
    }
}