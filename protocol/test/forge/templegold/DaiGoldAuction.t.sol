pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// (tests/forge/templegold/DaiGoldAuction.t.sol)

import { TempleGoldCommon } from "./TempleGoldCommon.t.sol";
import { ITempleGold } from "contracts/interfaces/templegold/ITempleGold.sol";
import { TempleGold } from "contracts/templegold/TempleGold.sol";
import { IDaiGoldAuction } from "contracts/interfaces/templegold/IDaiGoldAuction.sol";
import { IAuctionBase } from "contracts/interfaces/templegold/IAuctionBase.sol";
import { DaiGoldAuction } from "contracts/templegold/DaiGoldAuction.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { ITempleERC20Token } from "contracts/interfaces/core/ITempleERC20Token.sol";
import { TempleGoldStaking } from "contracts/templegold/TempleGoldStaking.sol";
import { ITempleElevatedAccess } from "contracts/interfaces/v2/access/ITempleElevatedAccess.sol";

contract DaiGoldAuctionTestBase is TempleGoldCommon {
    event AuctionStarted(uint256 epochId, address indexed starter, uint128 startTime, uint128 endTime, uint256 auctionTokenAmount);
    event BidTokenSet(address bidToken);
    event GoldDistributionNotified(uint256 amount, uint256 timestamp);
    event AuctionConfigSet(uint256 epochId, IDaiGoldAuction.AuctionConfig config);
    event AuctionStarterSet(address indexed starter);
    event Deposit(address indexed depositor, uint256 epochId, uint256 amount);
    event Claim(address indexed user, uint256 epochId, uint256 bidTokenAmount, uint256 auctionTokenAmount);
    event TokenRecovered(address indexed to, address indexed token, uint256 amount);

    /// @notice Auction duration
    uint64 public constant AUCTION_DURATION = 1 weeks;
    uint32 public constant AUCTIONS_TIME_DIFF_ONE = 2 weeks;
    uint32 public constant AUCTIONS_START_COOLDOWN_ONE = 1 hours;
    uint192 public constant AUCTION_MIN_DISTRIBUTED_GOLD_ONE = 1_000;
    
    address public templeToken = 0x470EBf5f030Ed85Fc1ed4C2d36B9DD02e77CF1b7;
    
    TempleGold public templeGold;
    IERC20 public bidToken;
    IERC20 public bidToken2;
    ITempleERC20Token public temple;
    DaiGoldAuction public daiGoldAuction;
    TempleGoldStaking public goldStaking;

    function setUp() public {
        /// @dev forking for layerzero endpoint to execute code
        fork("arbitrum_one", 204026954);

        ITempleGold.InitArgs memory initArgs = _getTempleGoldInitArgs();

        templeGold = new TempleGold(initArgs);
        daiGoldAuction = new DaiGoldAuction(
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
        templeGold.setDaiGoldAuction(address(daiGoldAuction));
        daiGoldAuction.setBidToken(address(bidToken));
        ITempleGold.DistributionParams memory params;
        params.daiGoldAuction = 60 ether;
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
        templeGold.authorizeContract(address(daiGoldAuction), true);
        templeGold.authorizeContract(address(goldStaking), true);
        templeGold.authorizeContract(teamGnosis, true);
    }

    function test_initialization() public {
        assertEq(address(templeGold), address(daiGoldAuction.templeGold()));
        assertEq(rescuer, daiGoldAuction.rescuer());
        assertEq(executor, daiGoldAuction.executor());
        assertEq(treasury, daiGoldAuction.treasury());
        assertEq(address(bidToken), address(daiGoldAuction.bidToken()));
    }

    function _getAuctionConfig() internal pure returns (IDaiGoldAuction.AuctionConfig memory config) {
        config.auctionsTimeDiff = AUCTIONS_TIME_DIFF_ONE;
        config.auctionStartCooldown = AUCTIONS_START_COOLDOWN_ONE;
        config.auctionMinimumDistributedGold = AUCTION_MIN_DISTRIBUTED_GOLD_ONE;
    }

    function _startAuction() internal {
        uint256 currentEpoch = daiGoldAuction.currentEpoch();
        if (currentEpoch == 0) {
            vm.warp(block.timestamp + 1 weeks);
        } else {
            IAuctionBase.EpochInfo memory info = daiGoldAuction.getEpochInfo(currentEpoch);
            vm.warp(info.endTime + 1 weeks);
        }
        templeGold.mint();
        daiGoldAuction.setAuctionStarter(address(0));
        daiGoldAuction.startAuction();
    }
}

contract DaiGoldAuctionTestAccess is DaiGoldAuctionTestBase {

    function test_access_setAuctionConfigFail() public {
        vm.startPrank(unauthorizedUser);
        IDaiGoldAuction.AuctionConfig memory config = _getAuctionConfig();
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        daiGoldAuction.setAuctionConfig(config);
    }
    function test_access_setAuctionStarterFail() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        daiGoldAuction.setAuctionStarter(unauthorizedUser);
    }

    function test_access_setBidTokenFail() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        daiGoldAuction.setBidToken(address(templeGold));
    }

    function test_access_setAuctionConfigSuccess() public {
        vm.startPrank(executor);
        IDaiGoldAuction.AuctionConfig memory config = _getAuctionConfig();
        daiGoldAuction.setAuctionConfig(config);
    }

    function test_access_setAuctionStarterSuccess() public {
        vm.startPrank(executor);
        daiGoldAuction.setAuctionStarter(alice);
    }

    function test_access_setBidTokenSuccess() public {
        vm.startPrank(executor);
        daiGoldAuction.setBidToken(address(bidToken));
    }
}

