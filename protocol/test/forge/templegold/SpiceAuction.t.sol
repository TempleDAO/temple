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

contract SpiceAuctionTestBase is TempleGoldCommon {
    event Deposit(address indexed depositor, uint256 epochId, uint256 amount);
    event AuctionConfigSet(uint256 epoch, ISpiceAuction.SpiceAuctionConfig config);
    event AuctionConfigRemoved(uint256 epochId);
    event AuctionStarted(uint256 epochId, address indexed starter, uint64 startTime, uint64 endTime, uint256 auctionTokenAmount);

    address public daoExecutor = makeAddr("daoExecutor");

    /// @notice Auctions run for minimum 1 week
    uint32 public constant MINIMUM_AUCTION_PERIOD = 604_800;

    ISpiceAuction public spice;
    SpiceAuctionFactory public factory;
    TempleGold public templeGold;

    function setUp() public {
        fork("arbitrum_one", forkBlockNumber);

        ITempleGold.InitArgs memory initArgs;
        initArgs.executor = executor;
        initArgs.staking = address(0);
        initArgs.escrow = address(0);
        initArgs.gnosis = teamGnosis;
        initArgs.layerZeroEndpoint = layerZeroEndpointArbitrumOne;
        initArgs.mintChainId = arbitrumOneChainId;
        initArgs.name = TEMPLE_GOLD_NAME;
        initArgs.symbol = TEMPLE_GOLD_SYMBOL;

        templeGold = new TempleGold(initArgs);
        factory = new SpiceAuctionFactory(rescuer, executor, daoExecutor, treasury, address(templeGold));
        vm.startPrank(executor);
        spice = ISpiceAuction(factory.createAuction(daiToken, NAME_ONE));
        vm.stopPrank();
    }

    function test_initialization() public {
        assertEq(spice.name(), NAME_ONE);
        assertEq(spice.templeGold(), address(templeGold));
        assertEq(spice.spiceToken(), daiToken);
        assertEq(spice.daoExecutor(), daoExecutor);
    }

    function _getAuctionConfig() internal view returns (ISpiceAuction.SpiceAuctionConfig memory config) {
        // uint32 duration;
        // /// @notice Minimum time between successive auctions
        // uint32 waitPeriod;
        // /// @notice Cooldown after auction start is triggered, to allow deposits
        // uint32 startCooldown;
        // /// @notice Minimum Gold distributed to enable auction start
        // uint160 minimumDistributedAuctionToken;
        // /// @notice Address to start next auction when all criteria are met. Address zero means anyone can trigger start
        // address starter;
        // /// @notice Which token is the bid token
        // AuctionToken auctionToken;
        // /// @notice Mode of auction activation
        // ActivationMode activationMode;
        // /// @notice Auction proceeds recipient
        // address recipient;
        config.duration = 7 days;
        config.waitPeriod = 2 weeks;
        config.minimumDistributedAuctionToken = 1 ether;
        config.starter = alice;
        config.startCooldown = 1 hours;
        config.isTempleGoldAuctionToken = true;
        ISpiceAuction.ActivationMode mode = ISpiceAuction.ActivationMode.AUCTION_TOKEN_BALANCE;
        config.activationMode = mode;
        config.recipient = treasury;
        // ISpiceAuction.AuctionToken auctionToken = ISpiceAuction.SpiceAuctionToken.TOKEN_A;
        // config.auctionToken = 
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
}

contract SpiceAuctionAccessTest is SpiceAuctionTestBase {
    function test_access_setSpiceAuctionConfigFail() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        spice.setAuctionConfig(_getAuctionConfig());
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
        vm.startPrank(daoExecutor);
        spice.setAuctionConfig(_getAuctionConfig());
        spice.removeAuctionConfig();
    }
}

