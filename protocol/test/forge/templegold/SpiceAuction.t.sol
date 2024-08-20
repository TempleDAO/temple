pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// (tests/forge/templegold/SpiceAuction.t.sol)

import { TempleGoldCommon } from "./TempleGoldCommon.t.sol";
import { ISpiceAuction } from "contracts/interfaces/templegold/ISpiceAuction.sol";
import { SpiceAuctionFactory } from "contracts/templegold/SpiceAuctionFactory.sol";
import { ITempleGold } from "contracts/interfaces/templegold/ITempleGold.sol";
import { TempleGold } from "contracts/templegold/TempleGold.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { IAuctionBase } from "contracts/interfaces/templegold/IAuctionBase.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";
import { TempleGoldStaking } from "contracts/templegold/TempleGoldStaking.sol";
import { DaiGoldAuction } from "contracts/templegold/DaiGoldAuction.sol";

contract SpiceAuctionTestBase is TempleGoldCommon {
    event Claim(address indexed user, uint256 epochId, uint256 bidTokenAmount, uint256 auctionTokenAmount);
    event Deposit(address indexed depositor, uint256 epochId, uint256 amount);
    event AuctionConfigSet(uint256 epoch, ISpiceAuction.SpiceAuctionConfig config);
    event AuctionConfigRemoved(uint256 configId, uint256 epochId);
    event AuctionStarted(uint256 epochId, address indexed starter, uint128 startTime, uint128 endTime, uint256 auctionTokenAmount);
    event DaoExecutorSet(address daoExecutor);
    event TokenRecovered(address indexed to, address indexed token, uint256 amount);
    event CirculatingSupplyUpdated(address indexed sender, uint256 amount, uint256 circulatingSuppply, uint256 totalBurned);
    event NotifierSet(address indexed notifier);
    event RedeemedTempleGoldBurned(uint256 epochId, uint256 amount);
    event OperatorSet(address indexed operator);

    address public daoExecutor = makeAddr("daoExecutor");
    FakeERC20 public templeToken;
    TempleGoldStaking public staking;

    /// @notice Auctions run for minimum 1 week
    uint32 public constant MINIMUM_AUCTION_PERIOD = 604_800;

    ISpiceAuction public spice;
    SpiceAuctionFactory public factory;
    TempleGold public templeGold;
    DaiGoldAuction public daiGoldAuction;

    function setUp() public {
        fork("arbitrum_one", forkBlockNumber);

        ITempleGold.InitArgs memory initArgs = _getTempleGoldInitArgs();
        
        templeGold = new TempleGold(initArgs);
        templeToken = new FakeERC20("Temple Token", "TEMPLE", executor, 1000 ether);
        staking = new TempleGoldStaking(rescuer, executor, address(templeToken), address(templeGold));
        factory = new SpiceAuctionFactory(rescuer, executor, daoExecutor, mike, address(templeGold), ARBITRUM_ONE_LZ_EID, uint32(arbitrumOneChainId));
        fakeERC20 = new FakeERC20("FAKE TOKEN", "FAKE", executor, 1000 ether);
        daiGoldAuction = new DaiGoldAuction(
            address(templeGold),
            address(fakeERC20),
            treasury,
            rescuer,
            executor,
            executor
        );
        vm.startPrank(executor);
        spice = ISpiceAuction(factory.createAuction(daiToken, NAME_ONE));
        templeGold.authorizeContract(address(spice), true);
        templeGold.setStaking(address(staking));
        templeGold.setTeamGnosis(mike);
        templeGold.setDaiGoldAuction(address(daiGoldAuction));
        vm.stopPrank();
    }

    function test_initialization() public {
        assertEq(spice.name(), NAME_ONE);
        assertEq(spice.templeGold(), address(templeGold));
        assertEq(spice.spiceToken(), daiToken);
        assertEq(spice.daoExecutor(), daoExecutor);
        assertEq(spice.operator(), mike);
    }

    function _getAuctionConfig() internal view returns (ISpiceAuction.SpiceAuctionConfig memory config) {
        config.duration = 7 days;
        config.waitPeriod = 2 weeks;
        config.minimumDistributedAuctionToken = 1 ether;
        config.starter = alice;
        config.startCooldown = 1 hours;
        config.isTempleGoldAuctionToken = true;
        config.recipient = treasury;
    }

    function _setAuctionConfig() private returns ( ISpiceAuction.SpiceAuctionConfig memory config){
        config = _getAuctionConfig();
        vm.startPrank(daoExecutor);
        spice.setAuctionConfig(config);
        vm.stopPrank();
    }

    function _startAuction(bool _setConfig, bool _sendAuctionTokens) internal returns ( ISpiceAuction.SpiceAuctionConfig memory config) {
        if (_setConfig) { 
            config = _setAuctionConfig(); 
        } else {
            uint256 epochId = spice.currentEpoch();
            config = spice.getAuctionConfig(epochId+1);
        }
        if (_sendAuctionTokens) {
            address auctionToken = config.isTempleGoldAuctionToken ? address(templeGold) : spice.spiceToken();
            dealAdditional(IERC20(auctionToken), address(spice), 100 ether);
        }
        if (config.starter != address(0)) { vm.startPrank(config.starter); }
        vm.warp(block.timestamp + config.waitPeriod);
        spice.startAuction();
    }

    function _getAuctionToken(bool _isTempleGoldAuctionToken, address _spiceToken) internal view returns (address) {
        return _isTempleGoldAuctionToken ? address(templeGold) : _spiceToken;
    }

    function _setVestingFactor() internal {
        ITempleGold.VestingFactor memory _factor = _getVestingFactor();
        _factor.value = 35;
        _factor.weekMultiplier = 1 weeks;
        vm.startPrank(executor);
        templeGold.setVestingFactor(_factor);
    }
}