contract DaiGoldAuctionTestSetters is DaiGoldAuctionTestBase {

    function test_setAuctionConfig() public {
        vm.startPrank(executor);
        IDaiGoldAuction.AuctionConfig memory fakeConfig;
        // config.auctionStartCooldown = 0 error
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        daiGoldAuction.setAuctionConfig(fakeConfig);
        fakeConfig.auctionStartCooldown = 100;
        // config.auctionMinimumDistributedGold = 0 error
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        daiGoldAuction.setAuctionConfig(fakeConfig);
        fakeConfig.auctionMinimumDistributedGold = 1000;
        // config.auctionsTimeDiff = 0 error
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        daiGoldAuction.setAuctionConfig(fakeConfig);
        fakeConfig.auctionsTimeDiff = 1;
        vm.expectEmit(address(daiGoldAuction));
        uint256 currentEpochId = daiGoldAuction.currentEpoch();
        emit AuctionConfigSet(currentEpochId, fakeConfig);
        daiGoldAuction.setAuctionConfig(fakeConfig);

        IDaiGoldAuction.AuctionConfig memory config = daiGoldAuction.getAuctionConfig();
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
        daiGoldAuction.setAuctionConfig(config);
    }

    function test_setAuctionStarter() public {
        vm.startPrank(executor);
        // address zero error
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        daiGoldAuction.setBidToken(address(0));

        vm.expectEmit(address(daiGoldAuction));
        emit AuctionStarterSet(alice);
        daiGoldAuction.setAuctionStarter(alice);

        assertEq(daiGoldAuction.auctionStarter(), alice);

        // auction started
        _startAuction();
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.InvalidOperation.selector));
        daiGoldAuction.setBidToken(alice);
    }

     function test_setBidToken() public {
        vm.startPrank(executor);

        vm.expectEmit(address(daiGoldAuction));
        emit BidTokenSet(usdcToken);
        daiGoldAuction.setBidToken(usdcToken);

        assertEq(address(daiGoldAuction.bidToken()), usdcToken);

        // auction started
        _startAuction();
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.InvalidOperation.selector));
        daiGoldAuction.setBidToken(alice);
    }
}

