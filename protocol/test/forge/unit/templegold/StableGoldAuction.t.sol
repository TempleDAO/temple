pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// (tests/forge/templegold/StableGoldAuction.t.sol)

import { TempleGoldCommon } from "./TempleGoldCommon.t.sol";
import { ITempleGold } from "contracts/interfaces/templegold/ITempleGold.sol";
import { TempleGold } from "contracts/templegold/TempleGold.sol";
import { IStableGoldAuction } from "contracts/interfaces/templegold/IStableGoldAuction.sol";
import { IAuctionBase } from "contracts/interfaces/templegold/IAuctionBase.sol";
import { StableGoldAuction } from "contracts/templegold/StableGoldAuction.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { ITempleERC20Token } from "contracts/interfaces/core/ITempleERC20Token.sol";
import { TempleGoldStaking } from "contracts/templegold/TempleGoldStaking.sol";
import { ITempleElevatedAccess } from "contracts/interfaces/v2/access/ITempleElevatedAccess.sol";

contract StableGoldAuctionTestBase is TempleGoldCommon {
    event AuctionStarted(uint256 epochId, address indexed starter, uint128 startTime, uint128 endTime, uint256 auctionTokenAmount);
    event BidTokenSet(address bidToken);
    event GoldDistributionNotified(uint256 amount, uint256 timestamp);
    event AuctionConfigSet(uint256 epochId, IStableGoldAuction.AuctionConfig config);
    event AuctionStarterSet(address indexed starter);
    event Deposit(address indexed depositor, uint256 epochId, uint256 amount);
    event Claim(address indexed user, uint256 epochId, uint256 bidTokenAmount, uint256 auctionTokenAmount);
    event TokenRecovered(address indexed to, address indexed token, uint256 amount);
    event TreasurySet(address treasury);

    /// @notice Auction duration
    uint64 public constant AUCTION_DURATION = 1 weeks;
    uint32 public constant AUCTIONS_TIME_DIFF_ONE = 1 weeks;
    uint32 public constant AUCTIONS_START_COOLDOWN_ONE = 1 hours;
    uint192 public constant AUCTION_MIN_DISTRIBUTED_GOLD_ONE = 1_000;
    
    address public templeToken = 0x470EBf5f030Ed85Fc1ed4C2d36B9DD02e77CF1b7;
    
    TempleGold public templeGold;
    IERC20 public bidToken;
    IERC20 public bidToken2;
    ITempleERC20Token public temple;
    StableGoldAuction public auction;
    TempleGoldStaking public goldStaking;

    function setUp() public {
        /// @dev forking for layerzero endpoint to execute code
        fork("arbitrum_one", 204026954);

        ITempleGold.InitArgs memory initArgs = _getTempleGoldInitArgs();

        templeGold = new TempleGold(initArgs);
        auction = new StableGoldAuction(
            address(templeGold),
            address(bidToken),
            treasury,
            rescuer,
            executor,
            executor
        );
        goldStaking = new TempleGoldStaking(
            rescuer, 
            executor,
            templeToken,
            address(templeGold)
        );
        bidToken = IERC20(daiToken); // dai
        bidToken2 = IERC20(usdcToken); //usdc
        temple = ITempleERC20Token(templeToken);

        vm.startPrank(executor);
        _configureTempleGold();
        deal(address(bidToken), executor, 100 ether, false);
        deal(address(bidToken), alice, 100 ether, false);

        vm.stopPrank();
    }

    function _configureTempleGold() private {
        templeGold.setStableGoldAuction(address(auction));
        auction.setBidToken(address(bidToken));
        ITempleGold.DistributionParams memory params;
        params.auction = 60 ether;
        params.gnosis = 10 ether;
        params.staking = 30 ether;
        templeGold.setDistributionParams(params);
        ITempleGold.VestingFactor memory factor;
        factor.value = 2 ether;
        factor.weekMultiplier = 1000 ether;
        templeGold.setVestingFactor(factor);
        templeGold.setStaking(address(goldStaking));
        templeGold.setTeamGnosis(address(teamGnosis));
        // whitelist
        templeGold.authorizeContract(address(auction), true);
        templeGold.authorizeContract(address(goldStaking), true);
        templeGold.authorizeContract(teamGnosis, true);
    }

    function test_initialization() public view {
        assertEq(address(templeGold), address(auction.templeGold()));
        assertEq(rescuer, auction.rescuer());
        assertEq(executor, auction.executor());
        assertEq(treasury, auction.treasury());
        assertEq(address(bidToken), address(auction.bidToken()));
    }

    function _getAuctionConfig() internal pure returns (IStableGoldAuction.AuctionConfig memory config) {
        config.auctionsTimeDiff = AUCTIONS_TIME_DIFF_ONE;
        config.auctionStartCooldown = AUCTIONS_START_COOLDOWN_ONE;
        config.auctionMinimumDistributedGold = AUCTION_MIN_DISTRIBUTED_GOLD_ONE;
    }

    function _startAuction() internal {
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
    }
}