contract SpiceAuctionAccessTest is SpiceAuctionTestBase {
    function test_access_setSpiceAuctionConfigFail() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        spice.setAuctionConfig(_getAuctionConfig());
    }

     function test_access_setDaoExecutorFail() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        spice.setDaoExecutor(alice);
    }

    function test_access_removeSpiceAuctionConfigFail() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        spice.removeAuctionConfig();
    }

    function test_access_setSpiceAuctionConfigSuccess() public {
        vm.startPrank(daoExecutor);
        spice.setAuctionConfig(_getAuctionConfig());
    }

    function test_access_removeSpiceAuctionConfigSuccess() public {
        _startAuction(true, true);
        vm.startPrank(daoExecutor);
        spice.setAuctionConfig(_getAuctionConfig());
        spice.removeAuctionConfig();
    }
}

contract SpiceAuctionViewTest is SpiceAuctionTestBase {
    function test_getAuctionTokenForCurrentEpoch() public {
        ISpiceAuction.SpiceAuctionConfig memory _config = _startAuction(true, true);
        address auctionToken = _config.isTempleGoldAuctionToken ? address(templeGold) : spice.spiceToken();
        assertEq(auctionToken, spice.getAuctionTokenForCurrentEpoch());
    }

    function test_getClaimableForEpoch() public {
        // bid token == 0
        uint256 claimabale = spice.getClaimableForEpoch(alice, 0);
        assertEq(claimabale, 0);

        _startAuction(true, true);
        vm.startPrank(alice);
        deal(daiToken, alice, 100 ether);
        IERC20(daiToken).approve(address(spice), type(uint).max);
        // epoch > 1
        claimabale = spice.getClaimableForEpoch(alice, 2);
        assertEq(claimabale, 0);
        /// @dev see claim and bid tests
    }

    function test_currentEpoch() public {
        /// @dev see claim and bid tests
    }
}