contract DaiGoldAuctionTestView is DaiGoldAuctionTestBase {
    function test_getClaimableAtEpoch() public {
        vm.startPrank(executor);
        vm.warp(block.timestamp + 3 weeks);
        _startAuction();

        templeGold.mint();

        vm.startPrank(alice);
        bidToken.approve(address(daiGoldAuction), type(uint).max);
        daiGoldAuction.bid(50 ether);
        vm.startPrank(executor);
        bidToken.approve(address(daiGoldAuction), type(uint).max);
        daiGoldAuction.bid(100 ether);
        uint256 currentEpoch = daiGoldAuction.currentEpoch();
        IAuctionBase.EpochInfo memory info = daiGoldAuction.getEpochInfo(currentEpoch);
        uint256 totalRewards = info.totalAuctionTokenAmount;
        uint256 aliceClaimable = (50 ether * totalRewards) / 150 ether;
        uint256 executorClaimable = (100 ether * totalRewards) / 150 ether;
        
        assertEq(daiGoldAuction.getClaimableAtEpoch(alice, currentEpoch), aliceClaimable);
        assertEq(daiGoldAuction.getClaimableAtEpoch(executor, currentEpoch), executorClaimable);
        assertEq(totalRewards, executorClaimable+aliceClaimable);
    }

    function test_getAuctionConfig() public {
        /// @dev See test_setAuctionConfig()
    }

    function test_nextEpoch() public {
        uint256 currentEpoch = daiGoldAuction.currentEpoch();
        assertEq(daiGoldAuction.nextEpoch(), currentEpoch+1);
    }

    function test_isCurrentEpochEnded() public {
        vm.startPrank(executor);
        _startAuction();
        vm.warp(block.timestamp + 6 days);
        assertEq(daiGoldAuction.isCurrentEpochEnded(), false);
        vm.warp(block.timestamp + 1 days + 1 seconds);
        assertEq(daiGoldAuction.isCurrentEpochEnded(), true);
    }

    function test_canDeposit() public {
        vm.startPrank(executor);
        _startAuction();
        IAuctionBase.EpochInfo memory info = daiGoldAuction.getEpochInfo(daiGoldAuction.currentEpoch());
        vm.warp(info.endTime - 1);
        assertEq(daiGoldAuction.canDeposit(), true);
        vm.warp(info.endTime);
        assertEq(daiGoldAuction.canDeposit(), false);
        vm.warp(info.endTime+1);
        assertEq(daiGoldAuction.canDeposit(), false);
    }
}