contract SpiceAuctionTest is SpiceAuctionTestBase {

    function test_setSpiceAuctionConfig() public {
        ISpiceAuction.SpiceAuctionConfig memory config = _getAuctionConfig();
        config.duration = 1;
        vm.startPrank(daoExecutor);
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
        assertEq(uint8(_config.activationMode), uint8(ISpiceAuction.ActivationMode.AUCTION_TOKEN_BALANCE));
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
        // removing config which does not exist
        vm.startPrank(daoExecutor);
        vm.expectRevert(abi.encodeWithSelector(ISpiceAuction.InvalidConfigOperation.selector));
        spice.removeAuctionConfig();

        ISpiceAuction.SpiceAuctionConfig memory _config = _startAuction(true, true);
        vm.warp(block.timestamp + _config.startCooldown);
        // removing config for ongoing auction
        vm.startPrank(daoExecutor);
        vm.expectRevert(abi.encodeWithSelector(ISpiceAuction.InvalidConfigOperation.selector));
        spice.removeAuctionConfig();

        uint256 epoch = spice.currentEpoch();
        IAuctionBase.EpochInfo memory epochInfo = spice.getEpochInfo(epoch);
        vm.warp(epochInfo.endTime+1);

        vm.startPrank(daoExecutor);
        spice.setAuctionConfig(_getAuctionConfig());
        epoch = spice.currentEpoch();
        vm.expectEmit(address(spice));
        emit AuctionConfigRemoved(epoch);
        spice.removeAuctionConfig();
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
        vm.expectEmit(address(spice));
        emit AuctionStarted(epoch+1, alice, uint64(block.timestamp+_config.startCooldown), uint64(block.timestamp+_config.duration), 100 ether);
        spice.startAuction();
        
        IAuctionBase.EpochInfo memory epochInfo = spice.getEpochInfo(epoch+1);
        assertEq(spice.currentEpoch(), epoch+1);
        assertEq(epochInfo.startTime, uint64(block.timestamp+_config.startCooldown));
        assertEq(epochInfo.endTime, uint64(block.timestamp+_config.duration));
        assertEq(epochInfo.totalAuctionTokenAmount, 100 ether);
        assertEq(epochInfo.totalBidTokenAmount, 0);
        assertEq(auctionToken.balanceOf(address(spice)), 100 ether);

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
        vm.expectEmit(address(spice));
        emit AuctionStarted(epoch+1, daoExecutor, uint64(block.timestamp+_config.startCooldown), uint64(block.timestamp+_config.duration), 50 ether);
        spice.startAuction();

        // another auction , another auction token, user action to start auction . type USER_FIRST_BID
        _config = _getAuctionConfig();
        _config.isTempleGoldAuctionToken = false;
        _config.starter = address(0);
        _config.activationMode = ISpiceAuction.ActivationMode.USER_FIRST_BID;
        epoch = spice.currentEpoch();
        epochInfo = spice.getEpochInfo(epoch);
        vm.warp(epochInfo.endTime + _config.waitPeriod);
        spice.setAuctionConfig(_config);
        // even for user first bid, auction tokens should not be less than configured value
        vm.expectRevert(abi.encodeWithSelector(ISpiceAuction.NotEnoughAuctionTokens.selector));
        spice.startAuction();

        deal(daiToken, address(spice), 30 ether, true);
        vm.expectEmit(address(spice));
        emit AuctionStarted(epoch+1, daoExecutor, uint64(block.timestamp+_config.startCooldown), uint64(block.timestamp+_config.duration), 30 ether);
        spice.startAuction();

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
        ISpiceAuction.SpiceAuctionConfig memory _config = _startAuction(true, true);
        uint256 epoch = spice.currentEpoch();
        IAuctionBase.EpochInfo memory epochInfo = spice.getEpochInfo(epoch);
        vm.warp(epochInfo.startTime);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        spice.bid(0);

        IERC20(daiToken).approve(address(spice), type(uint).max);
        vm.expectEmit(address(spice));
        emit Deposit(alice, epoch, aliceBidAmount);
        spice.bid(aliceBidAmount);

        assertEq(IERC20(daiToken).balanceOf(alice), 100 ether-aliceBidAmount);
        assertEq(IERC20(daiToken).balanceOf(treasury), aliceBidAmount);
        epochInfo = spice.getEpochInfo(epoch);
        assertEq(epochInfo.totalBidTokenAmount, aliceBidAmount);
        assertEq(epochInfo.totalAuctionTokenAmount, 100 ether);
        assertEq(spice.depositors(alice, epoch), aliceBidAmount);
        assertEq(spice.getClaimableAtCurrentTimestamp(alice, epoch), 100 ether);

        // bob bidding
        vm.startPrank(bob);
        IERC20(daiToken).approve(address(spice), type(uint).max);
        vm.expectEmit(address(spice));
        emit Deposit(bob, epoch, bobBidAmount);
        spice.bid(bobBidAmount);

        assertEq(IERC20(daiToken).balanceOf(alice), 100 ether-aliceBidAmount);
        assertEq(IERC20(daiToken).balanceOf(treasury), aliceBidAmount+bobBidAmount);
        epochInfo = spice.getEpochInfo(epoch);
        assertEq(epochInfo.totalBidTokenAmount, aliceBidAmount+bobBidAmount);
        assertEq(epochInfo.totalAuctionTokenAmount, 100 ether);
        assertEq(spice.depositors(alice, epoch), aliceBidAmount);
        assertEq(spice.depositors(bob, epoch), bobBidAmount);
        assertEq(spice.getClaimableAtCurrentTimestamp(alice, epoch), 40 ether);
        assertEq(spice.getClaimableAtCurrentTimestamp(bob, epoch), 60 ether);

        // bob bids more
        spice.bid(50 ether);
        assertEq(IERC20(daiToken).balanceOf(alice), 100 ether-aliceBidAmount);
        assertEq(IERC20(daiToken).balanceOf(treasury), aliceBidAmount+bobBidAmount+50 ether);
        epochInfo = spice.getEpochInfo(epoch);
        assertEq(epochInfo.totalBidTokenAmount, aliceBidAmount+bobBidAmount+50 ether);
        assertEq(epochInfo.totalAuctionTokenAmount, 100 ether);
        assertEq(spice.depositors(alice, epoch), aliceBidAmount);
        assertEq(spice.depositors(bob, epoch), bobBidAmount+50 ether);
        assertEq(spice.getClaimableAtCurrentTimestamp(alice, epoch), 100 ether * 20/100);
        assertEq(spice.getClaimableAtCurrentTimestamp(bob, epoch), 100 ether * 80/100);
    }
}