contract SpiceAuctionTest is SpiceAuctionTestBase {
    function test_setDaoExecutor() public {
        vm.startPrank(daoExecutor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        spice.setDaoExecutor(address(0));

        vm.expectEmit(address(spice));
        emit DaoExecutorSet(alice);
        spice.setDaoExecutor(alice);
        assertEq(spice.daoExecutor(), alice);
    }

    function test_setSpiceAuctionConfig() public {
        ISpiceAuction.SpiceAuctionConfig memory config = _getAuctionConfig();
        config.duration = 1;
        vm.startPrank(daoExecutor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        spice.setAuctionConfig(config);
        // exceeds max duration
        config.duration = 31 days;
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        spice.setAuctionConfig(config);
        // exceeds max wait period
        config.waitPeriod = 91 days;
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        spice.setAuctionConfig(config);
        config.duration = 7 days;
        // wait period error
        config.waitPeriod = 0;
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        spice.setAuctionConfig(config);
        config.waitPeriod = 60 hours;
        // min distributed tokens error
        config.minimumDistributedAuctionToken = 0;
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        spice.setAuctionConfig(config);
        config.minimumDistributedAuctionToken = 1 ether;
        // invalid recipient
        config.recipient = address(0);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        spice.setAuctionConfig(config);
        config.recipient = treasury;
        
        uint256 epochId = spice.currentEpoch();
        vm.expectEmit(address(spice));
        emit AuctionConfigSet(1, config);
        spice.setAuctionConfig(config);

        ISpiceAuction.SpiceAuctionConfig memory _config = spice.getAuctionConfig(epochId+1);
        assertEq(spice.currentEpoch(), epochId);
        assertEq(_config.recipient, treasury);
        assertEq(_config.minimumDistributedAuctionToken, 1 ether);
        assertEq(_config.waitPeriod, 60 hours);
        assertEq(_config.duration, 7 days);
        assertEq(_config.startCooldown, 1 hours);
        assertEq(_config.starter, alice);

        _startAuction(false, true);
        vm.warp(block.timestamp + _config.startCooldown);
        // trying to set config for ongoing auction error
        vm.startPrank(daoExecutor);
        vm.expectRevert(abi.encodeWithSelector(ISpiceAuction.InvalidConfigOperation.selector));
        spice.setAuctionConfig(config);
    }

    function test_removeAuctionConfig() public {
        vm.startPrank(daoExecutor);
        // revert , no config
        vm.expectRevert(abi.encodeWithSelector(ISpiceAuction.InvalidConfigOperation.selector));
        spice.removeAuctionConfig();

        ISpiceAuction.SpiceAuctionConfig memory _config = _startAuction(true, true);
        vm.warp(block.timestamp + _config.startCooldown);
        vm.startPrank(daoExecutor);
        // revert , auction active
        vm.expectRevert(abi.encodeWithSelector(ISpiceAuction.InvalidConfigOperation.selector));
        spice.removeAuctionConfig();

        // config set but auction not started
        IAuctionBase.EpochInfo memory info = spice.getEpochInfo(1);
        vm.warp(info.endTime + _config.waitPeriod);
        _config = _getAuctionConfig();
        spice.setAuctionConfig(_config);

        vm.expectEmit(address(spice));
        emit AuctionConfigRemoved(2, 0);
        spice.removeAuctionConfig();

        ISpiceAuction.SpiceAuctionConfig memory _emptyConfig = spice.getAuctionConfig(2);
        assertEq(_emptyConfig.duration, 0);
        assertEq(_emptyConfig.waitPeriod, 0);
        assertEq(_emptyConfig.startCooldown, 0);
        assertEq(_emptyConfig.minimumDistributedAuctionToken, 0);
        assertEq(_emptyConfig.starter, address(0));
        assertEq(_emptyConfig.isTempleGoldAuctionToken, false);
        assertEq(_emptyConfig.recipient, address(0));
        assertEq(spice.currentEpoch(), 1);

        // config set and auction started but cooldown not reached
        _config = _startAuction(true, true);
        // epochId is now 2 for SpiceAuctionConfig and EpochInfo
        info = spice.getEpochInfo(2);
        // warp below start time (this includes cooldown)
        vm.warp(info.startTime - 10 seconds);
        vm.startPrank(daoExecutor);
        vm.expectEmit(address(spice));
        emit AuctionConfigRemoved(2, 2); // meaning Ids 2 were deleted
        spice.removeAuctionConfig();

        _emptyConfig = spice.getAuctionConfig(2);
        assertEq(_emptyConfig.duration, 0);
        assertEq(_emptyConfig.waitPeriod, 0);
        assertEq(_emptyConfig.startCooldown, 0);
        assertEq(_emptyConfig.minimumDistributedAuctionToken, 0);
        assertEq(_emptyConfig.starter, address(0));
        assertEq(_emptyConfig.isTempleGoldAuctionToken, false);
        assertEq(_emptyConfig.recipient, address(0));
        assertEq(spice.currentEpoch(), 1);
        vm.warp(info.endTime+_config.waitPeriod);
        
        // some more auction and try to delete old ended auction
        _config = _startAuction(true, true);
        vm.startPrank(daoExecutor);
        uint256 currentEpoch = spice.currentEpoch();
        info = spice.getEpochInfo(currentEpoch);
        vm.warp(info.endTime + _config.waitPeriod);
        _config = _startAuction(true, true);
        vm.startPrank(daoExecutor);
        currentEpoch = spice.currentEpoch();
        info = spice.getEpochInfo(currentEpoch);
        vm.warp(info.endTime + _config.waitPeriod);
        _config = _startAuction(true, true);
        vm.startPrank(daoExecutor);
        currentEpoch = spice.currentEpoch();
        info = spice.getEpochInfo(currentEpoch);
        // auction ended
        vm.warp(info.endTime);
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.AuctionEnded.selector));
        spice.removeAuctionConfig();
    }

    function test_recoverAuctionTokenForZeroBidAuction() public {
        vm.startPrank(daoExecutor);
        // revert, zero address
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        spice.recoverAuctionTokenForZeroBidAuction(0, address(0));
        // invalid epoch
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.InvalidEpoch.selector));
        spice.recoverAuctionTokenForZeroBidAuction(1, alice);

        _startAuction(true, true);
        IAuctionBase.EpochInfo memory info = spice.getEpochInfo(1);
        vm.startPrank(daoExecutor);
        vm.warp(info.startTime);
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.AuctionActive.selector));
        spice.recoverAuctionTokenForZeroBidAuction(1, alice);
        vm.startPrank(bob);
        uint256 bidAmount = 10 ether;
        deal(daiToken, bob, bidAmount);
        IERC20(daiToken).approve(address(spice), type(uint).max);
        spice.bid(bidAmount);
        uint256 epochOneTotalAuctionTokenAmount = info.totalAuctionTokenAmount;
        ISpiceAuction.SpiceAuctionConfig memory _config = spice.getAuctionConfig(1);
        vm.warp(info.endTime + _config.waitPeriod);
        // fail for epoch with bid
        vm.startPrank(daoExecutor);
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.InvalidOperation.selector));
        spice.recoverAuctionTokenForZeroBidAuction(1, alice);

        _startAuction(true, true);
        info = spice.getEpochInfo(2);
        _config = spice.getAuctionConfig(2);
        vm.warp(info.endTime + _config.waitPeriod);
        address auctionToken = spice.getAuctionTokenForCurrentEpoch();
        uint256 auctionTokenBalance = IERC20(auctionToken).balanceOf(address(spice));
        uint256 auctionTokenAmount = info.totalAuctionTokenAmount;
        uint256 aliceBalance = IERC20(auctionToken).balanceOf(alice);
        vm.startPrank(daoExecutor);

        assertEq(spice.epochsWithoutBidsRecovered(2), false);
        vm.expectEmit(address(spice));
        emit TokenRecovered(alice, auctionToken, auctionTokenAmount);
        spice.recoverAuctionTokenForZeroBidAuction(2, alice);
        assertEq(IERC20(auctionToken).balanceOf(address(spice)), auctionTokenBalance - auctionTokenAmount);
        assertEq(IERC20(auctionToken).balanceOf(alice), aliceBalance + auctionTokenAmount);

        // bidders from previous auction can claim
        vm.startPrank(bob);
        uint256 bobBalance = IERC20(auctionToken).balanceOf(bob);
        spice.claim(1);
        assertEq(IERC20(auctionToken).balanceOf(bob), bobBalance + epochOneTotalAuctionTokenAmount);
        assertEq(spice.epochsWithoutBidsRecovered(2), true);

        vm.startPrank(daoExecutor);
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.AlreadyRecovered.selector));
        spice.recoverAuctionTokenForZeroBidAuction(2, executor);
    }

    function test_recoverToken_spice() public {
        vm.startPrank(daoExecutor);
        address _fakeErc20TokenAddress = address(fakeERC20);
        // revert, invalid params
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        spice.recoverToken(_fakeErc20TokenAddress, address(0), 0);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        spice.recoverToken(_fakeErc20TokenAddress, alice, 0);

        dealAdditional(IERC20(_fakeErc20TokenAddress), address(spice), 50 ether);
        vm.expectEmit(address(spice));
        emit TokenRecovered(alice, _fakeErc20TokenAddress, 50 ether);
        spice.recoverToken(_fakeErc20TokenAddress, alice, 50 ether);
        assertEq(fakeERC20.balanceOf(alice), 50 ether);

        address _spiceToken = spice.spiceToken();
        address _templeGold = address(templeGold);
        uint256 recoverAmount = 1 ether;
        // _currentEpochId = 0
        // recover bid token, wrong amount
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        spice.recoverToken(_spiceToken, alice, recoverAmount+1);
        
        uint256 daoDaiBalanceBefore = IERC20(daiToken).balanceOf(daoExecutor);
        deal(address(daiToken), address(spice), recoverAmount, true);
        vm.expectEmit(address(spice));
        emit TokenRecovered(daoExecutor, daiToken, recoverAmount);
        vm.startPrank(daoExecutor);
        spice.recoverToken(_spiceToken, address(daoExecutor), recoverAmount);
        assertEq(recoverAmount+daoDaiBalanceBefore, IERC20(daiToken).balanceOf(daoExecutor));

        _startAuction(true, true);
        IAuctionBase.EpochInfo memory info = spice.getEpochInfo(1);
        vm.startPrank(daoExecutor);
        // cooldown still pending
        vm.warp(info.startTime - 60 seconds);
        vm.expectRevert(abi.encodeWithSelector(ISpiceAuction.RemoveAuctionConfig.selector));
        spice.recoverToken(_spiceToken, alice, recoverAmount);
        
        vm.warp(info.startTime);
        // auction active
        vm.expectRevert(abi.encodeWithSelector(ISpiceAuction.RemoveAuctionConfig.selector));
        spice.recoverToken(_spiceToken, alice, recoverAmount);
        vm.warp(info.endTime - 1);

        // some bids
        deal(daiToken, alice, 100 ether);
        deal(daiToken, bob, 100 ether);
        uint256 bidTokenAmount = 10 ether;
        vm.startPrank(alice);
        IERC20(daiToken).approve(address(spice), type(uint).max);
        spice.bid(bidTokenAmount);
        vm.startPrank(bob);
        IERC20(daiToken).approve(address(spice), type(uint).max);
        spice.bid(bidTokenAmount);
        vm.startPrank(daoExecutor);

        // auction still active
        vm.expectRevert(abi.encodeWithSelector(ISpiceAuction.RemoveAuctionConfig.selector));
        spice.recoverToken(_spiceToken, alice, recoverAmount);
        // auction ended
        vm.warp(info.endTime);
        IERC20 spiceTokenErc20 = IERC20(_spiceToken);
        dealAdditional(IERC20(daiToken), address(spice), recoverAmount);
        uint256 auctionTokenAllocation = info.totalAuctionTokenAmount;
        uint256 spiceBidTokenBalance = spiceTokenErc20.balanceOf(address(spice));
        uint256 aliceBidTokenBalance = spiceTokenErc20.balanceOf(address(alice));

        // recover bid token, wrong amount
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        spice.recoverToken(_spiceToken, alice, recoverAmount+1);
        // can recover bid token
        vm.expectEmit(address(spice));
        emit TokenRecovered(alice, daiToken, recoverAmount);
        spice.recoverToken(daiToken, alice, recoverAmount);
        assertEq(aliceBidTokenBalance+recoverAmount, spiceTokenErc20.balanceOf(alice));
        assertEq(spiceBidTokenBalance-recoverAmount, spiceTokenErc20.balanceOf(address(spice)));

        // recover auction token, wrong amount
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        spice.recoverToken(_templeGold, alice, recoverAmount+1);

        dealAdditional(IERC20(_templeGold), address(spice), recoverAmount);
        uint256 spiceTempleGoldBalance = templeGold.balanceOf(address(spice));
        uint256 aliceTempleGoldBalance = templeGold.balanceOf(alice);
        // recover auction token
        vm.expectEmit(address(spice));
        emit TokenRecovered(alice, _templeGold, recoverAmount);
        spice.recoverToken(_templeGold, alice, recoverAmount);
        assertEq(spiceTempleGoldBalance-recoverAmount, templeGold.balanceOf(address(spice)));
        assertEq(aliceTempleGoldBalance+recoverAmount, templeGold.balanceOf(alice));

        // after recover users can still claim
        vm.startPrank(alice);
        uint256 aliceClaimable = spice.getClaimableForEpoch(alice, 1);
        uint256 bobClaimable = spice.getClaimableForEpoch(bob, 1);
        vm.expectEmit(address(spice));
        emit Claim(alice, 1, bidTokenAmount, aliceClaimable);
        spice.claim(1);
        vm.startPrank(bob);
        vm.expectEmit(address(spice));
        emit Claim(bob, 1, bidTokenAmount, bobClaimable);
        spice.claim(1);
        assertEq(auctionTokenAllocation, bobClaimable+aliceClaimable);
    }

    function test_startSpiceAuction() public {
        // cannot start auction without setting configuration
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.CannotStartAuction.selector));
        spice.startAuction();

        // set config
        vm.startPrank(daoExecutor);
        ISpiceAuction.SpiceAuctionConfig memory _config = _getAuctionConfig();
        spice.setAuctionConfig(_config);

        // not starter
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        spice.startAuction();

        // time less than wait period
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.CannotStartAuction.selector));
        spice.startAuction();
        vm.warp(block.timestamp + _config.waitPeriod);
        // not enough auction tokens to bid. type AUCTION_TOKEN_BALANCE
        vm.expectRevert(abi.encodeWithSelector(ISpiceAuction.NotEnoughAuctionTokens.selector));
        spice.startAuction();

        IERC20 auctionToken = IERC20(_getAuctionToken(_config.isTempleGoldAuctionToken, daiToken));
        dealAdditional(auctionToken, address(spice), 100 ether);
        uint256 epoch = spice.currentEpoch();
        IAuctionBase.EpochInfo memory epochInfo = spice.getEpochInfo(epoch);
        uint64 startTime = uint64(block.timestamp + _config.startCooldown);
        uint64 endTime = uint64(startTime+_config.duration);
        vm.expectEmit(address(spice));
        emit AuctionStarted(epoch+1, alice, startTime, endTime, 100 ether);
        spice.startAuction();
        
        epochInfo = spice.getEpochInfo(epoch+1);
        assertEq(spice.currentEpoch(), epoch+1);
        assertEq(epochInfo.startTime, uint128(block.timestamp+_config.startCooldown));
        assertEq(epochInfo.endTime, uint128(epochInfo.startTime+_config.duration));
        assertEq(epochInfo.totalAuctionTokenAmount, 100 ether);
        assertEq(epochInfo.totalBidTokenAmount, 0);
        assertEq(auctionToken.balanceOf(address(spice)), 100 ether);
        assertEq(epochInfo.endTime - epochInfo.startTime, _config.duration);

        // warp to end and start second auction
        vm.warp(epochInfo.endTime);
        _config = _getAuctionConfig();
        // any address can start auction
        _config.starter = address(0);
        _config.startCooldown = 0;
        vm.startPrank(daoExecutor);
        spice.setAuctionConfig(_config);
        // epoch > 0
        // cannot start auction, waitPeriod error. wait period from previous auction config is used
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.CannotStartAuction.selector));
        spice.startAuction();

        // not enough auction tokens
        vm.warp(epochInfo.endTime + _config.waitPeriod);
        vm.expectRevert(abi.encodeWithSelector(ISpiceAuction.NotEnoughAuctionTokens.selector));
        spice.startAuction();

        dealAdditional(IERC20(_getAuctionToken(_config.isTempleGoldAuctionToken, daiToken)), address(spice), 50 ether);
        epoch = spice.currentEpoch();
        startTime = uint64(block.timestamp+_config.startCooldown);
        endTime = uint64(startTime+_config.duration);
        vm.expectEmit(address(spice));
        emit AuctionStarted(epoch+1, daoExecutor, startTime, endTime, 50 ether);
        spice.startAuction();

        // another auction , another auction token, user action to start auction
        _config = _getAuctionConfig();
        _config.isTempleGoldAuctionToken = false;
        _config.starter = address(0);
        epoch = spice.currentEpoch();
        epochInfo = spice.getEpochInfo(epoch);
        vm.warp(epochInfo.endTime + _config.waitPeriod);
        spice.setAuctionConfig(_config);
        // even for user first bid, auction tokens should not be less than configured value
        vm.expectRevert(abi.encodeWithSelector(ISpiceAuction.NotEnoughAuctionTokens.selector));
        spice.startAuction();

        startTime = uint64(block.timestamp + _config.startCooldown);
        endTime = uint64(startTime+_config.duration);
        deal(daiToken, address(spice), 30 ether, true);
        vm.expectEmit(address(spice));
        emit AuctionStarted(epoch+1, daoExecutor, startTime, endTime, 30 ether);
        spice.startAuction();
        epoch = spice.currentEpoch();
        epochInfo = spice.getEpochInfo(epoch);
        assertEq(epochInfo.startTime, startTime);
        assertEq(epochInfo.endTime, endTime);

        assertEq(IERC20(daiToken).balanceOf(address(spice)), 30 ether);
        assertEq(templeGold.balanceOf(address(spice)), 150 ether);
    }

    function test_bidSpiceAuction() public {
        deal(daiToken, alice, 100 ether);
        deal(daiToken, bob, 100 ether);
        uint256 aliceBidAmount = 20 ether;
        uint256 bobBidAmount = 30 ether;
        // cannot deposit
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.CannotDeposit.selector));
        spice.bid(10 ether);
        
        // start auction
        ISpiceAuction.SpiceAuctionConfig memory _config =  _startAuction(true, true);
        uint256 epoch = spice.currentEpoch();
        IAuctionBase.EpochInfo memory epochInfo = spice.getEpochInfo(epoch);
        vm.warp(epochInfo.startTime);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        spice.bid(0);

        IERC20(daiToken).approve(address(spice), type(uint).max);
        vm.expectEmit(address(spice));
        emit Deposit(alice, epoch, aliceBidAmount);
        spice.bid(aliceBidAmount);

        assertEq(spice.getAuctionBidAmount(1), aliceBidAmount);
        assertEq(spice.getAuctionTokenAmount(1), 100 ether);
        assertEq(IERC20(daiToken).balanceOf(alice), 100 ether-aliceBidAmount);
        assertEq(IERC20(daiToken).balanceOf(_config.recipient), aliceBidAmount);
        epochInfo = spice.getEpochInfo(epoch);
        assertEq(epochInfo.totalBidTokenAmount, aliceBidAmount);
        assertEq(spice.getAuctionBidAmount(1), epochInfo.totalBidTokenAmount);
        assertEq(epochInfo.totalAuctionTokenAmount, 100 ether);
        assertEq(spice.depositors(alice, epoch), aliceBidAmount);
        assertEq(spice.getClaimableForEpoch(alice, epoch), 100 ether);

        // bob bidding
        vm.startPrank(bob);
        IERC20(daiToken).approve(address(spice), type(uint).max);
        vm.expectEmit(address(spice));
        emit Deposit(bob, epoch, bobBidAmount);
        spice.bid(bobBidAmount);

        assertEq(spice.getAuctionBidAmount(1), aliceBidAmount+bobBidAmount);
        assertEq(spice.getAuctionTokenAmount(1), 100 ether);
        assertEq(IERC20(daiToken).balanceOf(alice), 100 ether-aliceBidAmount);
        assertEq(IERC20(daiToken).balanceOf(_config.recipient), aliceBidAmount+bobBidAmount);
        epochInfo = spice.getEpochInfo(epoch);
        assertEq(epochInfo.totalBidTokenAmount, aliceBidAmount+bobBidAmount);
        assertEq(epochInfo.totalAuctionTokenAmount, 100 ether);
        assertEq(spice.depositors(alice, epoch), aliceBidAmount);
        assertEq(spice.depositors(bob, epoch), bobBidAmount);
        assertEq(spice.getClaimableForEpoch(alice, epoch), 40 ether);
        assertEq(spice.getClaimableForEpoch(bob, epoch), 60 ether);

        // bob bids more
        spice.bid(50 ether);
        assertEq(spice.getAuctionBidAmount(1), 50 ether+aliceBidAmount+bobBidAmount);
        assertEq(spice.getAuctionTokenAmount(1), 100 ether);
        assertEq(IERC20(daiToken).balanceOf(alice), 100 ether-aliceBidAmount);
        assertEq(IERC20(daiToken).balanceOf(treasury), aliceBidAmount+bobBidAmount+50 ether);
        epochInfo = spice.getEpochInfo(epoch);
        assertEq(epochInfo.totalBidTokenAmount, aliceBidAmount+bobBidAmount+50 ether);
        assertEq(epochInfo.totalAuctionTokenAmount, 100 ether);
        assertEq(spice.depositors(alice, epoch), aliceBidAmount);
        assertEq(spice.depositors(bob, epoch), bobBidAmount+50 ether);
        assertEq(spice.getClaimableForEpoch(alice, epoch), 100 ether * 20/100);
        assertEq(spice.getClaimableForEpoch(bob, epoch), 100 ether * 80/100);
    }

    function test_claimSpiceAuction() public {
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.InvalidEpoch.selector));
        spice.claim(1);
        ISpiceAuction.SpiceAuctionConfig memory _config = _startAuction(true, true);
        uint256 epoch = spice.currentEpoch();
        IAuctionBase.EpochInfo memory epochInfo = spice.getEpochInfo(epoch);
        // cannot claim before active auction
        vm.warp(epochInfo.startTime - 1);
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.CannotClaim.selector, 1));
        spice.claim(1);
        vm.warp(epochInfo.startTime);
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.CannotClaim.selector, 1));
        spice.claim(1);
        vm.warp(epochInfo.endTime+_config.waitPeriod);

        _config = _startAuction(true, true);
        epoch = spice.currentEpoch();
        epochInfo = spice.getEpochInfo(epoch);
        vm.warp(epochInfo.startTime+_config.startCooldown);

        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        spice.claim(1);

        deal(daiToken, alice, 100 ether);
        deal(daiToken, bob, 100 ether);
        uint256 aliceBidAmount = 20 ether;
        uint256 bobBidAmount = 30 ether;

        IERC20(daiToken).approve(address(spice), type(uint).max);
        spice.bid(aliceBidAmount);

        vm.startPrank(bob);
        IERC20(daiToken).approve(address(spice), type(uint).max);
        spice.bid(bobBidAmount);

        // still cannot claim because auction is not ended
        epoch = spice.currentEpoch();
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.CannotClaim.selector, epoch));
        spice.claim(epoch);
        epochInfo = spice.getEpochInfo(epoch);
        vm.warp(epochInfo.endTime+_config.waitPeriod);
        uint256 bobTGoldBalance = templeGold.balanceOf(bob);
        uint256 aliceTGoldBalance = templeGold.balanceOf(alice);
        uint256 bobClaimAmount = spice.getClaimableForEpoch(bob, epoch);
        uint256 aliceClaimAmount = spice.getClaimableForEpoch(alice, epoch);
        vm.expectEmit(address(spice));
        emit Claim(bob, epoch, bobBidAmount, bobClaimAmount);
        spice.claim(epoch);
        assertEq(templeGold.balanceOf(bob), bobTGoldBalance+bobClaimAmount);
        assertEq(bobClaimAmount, 100 ether * 30/50);

        vm.startPrank(alice);
        vm.expectEmit(address(spice));
        emit Claim(alice, epoch, aliceBidAmount, aliceClaimAmount);
        spice.claim(epoch);
        assertEq(templeGold.balanceOf(alice), aliceTGoldBalance+aliceClaimAmount);
        assertEq(aliceClaimAmount, 100 ether * 20/50);

        assertEq(spice.getClaimableForEpoch(alice, epoch), 0);
        assertEq(spice.getClaimableForEpoch(alice, epoch+1), 0);
        assertEq(spice.claimedAmount(alice, epoch), aliceClaimAmount);
        assertEq(spice.claimed(alice, epoch), true);

        // try to claim and fail
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.AlreadyClaimed.selector));
        spice.claim(epoch);
    }

    function test_claim_tgld_is_bid_token() public {
        {
            _setVestingFactor();
            // authorize for transfers
            vm.startPrank(executor);
            templeGold.authorizeContract(mike, true);
            templeGold.authorizeContract(treasury, true);
            skip(4 weeks);
            templeGold.mint();
            // team gnosis
            vm.startPrank(mike);
            // distribute TGLD to alice and bob
            IERC20(templeGold).transfer(bob, 100 ether);
            IERC20(templeGold).transfer(alice, 100 ether);
        }

        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.InvalidEpoch.selector));
        spice.claim(1);

        uint256 aliceBidAmount = 20 ether;
        uint256 bobBidAmount = 30 ether;

        ISpiceAuction.SpiceAuctionConfig memory config = _getAuctionConfig();
        {
            // tgld as bid token
            config.isTempleGoldAuctionToken = false;
            vm.startPrank(daoExecutor);
            spice.setAuctionConfig(config);
            deal(daiToken, address(spice), 500 ether);
            emit log_address(config.starter);
            vm.startPrank(alice);
            spice.startAuction();
            // skip cooldown
            skip(config.startCooldown);
        }
        uint256 currentEpoch = spice.currentEpoch();
        // bids
        vm.startPrank(alice);
        IERC20(templeGold).approve(address(spice), type(uint).max);
        vm.expectEmit(address(spice));
        emit Deposit(alice, currentEpoch, aliceBidAmount);
        spice.bid(aliceBidAmount);

        vm.startPrank(bob);
        IERC20(templeGold).approve(address(spice), type(uint).max);
        vm.expectEmit(address(spice));
        emit Deposit(bob, currentEpoch, bobBidAmount);
        spice.bid(bobBidAmount);
            
        assertEq(spice.depositors(alice, currentEpoch), aliceBidAmount);
        assertEq(spice.depositors(bob, currentEpoch), bobBidAmount);
        IAuctionBase.EpochInfo memory epochInfo = spice.getEpochInfo(currentEpoch);
        assertEq(epochInfo.totalBidTokenAmount, aliceBidAmount+bobBidAmount);
        
        uint256 totalTgldBid = (spice.getEpochInfo(spice.currentEpoch())).totalBidTokenAmount;
        assertEq(totalTgldBid, aliceBidAmount+bobBidAmount);
       
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.InvalidEpoch.selector));
        spice.claim(currentEpoch+1);
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.CannotClaim.selector, currentEpoch));
        spice.claim(currentEpoch);
        vm.warp(epochInfo.endTime);

        vm.startPrank(mike);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        spice.claim(currentEpoch);

        uint256 balanceBefore = IERC20(daiToken).balanceOf(alice);
        emit log_string("balance before");
        emit log_uint(balanceBefore);
        uint256 claimAmount = 2*epochInfo.totalAuctionTokenAmount/5;
        vm.startPrank(alice);
        vm.expectEmit(address(spice));
        emit Claim(alice, currentEpoch, aliceBidAmount, claimAmount);
        spice.claim(currentEpoch);
        assertEq(IERC20(daiToken).balanceOf(alice), balanceBefore+claimAmount);

        vm.startPrank(bob);
        balanceBefore = IERC20(daiToken).balanceOf(bob);
        claimAmount = epochInfo.totalAuctionTokenAmount-claimAmount;
        vm.expectEmit(address(spice));
        emit Claim(bob, currentEpoch, bobBidAmount, claimAmount);
        spice.claim(currentEpoch);
        assertEq(IERC20(daiToken).balanceOf(bob), balanceBefore+claimAmount);
    }

    function test_withdrawEth_spice() public {
        vm.startPrank(daoExecutor);
        spice.setOperator(mike);
        // access
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        spice.withdrawEth(payable(alice), 1 ether);

        vm.startPrank(daoExecutor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        spice.withdrawEth(payable(address(0)), 1 ether);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        spice.withdrawEth(payable(alice), 0);

        vm.deal(address(spice), 2 ether);
        // operator withdraw
        vm.startPrank(mike);
        uint256 balanceBefore = address(alice).balance;
        spice.withdrawEth(payable(alice), 1 ether);
        assertEq(alice.balance, balanceBefore+1 ether);

        // dao executor withdraw
        vm.startPrank(daoExecutor);
        balanceBefore = address(daoExecutor).balance;
        spice.withdrawEth(payable(daoExecutor), 1 ether);
        assertEq(daoExecutor.balance, balanceBefore+1 ether);
        assertEq(address(spice).balance, 0);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InsufficientBalance.selector, address(0), 1 ether, 0));
        spice.withdrawEth(payable(alice), 1 ether);
    }

    function test_setOperator() public {
        // access
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        spice.setOperator(alice);

        vm.startPrank(daoExecutor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        spice.setOperator(address(0));

        vm.expectEmit(address(spice));
        emit OperatorSet(alice);
        spice.setOperator(alice);
    }
}