contract DaiGoldAuctionTest is DaiGoldAuctionTestBase {

    function test_startAuction() public {
        _setVestingFactor(templeGold);
        vm.startPrank(executor);
        daiGoldAuction.setAuctionStarter(alice);
        // auction starter != adderss(0) and caller is not auction starter
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        daiGoldAuction.startAuction();

        // auctionStarter == address(0). anyone can call
        vm.startPrank(executor);
        daiGoldAuction.setAuctionStarter(address(0));
        IDaiGoldAuction.AuctionConfig memory _config = _getAuctionConfig();
        daiGoldAuction.setAuctionConfig(_config);

        // distribute some TGLD
        skip(1 days);
        templeGold.mint();
        
        uint128 startTime = uint128(block.timestamp + _config.auctionStartCooldown);
        uint128 endTime = startTime + uint128(1 weeks);
        uint256 goldAmount = daiGoldAuction.nextAuctionGoldAmount();
        vm.expectEmit(address(daiGoldAuction));
        emit AuctionStarted(1, executor, startTime, endTime, goldAmount);
        daiGoldAuction.startAuction();

        IDaiGoldAuction.EpochInfo memory epochInfo = daiGoldAuction.getEpochInfo(1);
        assertEq(daiGoldAuction.currentEpoch(), 1);
        assertEq(epochInfo.startTime, startTime);
        assertEq(epochInfo.endTime, endTime);
        assertEq(epochInfo.totalBidTokenAmount, 0);
        assertEq(epochInfo.totalAuctionTokenAmount, goldAmount);

        // test is current epoch ended
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.CannotStartAuction.selector));
        daiGoldAuction.startAuction();

        // test CannotStartAuction
        // warp to auction end time
        vm.warp(epochInfo.endTime+_config.auctionsTimeDiff-1);
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.CannotStartAuction.selector));
        daiGoldAuction.startAuction();

        vm.warp(epochInfo.endTime+_config.auctionsTimeDiff);

        // distribute gold and start second auction
        templeGold.mint();
        startTime = uint128(block.timestamp + _config.auctionStartCooldown);
        endTime = startTime + uint128(1 weeks);
        goldAmount = daiGoldAuction.nextAuctionGoldAmount();
        vm.expectEmit(address(daiGoldAuction));
        emit AuctionStarted(2, executor, startTime, endTime, goldAmount);
        daiGoldAuction.startAuction();

        epochInfo = daiGoldAuction.getEpochInfo(2);
        assertEq(daiGoldAuction.currentEpoch(), 2);
        assertEq(epochInfo.startTime, startTime);
        assertEq(epochInfo.endTime, endTime);
        assertEq(epochInfo.totalBidTokenAmount, 0);
        assertEq(epochInfo.totalAuctionTokenAmount, goldAmount);
        assertEq(daiGoldAuction.epochGoldSupply(2), epochInfo.totalAuctionTokenAmount);

        // low TGLD distribution error
        vm.startPrank(executor);
        ITempleGold.DistributionParams memory _params = _getDistributionParameters();
        _params.daiGoldAuction = 0;
        _params.staking = 80 ether;
        _params.gnosis = 20 ether;
        // update so dai gold auction gets nothing
        templeGold.setDistributionParams(_params);
        vm.warp(epochInfo.endTime + _config.auctionsTimeDiff);
        daiGoldAuction.isCurrentEpochEnded();
        vm.expectRevert(abi.encodeWithSelector(IDaiGoldAuction.LowGoldDistributed.selector, 0));
        daiGoldAuction.startAuction();

    }

    function test_bid_daiGold() public {
        // onlyt when live error. 
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.CannotDeposit.selector));
        daiGoldAuction.bid(0);

        _startAuction();
        // zero amount error
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        daiGoldAuction.bid(0);

        // if auction ended
        uint256 currentEpoch = daiGoldAuction.currentEpoch();
        IAuctionBase.EpochInfo memory epochInfo = daiGoldAuction.getEpochInfo(currentEpoch);
        vm.warp(epochInfo.endTime);
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.CannotDeposit.selector));
        daiGoldAuction.bid(100 ether);

        uint256 goldBalanceBefore = templeGold.balanceOf(address(daiGoldAuction));
         vm.warp(epochInfo.startTime);
        
        currentEpoch = daiGoldAuction.currentEpoch();
        bidToken.approve(address(daiGoldAuction), type(uint).max);
        vm.expectEmit(address(daiGoldAuction));
        emit Deposit(executor, currentEpoch, 100 ether);
        daiGoldAuction.bid(100 ether);

        epochInfo = daiGoldAuction.getEpochInfo(currentEpoch);
        assertEq(daiGoldAuction.depositors(executor, currentEpoch), 100 ether);
        assertEq(epochInfo.totalBidTokenAmount, 100 ether);
        assertEq(bidToken.balanceOf(treasury), 100 ether);

        uint256 goldBalanceAfter = templeGold.balanceOf(address(daiGoldAuction));
        assertEq(goldBalanceAfter, goldBalanceBefore);

        // second deposits
        vm.startPrank(alice);
        bidToken.approve(address(daiGoldAuction), type(uint).max);
        vm.expectEmit(address(daiGoldAuction));
        emit Deposit(alice, currentEpoch, 50 ether);
        daiGoldAuction.bid(50 ether);

        epochInfo = daiGoldAuction.getEpochInfo(currentEpoch);
        assertEq(daiGoldAuction.depositors(alice, currentEpoch), 50 ether);
        assertEq(epochInfo.totalBidTokenAmount, 150 ether);
        assertEq(bidToken.balanceOf(treasury), 150 ether);

        // bidToken amount = 0
        assertEq(daiGoldAuction.getClaimableAtEpoch(unauthorizedUser, currentEpoch), 0);
        // invalid epoch
        assertEq(daiGoldAuction.getClaimableAtEpoch(unauthorizedUser, currentEpoch+1), 0);
    }

    function test_claim_daiGold() public {
        _setVestingFactor(templeGold);
        skip(1 days);
        vm.startPrank(executor);
        _startAuction();
        
        // deposits
        vm.startPrank(alice);
        bidToken.approve(address(daiGoldAuction), type(uint).max);
        daiGoldAuction.bid(50 ether);
        vm.startPrank(executor);
        bidToken.approve(address(daiGoldAuction), type(uint).max);
        daiGoldAuction.bid(100 ether);

        // cannot claim for current epoch
        uint256 currentEpoch = daiGoldAuction.currentEpoch();
        IAuctionBase.EpochInfo memory info = daiGoldAuction.getEpochInfo(currentEpoch);
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.CannotClaim.selector, currentEpoch));
        daiGoldAuction.claim(currentEpoch);
        // cannot claim for not started (cooldown time)
        vm.warp(info.startTime - 1 seconds);
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.CannotClaim.selector, currentEpoch));
        daiGoldAuction.claim(currentEpoch);
        // cannot claim when active
        vm.warp(info.startTime);
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.CannotClaim.selector, currentEpoch));
        daiGoldAuction.claim(currentEpoch);
        // invalid epoch error
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.InvalidEpoch.selector));
        daiGoldAuction.claim(currentEpoch+1);

        vm.warp(info.endTime);
        // bob cannot claim for 0 deposits
        vm.startPrank(bob);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        daiGoldAuction.claim(currentEpoch);

        // valid claims
        uint256 aliceRewardBalanceBefore = templeGold.balanceOf(alice);
        uint256 executorRewardBalanceBefore = templeGold.balanceOf(executor);
        uint256 executorClaimable = daiGoldAuction.getClaimableAtCurrentEpoch(executor);
        uint256 aliceClaimable = daiGoldAuction.getClaimableAtCurrentEpoch(alice);
        vm.startPrank(alice);
        vm.expectEmit(address(daiGoldAuction));
        emit Claim(alice, currentEpoch, 50 ether, aliceClaimable);
        daiGoldAuction.claim(currentEpoch);
        vm.startPrank(executor);
        vm.expectEmit(address(daiGoldAuction));
        emit Claim(executor, currentEpoch, 100 ether, executorClaimable);
        daiGoldAuction.claim(currentEpoch);

        uint256 aliceRewardBalanceAfter= templeGold.balanceOf(alice);
        uint256 executorRewardBalanceAfter = templeGold.balanceOf(executor);
        IAuctionBase.EpochInfo memory epochInfo = daiGoldAuction.getEpochInfo(currentEpoch);
        assertEq(executorClaimable+aliceClaimable, epochInfo.totalAuctionTokenAmount);
        assertEq(aliceRewardBalanceAfter, aliceRewardBalanceBefore+aliceClaimable);
        assertEq(executorRewardBalanceAfter, executorRewardBalanceBefore+executorClaimable);
        assertEq(daiGoldAuction.claimedAmount(alice, currentEpoch), aliceClaimable);
        assertEq(daiGoldAuction.claimedAmount(executor, currentEpoch), executorClaimable);
        assertEq(daiGoldAuction.claimed(alice, currentEpoch), true);
        assertEq(daiGoldAuction.claimed(executor, currentEpoch), true);

        // try to claim again
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.AlreadyClaimed.selector));
        daiGoldAuction.claim(currentEpoch);
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.AlreadyClaimed.selector));
        daiGoldAuction.claim(currentEpoch);
        vm.startPrank(executor);
        
        // start another auction but check claimable diffs when another user deposits additionally
        skip(1 days);
        _startAuction();
        currentEpoch = daiGoldAuction.currentEpoch();
        info = daiGoldAuction.getEpochInfo(currentEpoch);
        vm.warp(info.startTime);
        deal(address(bidToken), alice, 100 ether, false);
        deal(address(bidToken), executor, 100 ether, false);
        vm.startPrank(alice);
        bidToken.approve(address(daiGoldAuction), type(uint).max);
        daiGoldAuction.bid(100 ether);
        vm.startPrank(executor);
        bidToken.approve(address(daiGoldAuction), type(uint).max);
        daiGoldAuction.bid(100 ether);
        executorClaimable = daiGoldAuction.getClaimableAtCurrentEpoch(executor);
        aliceClaimable = daiGoldAuction.getClaimableAtCurrentEpoch(alice);
        deal(address(bidToken), bob, 100 ether, false);
        vm.startPrank(bob);
        bidToken.approve(address(daiGoldAuction), type(uint).max);
        daiGoldAuction.bid(100 ether);
        assertGt(aliceClaimable, daiGoldAuction.getClaimableAtCurrentEpoch(alice));
        assertGt(executorClaimable, daiGoldAuction.getClaimableAtCurrentEpoch(executor));
    }

    function test_notifyDistribution() public {
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        daiGoldAuction.notifyDistribution(100 ether);

        uint256 nextGoldAmount = daiGoldAuction.nextAuctionGoldAmount();
        vm.warp(block.timestamp + 1 weeks);
        uint256 mintAmount = templeGold.getMintAmount();
        ITempleGold.DistributionParams memory dp = templeGold.getDistributionParameters();
        uint256 auctionAmount = dp.daiGoldAuction * mintAmount / 100 ether;
        templeGold.mint();
        assertEq(daiGoldAuction.nextAuctionGoldAmount(), nextGoldAmount+auctionAmount);
    }

    function test_distributeGold() public {
        _setVestingFactor(templeGold);
        skip(1 days);
        uint256 goldBalance = templeGold.balanceOf(address(daiGoldAuction));
        daiGoldAuction.distributeGold();
        assertGt(templeGold.balanceOf(address(daiGoldAuction)), goldBalance);
    }

    function test_recoverToken_daiGold() public {
        _setVestingFactor(templeGold);
        skip(1 days);
        vm.startPrank(executor);
        // revert, invalid params
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        daiGoldAuction.recoverToken(address(temple), address(0), 0);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        daiGoldAuction.recoverToken(address(temple), alice, 0);

        uint256 sendAmount = 50 ether;
        deal(address(bidToken), address(daiGoldAuction), sendAmount, false);

        uint256 aliceBalance = bidToken.balanceOf(alice);
        vm.expectEmit(address(daiGoldAuction));
        emit TokenRecovered(alice, address(bidToken), sendAmount);
        daiGoldAuction.recoverToken(address(bidToken), alice, sendAmount);
        assertEq(bidToken.balanceOf(alice), aliceBalance+sendAmount);
        assertEq(daiGoldAuction.nextAuctionGoldAmount(), 0);

        // currentEpochId = 0
        templeGold.mint();
        uint256 mintAmount = templeGold.balanceOf(address(daiGoldAuction));
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.InvalidOperation.selector));
        daiGoldAuction.recoverToken(address(templeGold), alice, mintAmount);

        IDaiGoldAuction.AuctionConfig memory _config = _getAuctionConfig();
        daiGoldAuction.setAuctionConfig(_config);
        _startAuction();
        IAuctionBase.EpochInfo memory info = daiGoldAuction.getEpochInfo(1);
        vm.warp(info.startTime);
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.AuctionActive.selector));
        daiGoldAuction.recoverToken(address(templeGold), alice, mintAmount);

        vm.warp(info.endTime);
        templeGold.mint();
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.AuctionEnded.selector));
        daiGoldAuction.recoverToken(address(templeGold), alice, mintAmount);

        vm.warp(info.startTime - 10 seconds);
        mintAmount = templeGold.balanceOf(address(daiGoldAuction));
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAmount.selector, address(templeGold), mintAmount+1));
        daiGoldAuction.recoverToken(address(templeGold), alice, mintAmount+1);

        // there was distribution after calling `templeGold.mint()`. nextAuctionGoldAmount > 0
        // recover half of total auction amount
        aliceBalance = templeGold.balanceOf(alice);
        uint256 recoverAmount = info.totalAuctionTokenAmount / 2;
        uint256 nextAuctionGoldAmount = daiGoldAuction.nextAuctionGoldAmount();
        vm.expectEmit(address(daiGoldAuction));
        emit TokenRecovered(alice, address(templeGold), recoverAmount);
        daiGoldAuction.recoverToken(address(templeGold), alice, recoverAmount);
        assertEq(templeGold.balanceOf(alice), aliceBalance+recoverAmount);
        // plus the half of total auction amount that was not recovered
        // delta of 1 because of rounding
        assertApproxEqAbs(nextAuctionGoldAmount + recoverAmount, daiGoldAuction.nextAuctionGoldAmount(), 1);
        // epoch deleted, cannot recover
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.InvalidOperation.selector));
        daiGoldAuction.recoverToken(address(templeGold), alice, mintAmount);

        // can also recover full amount of TGLD
        vm.warp(info.endTime + _config.auctionsTimeDiff);
        daiGoldAuction.startAuction();
        info = daiGoldAuction.getEpochInfo(daiGoldAuction.currentEpoch());
        // cooldown time
        vm.warp(info.startTime - 10 seconds);
        // distribute so nextAuctionGoldAmount > 0
        templeGold.mint();
        aliceBalance = templeGold.balanceOf(alice);
        recoverAmount = info.totalAuctionTokenAmount;
        nextAuctionGoldAmount = daiGoldAuction.nextAuctionGoldAmount();
        vm.expectEmit(address(daiGoldAuction));
        emit TokenRecovered(alice, address(templeGold), recoverAmount);
        daiGoldAuction.recoverToken(address(templeGold), alice, recoverAmount);
        assertEq(templeGold.balanceOf(alice), aliceBalance+recoverAmount);
        assertGt(nextAuctionGoldAmount, 0);
        assertEq(nextAuctionGoldAmount, daiGoldAuction.nextAuctionGoldAmount());

        // now alice can send back TGLD to Dai Gold auction and notify distribution
        vm.startPrank(executor);
        ITempleElevatedAccess.ExplicitAccess[] memory _accesses = new ITempleElevatedAccess.ExplicitAccess[](1);
        ITempleElevatedAccess.ExplicitAccess memory _access;
        _access.fnSelector = daiGoldAuction.notifyDistribution.selector;
        _access.allowed = true;
        _accesses[0] = _access;
        daiGoldAuction.setExplicitAccess(alice, _accesses);
        vm.startPrank(alice);
        nextAuctionGoldAmount = daiGoldAuction.nextAuctionGoldAmount();
        IERC20(templeGold).transfer(address(daiGoldAuction), recoverAmount);
        daiGoldAuction.notifyDistribution(recoverAmount);
        assertEq(daiGoldAuction.nextAuctionGoldAmount(), recoverAmount+nextAuctionGoldAmount);
    }

    function test_recoverTempleGoldForZeroBidAuction_daiGold() public {
        vm.startPrank(executor);
        ITempleGold.VestingFactor memory _factor;
        _factor.value = 35;
        _factor.weekMultiplier = 1 weeks;
        templeGold.setVestingFactor(_factor);
        _startAuction();
        IAuctionBase.EpochInfo memory info = daiGoldAuction.getEpochInfo(1);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        daiGoldAuction.recoverTempleGoldForZeroBidAuction(1, address(0));

        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.InvalidEpoch.selector));
        daiGoldAuction.recoverTempleGoldForZeroBidAuction(2, executor);

        vm.warp(info.endTime-1);
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.AuctionActive.selector));
        daiGoldAuction.recoverTempleGoldForZeroBidAuction(1, executor);

        // bid to invalidate
        vm.startPrank(alice);
        uint256 amount = 1 ether;
        deal(address(bidToken), alice, amount, false);
        bidToken.approve(address(daiGoldAuction), type(uint).max);
        daiGoldAuction.bid(amount);

        vm.warp(info.endTime);
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.InvalidOperation.selector));
        daiGoldAuction.recoverTempleGoldForZeroBidAuction(1, executor);

        // start anotheer auction and recover
        _startAuction();
        info = daiGoldAuction.getEpochInfo(2);
        vm.warp(info.endTime);
        assertEq(daiGoldAuction.epochsWithoutBidsRecovered(2), false);
        vm.expectEmit(address(daiGoldAuction));
        emit TokenRecovered(executor, address(templeGold), info.totalAuctionTokenAmount);
        daiGoldAuction.recoverTempleGoldForZeroBidAuction(2, executor);
        assertEq(daiGoldAuction.epochsWithoutBidsRecovered(2), true);

        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.AlreadyRecovered.selector));
        daiGoldAuction.recoverTempleGoldForZeroBidAuction(2, executor);

        // now executor can send back TGLD to Dai Gold auction and notify distribution
        vm.startPrank(executor);
        uint256 nextAuctionGoldAmount = daiGoldAuction.nextAuctionGoldAmount();
        uint256 recoverAmount = info.totalAuctionTokenAmount;
        IERC20(templeGold).transfer(address(daiGoldAuction), recoverAmount);
        daiGoldAuction.notifyDistribution(recoverAmount);
        assertEq(daiGoldAuction.nextAuctionGoldAmount(), recoverAmount+nextAuctionGoldAmount);
    }
}