contract StableGoldAuctionTestAccess is StableGoldAuctionTestBase {

    function test_access_setAuctionConfigFail() public {
        vm.startPrank(unauthorizedUser);
        IStableGoldAuction.AuctionConfig memory config = _getAuctionConfig();
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        auction.setAuctionConfig(config);
    }
    function test_access_setAuctionStarterFail() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        auction.setAuctionStarter(unauthorizedUser);
    }

    function test_access_setBidTokenFail() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        auction.setBidToken(address(templeGold));
    }

    function test_access_setTreasury_auction_fail() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        auction.setTreasury(alice);
    }

    function test_access_setAuctionConfigSuccess() public {
        vm.startPrank(executor);
        IStableGoldAuction.AuctionConfig memory config = _getAuctionConfig();
        auction.setAuctionConfig(config);
    }

    function test_access_setAuctionStarterSuccess() public {
        vm.startPrank(executor);
        auction.setAuctionStarter(alice);
    }

    function test_access_setBidTokenSuccess() public {
        vm.startPrank(executor);
        auction.setBidToken(address(bidToken));
    }

    function test_access_setTreasury_auction_success() public {
        vm.startPrank(executor);
        auction.setTreasury(alice);
    }
}

contract StableGoldAuctionTestSetters is StableGoldAuctionTestBase {

    function test_setTreasury() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        auction.setTreasury(address(0));

        vm.expectEmit(address(auction));
        emit TreasurySet(bob);
        auction.setTreasury(bob);
        assertEq(auction.treasury(), bob);
    }

    function test_setAuctionConfig() public {
        vm.startPrank(executor);
        IStableGoldAuction.AuctionConfig memory fakeConfig;
        fakeConfig.auctionStartCooldown = 100;
        // config.auctionMinimumDistributedGold = 0 error
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        auction.setAuctionConfig(fakeConfig);
        fakeConfig.auctionMinimumDistributedGold = 1000;
        // config.auctionsTimeDiff = 0 error
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        auction.setAuctionConfig(fakeConfig);
        fakeConfig.auctionsTimeDiff = 1;
        vm.expectEmit(address(auction));
        uint256 currentEpochId = auction.currentEpoch();
        emit AuctionConfigSet(currentEpochId, fakeConfig);
        auction.setAuctionConfig(fakeConfig);

        IStableGoldAuction.AuctionConfig memory config = auction.getAuctionConfig();
        assertEq(config.auctionsTimeDiff, 1);
        assertEq(config.auctionStartCooldown, 100);
        assertEq(config.auctionMinimumDistributedGold, 1000);

        // auction started
        ITempleGold.VestingFactor memory _factor;
        _factor.value = 35;
        _factor.weekMultiplier = 1 weeks;
        templeGold.setVestingFactor(_factor);
        skip(3 days);
        templeGold.mint();
        _startAuction();
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.InvalidOperation.selector));
        auction.setAuctionConfig(config);
    }

    function test_setAuctionStarter() public {
        vm.startPrank(executor);
        // address zero error
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        auction.setBidToken(address(0));

        vm.expectEmit(address(auction));
        emit AuctionStarterSet(alice);
        auction.setAuctionStarter(alice);

        assertEq(auction.auctionStarter(), alice);

        // auction started
        _setVestingFactor(templeGold);
        vm.startPrank(executor);
        _startAuction();
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.InvalidOperation.selector));
        auction.setBidToken(alice);
    }

     function test_setBidToken() public {
        _setVestingFactor(templeGold);
        vm.startPrank(executor);

        vm.expectEmit(address(auction));
        emit BidTokenSet(usdcToken);
        auction.setBidToken(usdcToken);

        assertEq(address(auction.bidToken()), usdcToken);

        // auction started
        _setVestingFactor(templeGold);
        vm.startPrank(executor);
        _startAuction();
        // epoch not ended
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.InvalidOperation.selector));
        auction.setBidToken(alice);
    }
}

