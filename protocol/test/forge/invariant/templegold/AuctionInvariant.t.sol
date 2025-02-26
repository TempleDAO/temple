pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// (tests/forge/templegold/invariant/AuctionInvariant.t.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { BaseInvariantTest } from "./BaseInvariant.t.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";
import { GoldAuctionHandler } from "./handlers/GoldAuctionHandler.sol";
import { TempleGold } from "contracts/templegold/TempleGold.sol";
import { StableGoldAuction } from "contracts/templegold/StableGoldAuction.sol";
import { ITempleGold } from "contracts/interfaces/templegold/ITempleGold.sol";
import { IAuctionBase } from "contracts/interfaces/templegold/IAuctionBase.sol";
import { IStableGoldAuction } from "contracts/interfaces/templegold/IStableGoldAuction.sol";
import { TempleGoldStaking } from "contracts/templegold/TempleGoldStaking.sol";
import { console } from "forge-std/console.sol";

contract AuctionInvariantTest is BaseInvariantTest {
    GoldAuctionHandler public handler;

    TempleGold public templeGold;
    StableGoldAuction public auction;
    IERC20 public bidToken;
    FakeERC20 public templeToken;
    TempleGoldStaking public staking;

    uint256 public arbitrumOneForkId;

    uint64 public constant AUCTION_DURATION = 1 weeks;
    uint32 public constant AUCTIONS_TIME_DIFF_ONE = 2 weeks;
    uint32 public constant AUCTIONS_START_COOLDOWN_ONE = 1 hours;
    uint192 public constant AUCTION_MIN_DISTRIBUTED_GOLD_ONE = 1_000;

    function setUp() public override {
        BaseInvariantTest.setUp();
        arbitrumOneForkId = fork("arbitrum_one");
        
        // templeToken = new FakeERC20("Temple Token", "TEMPLE", executor, 1000 ether);
        ITempleGold.InitArgs memory initArgs = _getTempleGoldInitArgs();
        templeGold = new TempleGold(initArgs);
        bidToken = IERC20(daiToken);
        auction = new StableGoldAuction(
            address(templeGold),
            address(bidToken),
            treasury,
            rescuer,
            executor,
            executor
        );
        templeToken = new FakeERC20("Temple Token", "TEMPLE", executor, 1000 ether);
        staking = new TempleGoldStaking(rescuer, executor, address(templeToken), address(templeGold));
        _configureTempleGold();
        _startAuction();
        handler = new GoldAuctionHandler(
            timestampStore, stateStore,
            address(auction), address(daiToken),
            address(templeGold)
        );
        vm.label({ account: address(handler), newLabel: "AuctionHandler" });

        bytes4[] memory fnSelectors = new bytes4[](1);
        fnSelectors[0] = GoldAuctionHandler.bid.selector;
        // fnSelectors[1] = StakingHandler.claim.selector;
        targetSelectors(
            address(handler),
            fnSelectors
        );

        targetSender(alice);
    }

   function _getAuctionConfig() internal pure returns (IStableGoldAuction.AuctionConfig memory config) {
        config.auctionsTimeDiff = AUCTIONS_TIME_DIFF_ONE;
        config.auctionStartCooldown = AUCTIONS_START_COOLDOWN_ONE;
        config.auctionMinimumDistributedGold = AUCTION_MIN_DISTRIBUTED_GOLD_ONE;
    }

    function _configureTempleGold() private {
        vm.startPrank(executor);
        templeGold.setStableGoldAuction(address(auction));
        ITempleGold.DistributionParams memory params;
        params.auction = 70 ether;
        params.gnosis = 15 ether;
        params.staking = 15 ether;
        templeGold.setDistributionParams(params);
        ITempleGold.VestingFactor memory factor;
        factor.value = 35;
        factor.weekMultiplier = 1 weeks;
        templeGold.setVestingFactor(factor);
        templeGold.setStaking(address(staking));
        templeGold.setTeamGnosis(teamGnosis);
        // whitelist
        templeGold.authorizeContract(address(auction), true);
        templeGold.authorizeContract(address(staking), true);
        templeGold.authorizeContract(teamGnosis, true);
        vm.stopPrank();
    }

    function _startAuction() internal {
        vm.startPrank(executor);
        uint256 currentEpoch = auction.currentEpoch();
        IStableGoldAuction.AuctionConfig memory config = auction.getAuctionConfig();
        IAuctionBase.EpochInfo memory info;
        if (currentEpoch == 0) {
            vm.warp(block.timestamp + 1 weeks);
        } else {
            info = auction.getEpochInfo(currentEpoch);
            vm.warp(info.endTime + config.auctionsTimeDiff);
        }
        // set auction config if not set
        if (config.auctionMinimumDistributedGold == 0) {
            auction.setAuctionConfig(_getAuctionConfig());
        }
        templeGold.mint();
        auction.setAuctionStarter(address(0));
        auction.startAuction();
        info = auction.getEpochInfo(auction.currentEpoch());
        vm.warp(info.startTime);
        vm.stopPrank();
    }

    function invariant_total_bids() public view {
        uint256 currentEpoch = auction.currentEpoch();
        IAuctionBase.EpochInfo memory info = auction.getEpochInfo(currentEpoch);
        // checking recipient address of bids
        uint256 balance = bidToken.balanceOf(auction.treasury());
        assertEq(
            info.totalBidTokenAmount,
            balance,
            "Invariant violation: Bid token amount not equal to balance"
        );
    }

    // function invariant_total_claims() public {
    //     uint256 currentEpoch = auction.currentEpoch();
    //     IAuctionBase.EpochInfo memory info = auction.getEpochInfo(currentEpoch);
    //     uint256 aliceBalance = templeGold.balanceOf(alice);
    //     if (!auction.claimed(msg.sender, currentEpoch)) {
    //         assertGt(
    //             templeGold.balanceOf(address(auction)),
    //             aliceBalance,
    //             "Invariant Violation"
    //         );
    //     }
    //     assertEq(
    //         aliceBalance,
    //         info.totalAuctionTokenAmount,
    //         "Invariant Violation: wrong claim balance"
    //     );
    // }

    function afterInvariant() external view {
        console.log("totalCalls: gold auction handler:", handler.totalCalls());
        console.log("\tauctionHandler.bid:", handler.calls(GoldAuctionHandler.bid.selector));
    }
}