contract StableGoldAuctionTestView is StableGoldAuctionTestBase {
    function test_getClaimableAtEpoch() public {
        vm.warp(block.timestamp + 3 weeks);
        _setVestingFactor(templeGold);
        vm.startPrank(executor);
        _startAuction();

        templeGold.mint();

        vm.startPrank(alice);
        bidToken.approve(address(auction), type(uint).max);
        auction.bid(50 ether);
        vm.startPrank(executor);
        bidToken.approve(address(auction), type(uint).max);
        auction.bid(100 ether);
        uint256 currentEpoch = auction.currentEpoch();
        IAuctionBase.EpochInfo memory info = auction.getEpochInfo(currentEpoch);
        uint256 totalRewards = info.totalAuctionTokenAmount;
        uint256 aliceClaimable = (50 ether * totalRewards) / 150 ether;
        uint256 executorClaimable = (100 ether * totalRewards) / 150 ether;
        
        assertEq(auction.getClaimableAtEpoch(alice, currentEpoch), aliceClaimable);
        assertEq(auction.getClaimableAtEpoch(executor, currentEpoch), executorClaimable);
        // rounding down change by 1
        assertApproxEqAbs(totalRewards, executorClaimable+aliceClaimable, 1);
    }

    function test_getAuctionConfig() public {
        /// @dev See test_setAuctionConfig()
    }

    function test_nextEpoch() public view {
        uint256 currentEpoch = auction.currentEpoch();
        assertEq(auction.nextEpoch(), currentEpoch+1);
    }

    function test_isCurrentEpochEnded() public {
        _setVestingFactor(templeGold);
        vm.startPrank(executor);
        _startAuction();
        vm.warp(block.timestamp + 6 days);
        assertEq(auction.isCurrentEpochEnded(), false);
        vm.warp(block.timestamp + 1 days + 1 seconds);
        assertEq(auction.isCurrentEpochEnded(), true);
    }

    function test_canDeposit() public {
        _setVestingFactor(templeGold);
        vm.startPrank(executor);
        _startAuction();
        IAuctionBase.EpochInfo memory info = auction.getEpochInfo(auction.currentEpoch());
        vm.warp(info.endTime - 1);
        assertEq(auction.canDeposit(), true);
        vm.warp(info.endTime);
        assertEq(auction.canDeposit(), false);
        vm.warp(info.endTime+1);
        assertEq(auction.canDeposit(), false);
    }
}

contract StableGoldAuctionTest is StableGoldAuctionTestBase {

    function test_startAuction_dai_gold_auction() public {
        // auctionStarter == address(0). anyone can call
        vm.startPrank(executor);
        auction.setAuctionStarter(address(0));
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        auction.startAuction();

        _setVestingFactor(templeGold);
        vm.startPrank(executor);
        auction.setAuctionStarter(alice);
        // auction starter != adderss(0) and caller is not auction starter
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        auction.startAuction();

        // auctionStarter == address(0). anyone can call
        vm.startPrank(executor);
        auction.setAuctionStarter(address(0));
        IStableGoldAuction.AuctionConfig memory _config = _getAuctionConfig();
        auction.setAuctionConfig(_config);

        // distribute some TGLD
        skip(1 days);
        templeGold.mint();
        
        uint128 startTime = uint128(block.timestamp + _config.auctionStartCooldown);
        uint128 endTime = startTime + uint128(1 weeks);
        uint256 goldAmount = auction.nextAuctionGoldAmount();
        vm.expectEmit(address(auction));
        emit AuctionStarted(1, executor, startTime, endTime, goldAmount);
        auction.startAuction();

        IStableGoldAuction.EpochInfo memory epochInfo = auction.getEpochInfo(1);
        assertEq(auction.currentEpoch(), 1);
        assertEq(epochInfo.startTime, startTime);
        assertEq(epochInfo.endTime, endTime);
        assertEq(epochInfo.totalBidTokenAmount, 0);
        assertEq(epochInfo.totalAuctionTokenAmount, goldAmount);

        // test is current epoch ended
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.CannotStartAuction.selector));
        auction.startAuction();

        // test CannotStartAuction
        // warp to auction end time
        vm.warp(epochInfo.endTime+_config.auctionsTimeDiff-1);
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.CannotStartAuction.selector));
        auction.startAuction();

        vm.warp(epochInfo.endTime+_config.auctionsTimeDiff);

        // distribute gold and start second auction
        templeGold.mint();
        startTime = uint128(block.timestamp + _config.auctionStartCooldown);
        endTime = startTime + uint128(1 weeks);
        goldAmount = auction.nextAuctionGoldAmount();
        vm.expectEmit(address(auction));
        emit AuctionStarted(2, executor, startTime, endTime, goldAmount);
        auction.startAuction();

        epochInfo = auction.getEpochInfo(2);
        assertEq(auction.currentEpoch(), 2);
        assertEq(epochInfo.startTime, startTime);
        assertEq(epochInfo.endTime, endTime);
        assertEq(epochInfo.totalBidTokenAmount, 0);
        assertEq(epochInfo.totalAuctionTokenAmount, goldAmount);
        assertEq(auction.epochGoldSupply(2), epochInfo.totalAuctionTokenAmount);

        // low TGLD distribution error
        vm.startPrank(executor);
        ITempleGold.DistributionParams memory _params = _getDistributionParameters();
        _params.auction = 0;
        _params.staking = 80 ether;
        _params.gnosis = 20 ether;
        // update so dai gold auction gets nothing
        templeGold.setDistributionParams(_params);
        vm.warp(epochInfo.endTime + _config.auctionsTimeDiff);
        auction.isCurrentEpochEnded();
        vm.expectRevert(abi.encodeWithSelector(IStableGoldAuction.LowGoldDistributed.selector, 0));
        auction.startAuction();

    }

    function test_bid_daiGold() public {
        // onlyt when live error. 
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.CannotDeposit.selector));
        auction.bid(0);

        _setVestingFactor(templeGold);
        vm.startPrank(executor);
        _startAuction();
        // zero amount error
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        auction.bid(0);

        // if auction ended
        uint256 currentEpoch = auction.currentEpoch();
        IAuctionBase.EpochInfo memory epochInfo = auction.getEpochInfo(currentEpoch);
        vm.warp(epochInfo.endTime);
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.CannotDeposit.selector));
        auction.bid(100 ether);

        uint256 goldBalanceBefore = templeGold.balanceOf(address(auction));
        vm.warp(epochInfo.startTime);
        
        currentEpoch = auction.currentEpoch();
        bidToken.approve(address(auction), type(uint).max);
        vm.expectEmit(address(auction));
        emit Deposit(executor, currentEpoch, 100 ether);
        auction.bid(100 ether);

        epochInfo = auction.getEpochInfo(currentEpoch);
        assertEq(auction.depositors(executor, currentEpoch), 100 ether);
        assertEq(epochInfo.totalBidTokenAmount, 100 ether);
        assertEq(bidToken.balanceOf(treasury), 100 ether);

        uint256 goldBalanceAfter = templeGold.balanceOf(address(auction));
        assertEq(goldBalanceAfter, goldBalanceBefore);

        // second deposits
        vm.startPrank(alice);
        bidToken.approve(address(auction), type(uint).max);
        vm.expectEmit(address(auction));
        emit Deposit(alice, currentEpoch, 50 ether);
        auction.bid(50 ether);

        epochInfo = auction.getEpochInfo(currentEpoch);
        assertEq(auction.depositors(alice, currentEpoch), 50 ether);
        assertEq(epochInfo.totalBidTokenAmount, 150 ether);
        assertEq(bidToken.balanceOf(treasury), 150 ether);

        // bidToken amount = 0
        assertEq(auction.getClaimableAtEpoch(unauthorizedUser, currentEpoch), 0);
        // invalid epoch
        assertEq(auction.getClaimableAtEpoch(unauthorizedUser, currentEpoch+1), 0);
    }

    function test_claim_daiGold() public {
        _setVestingFactor(templeGold);
        skip(1 days);
        vm.startPrank(executor);
        _startAuction();
        
        // deposits
        vm.startPrank(alice);
        bidToken.approve(address(auction), type(uint).max);
        auction.bid(50 ether);
        vm.startPrank(executor);
        bidToken.approve(address(auction), type(uint).max);
        auction.bid(100 ether);

        // cannot claim for current epoch
        uint256 currentEpoch = auction.currentEpoch();
        IAuctionBase.EpochInfo memory info = auction.getEpochInfo(currentEpoch);
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.CannotClaim.selector, currentEpoch));
        auction.claim(currentEpoch);
        // cannot claim for not started (cooldown time)
        vm.warp(info.startTime - 1 seconds);
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.CannotClaim.selector, currentEpoch));
        auction.claim(currentEpoch);
        // cannot claim when active
        vm.warp(info.startTime);
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.CannotClaim.selector, currentEpoch));
        auction.claim(currentEpoch);
        // invalid epoch error
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.InvalidEpoch.selector));
        auction.claim(currentEpoch+1);

        vm.warp(info.endTime);
        // bob cannot claim for 0 deposits
        vm.startPrank(bob);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        auction.claim(currentEpoch);

        // valid claims
        uint256 aliceRewardBalanceBefore = templeGold.balanceOf(alice);
        uint256 executorRewardBalanceBefore = templeGold.balanceOf(executor);
        uint256 executorClaimable = auction.getClaimableAtCurrentEpoch(executor);
        uint256 aliceClaimable = auction.getClaimableAtCurrentEpoch(alice);
        vm.startPrank(alice);
        vm.expectEmit(address(auction));
        emit Claim(alice, currentEpoch, 50 ether, aliceClaimable);
        auction.claim(currentEpoch);
        vm.startPrank(executor);
        vm.expectEmit(address(auction));
        emit Claim(executor, currentEpoch, 100 ether, executorClaimable);
        auction.claim(currentEpoch);

        uint256 aliceRewardBalanceAfter= templeGold.balanceOf(alice);
        uint256 executorRewardBalanceAfter = templeGold.balanceOf(executor);
        IAuctionBase.EpochInfo memory epochInfo = auction.getEpochInfo(currentEpoch);
        assertEq(executorClaimable+aliceClaimable, epochInfo.totalAuctionTokenAmount);
        assertEq(aliceRewardBalanceAfter, aliceRewardBalanceBefore+aliceClaimable);
        assertEq(executorRewardBalanceAfter, executorRewardBalanceBefore+executorClaimable);
        assertEq(auction.claimedAmount(alice, currentEpoch), aliceClaimable);
        assertEq(auction.claimedAmount(executor, currentEpoch), executorClaimable);
        assertEq(auction.claimed(alice, currentEpoch), true);
        assertEq(auction.claimed(executor, currentEpoch), true);

        // try to claim again
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.AlreadyClaimed.selector));
        auction.claim(currentEpoch);
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.AlreadyClaimed.selector));
        auction.claim(currentEpoch);
        vm.startPrank(executor);
        
        // start another auction but check claimable diffs when another user deposits additionally
        skip(1 days);
        _startAuction();
        currentEpoch = auction.currentEpoch();
        info = auction.getEpochInfo(currentEpoch);
        vm.warp(info.startTime);
        deal(address(bidToken), alice, 100 ether, false);
        deal(address(bidToken), executor, 100 ether, false);
        vm.startPrank(alice);
        bidToken.approve(address(auction), type(uint).max);
        auction.bid(100 ether);
        vm.startPrank(executor);
        bidToken.approve(address(auction), type(uint).max);
        auction.bid(100 ether);
        executorClaimable = auction.getClaimableAtCurrentEpoch(executor);
        aliceClaimable = auction.getClaimableAtCurrentEpoch(alice);
        deal(address(bidToken), bob, 100 ether, false);
        vm.startPrank(bob);
        bidToken.approve(address(auction), type(uint).max);
        auction.bid(100 ether);
        assertGt(aliceClaimable, auction.getClaimableAtCurrentEpoch(alice));
        assertGt(executorClaimable, auction.getClaimableAtCurrentEpoch(executor));
    }

    function test_notifyDistribution() public {
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        auction.notifyDistribution(100 ether);

        uint256 nextGoldAmount = auction.nextAuctionGoldAmount();
        vm.warp(block.timestamp + 1 weeks);
        uint256 mintAmount = templeGold.getMintAmount();
        ITempleGold.DistributionParams memory dp = templeGold.getDistributionParameters();
        uint256 auctionAmount = dp.auction * mintAmount / 100 ether;
        templeGold.mint();
        assertEq(auction.nextAuctionGoldAmount(), nextGoldAmount+auctionAmount);
    }

    function test_distributeGold() public {
        _setVestingFactor(templeGold);
        skip(1 days);
        uint256 goldBalance = templeGold.balanceOf(address(auction));
        auction.distributeGold();
        assertGt(templeGold.balanceOf(address(auction)), goldBalance);
    }

    function test_recoverToken_daiGold() public {
        _setVestingFactor(templeGold);
        skip(1 days);
        vm.startPrank(executor);
        // revert, invalid params
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        auction.recoverToken(address(temple), address(0), 0);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        auction.recoverToken(address(temple), alice, 0);

        uint256 sendAmount = 50 ether;
        deal(address(bidToken), address(auction), sendAmount, false);

        uint256 aliceBalance = bidToken.balanceOf(alice);
        vm.expectEmit(address(auction));
        emit TokenRecovered(alice, address(bidToken), sendAmount);
        auction.recoverToken(address(bidToken), alice, sendAmount);
        assertEq(bidToken.balanceOf(alice), aliceBalance+sendAmount);
        assertEq(auction.nextAuctionGoldAmount(), 0);

        // currentEpochId = 0
        templeGold.mint();
        uint256 mintAmount = templeGold.balanceOf(address(auction));
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.InvalidOperation.selector));
        auction.recoverToken(address(templeGold), alice, mintAmount);

        IStableGoldAuction.AuctionConfig memory _config = _getAuctionConfig();
        auction.setAuctionConfig(_config);
        _startAuction();
        IAuctionBase.EpochInfo memory info = auction.getEpochInfo(1);
        vm.warp(info.startTime);
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.AuctionActive.selector));
        auction.recoverToken(address(templeGold), alice, mintAmount);

        vm.warp(info.endTime);
        templeGold.mint();
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.AuctionEnded.selector));
        auction.recoverToken(address(templeGold), alice, mintAmount);

        vm.warp(info.startTime - 10 seconds);
        mintAmount = templeGold.balanceOf(address(auction));
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAmount.selector, address(templeGold), mintAmount+1));
        auction.recoverToken(address(templeGold), alice, mintAmount+1);

        // there was distribution after calling `templeGold.mint()`. nextAuctionGoldAmount > 0
        // recover half of total auction amount
        aliceBalance = templeGold.balanceOf(alice);
        uint256 recoverAmount = info.totalAuctionTokenAmount / 2;
        uint256 nextAuctionGoldAmount = auction.nextAuctionGoldAmount();
        vm.expectEmit(address(auction));
        emit TokenRecovered(alice, address(templeGold), recoverAmount);
        auction.recoverToken(address(templeGold), alice, recoverAmount);
        assertEq(templeGold.balanceOf(alice), aliceBalance+recoverAmount);
        // plus the half of total auction amount that was not recovered
        // delta of 1 because of rounding
        assertApproxEqAbs(nextAuctionGoldAmount + recoverAmount, auction.nextAuctionGoldAmount(), 1);
        // epoch deleted, cannot recover
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.InvalidOperation.selector));
        auction.recoverToken(address(templeGold), alice, mintAmount);

        // can also recover full amount of TGLD
        vm.warp(info.endTime + _config.auctionsTimeDiff);
        auction.startAuction();
        info = auction.getEpochInfo(auction.currentEpoch());
        // cooldown time
        vm.warp(info.startTime - 10 seconds);
        // distribute so nextAuctionGoldAmount > 0
        templeGold.mint();
        aliceBalance = templeGold.balanceOf(alice);
        recoverAmount = info.totalAuctionTokenAmount;
        nextAuctionGoldAmount = auction.nextAuctionGoldAmount();
        vm.expectEmit(address(auction));
        emit TokenRecovered(alice, address(templeGold), recoverAmount);
        auction.recoverToken(address(templeGold), alice, recoverAmount);
        assertEq(templeGold.balanceOf(alice), aliceBalance+recoverAmount);
        assertGt(nextAuctionGoldAmount, 0);
        assertEq(nextAuctionGoldAmount, auction.nextAuctionGoldAmount());

        // now alice can send back TGLD to Dai Gold auction and notify distribution
        vm.startPrank(executor);
        ITempleElevatedAccess.ExplicitAccess[] memory _accesses = new ITempleElevatedAccess.ExplicitAccess[](1);
        ITempleElevatedAccess.ExplicitAccess memory _access;
        _access.fnSelector = auction.notifyDistribution.selector;
        _access.allowed = true;
        _accesses[0] = _access;
        auction.setExplicitAccess(alice, _accesses);
        vm.startPrank(alice);
        nextAuctionGoldAmount = auction.nextAuctionGoldAmount();
        IERC20(templeGold).transfer(address(auction), recoverAmount);
        auction.notifyDistribution(recoverAmount);
        assertEq(auction.nextAuctionGoldAmount(), recoverAmount+nextAuctionGoldAmount);
    }

    function test_recoverTempleGoldForZeroBidAuction_daiGold() public {
        vm.startPrank(executor);
        ITempleGold.VestingFactor memory _factor;
        _factor.value = 35;
        _factor.weekMultiplier = 1 weeks;
        templeGold.setVestingFactor(_factor);
        _startAuction();
        IAuctionBase.EpochInfo memory info = auction.getEpochInfo(1);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        auction.recoverTempleGoldForZeroBidAuction(1, address(0));

        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.InvalidEpoch.selector));
        auction.recoverTempleGoldForZeroBidAuction(2, executor);

        vm.warp(info.endTime-1);
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.AuctionActive.selector));
        auction.recoverTempleGoldForZeroBidAuction(1, executor);

        // bid to invalidate
        vm.startPrank(alice);
        uint256 amount = 1 ether;
        deal(address(bidToken), alice, amount, false);
        bidToken.approve(address(auction), type(uint).max);
        auction.bid(amount);

        vm.warp(info.endTime);
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.InvalidOperation.selector));
        auction.recoverTempleGoldForZeroBidAuction(1, executor);

        // start anotheer auction and recover
        _startAuction();
        info = auction.getEpochInfo(2);
        vm.warp(info.endTime);
        assertEq(auction.epochsWithoutBidsRecovered(2), false);
        vm.expectEmit(address(auction));
        emit TokenRecovered(executor, address(templeGold), info.totalAuctionTokenAmount);
        auction.recoverTempleGoldForZeroBidAuction(2, executor);
        assertEq(auction.epochsWithoutBidsRecovered(2), true);

        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.AlreadyRecovered.selector));
        auction.recoverTempleGoldForZeroBidAuction(2, executor);

        // now executor can send back TGLD to Dai Gold auction and notify distribution
        vm.startPrank(executor);
        uint256 nextAuctionGoldAmount = auction.nextAuctionGoldAmount();
        uint256 recoverAmount = info.totalAuctionTokenAmount;
        IERC20(templeGold).transfer(address(auction), recoverAmount);
        auction.notifyDistribution(recoverAmount);
        assertEq(auction.nextAuctionGoldAmount(), recoverAmount+nextAuctionGoldAmount);
    }
}