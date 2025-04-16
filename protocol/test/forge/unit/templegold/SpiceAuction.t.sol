pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// (tests/forge/templegold/SpiceAuction.t.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import { ITempleGold } from "contracts/interfaces/templegold/ITempleGold.sol";
import { ISpiceAuction } from "contracts/interfaces/templegold/ISpiceAuction.sol";
import { IAuctionBase } from "contracts/interfaces/templegold/IAuctionBase.sol";

import { TempleGoldCommon } from "test/forge/unit/templegold/TempleGoldCommon.t.sol";
import { SpiceAuctionFactory } from "contracts/templegold/SpiceAuctionFactory.sol";
import { TempleGold } from "contracts/templegold/TempleGold.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";
import { TempleGoldStaking } from "contracts/templegold/TempleGoldStaking.sol";
import { StableGoldAuction } from "contracts/templegold/StableGoldAuction.sol";
import { SpiceAuction } from "contracts/templegold/SpiceAuction.sol";

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
    event SpiceAuctionEpochSet(uint256 epoch, address auctionToken, uint128 startTime, uint128 endTime, uint256 amount);

    address internal daoExecutor = makeAddr("daoExecutor");

    address internal cssGnosis = makeAddr("cssGnosis");

    SpiceAuction internal implementation;

    FakeERC20 internal TEMPLE_TOKEN;

    TempleGoldStaking internal staking;

    /// @notice Auctions run for minimum 1 week
    uint32 internal constant MINIMUM_AUCTION_DURATION = 604_800;

    uint32 internal constant MAXIMUM_AUCTION_DURATION = 30 days;

    ISpiceAuction internal spice;

    SpiceAuctionFactory internal factory;

    TempleGold internal TGLD;

    StableGoldAuction internal auction;

    uint256 internal _deployTs;

    function setUp() public {
        fork("arbitrum_one", forkBlockNumber);

        ITempleGold.InitArgs memory initArgs = _getTempleGoldInitArgs();
        
        TGLD = new TempleGold(initArgs);
        TEMPLE_TOKEN = new FakeERC20("Temple Token", "TEMPLE", executor, 1000 ether);
        staking = new TempleGoldStaking(rescuer, executor, address(TEMPLE_TOKEN), address(TGLD));
        implementation = new SpiceAuction();
        factory = new SpiceAuctionFactory(address(implementation), rescuer, executor, daoExecutor, mike, cssGnosis,
            address(TGLD), ARBITRUM_ONE_LZ_EID, uint32(arbitrumOneChainId));
        fakeERC20 = new FakeERC20("FAKE TOKEN", "FAKE", executor, 1000 ether);
        auction = new StableGoldAuction(
            address(TGLD),
            address(fakeERC20),
            treasury,
            rescuer,
            executor,
            executor
        );
        vm.startPrank(executor);
        spice = ISpiceAuction(factory.createAuction(daiToken, NAME_ONE));
        _deployTs = block.timestamp;
        TGLD.authorizeContract(address(spice), true);
        TGLD.authorizeContract(cssGnosis, true);
        TGLD.setStaking(address(staking));
        TGLD.setTeamGnosis(mike);
        TGLD.setStableGoldAuction(address(auction));
        vm.stopPrank();
    }

    function test_initialization() public view {
        assertEq(spice.name(), NAME_ONE);
        assertEq(spice.templeGold(), address(TGLD));
        assertEq(spice.spiceToken(), daiToken);
        assertEq(spice.daoExecutor(), daoExecutor);
        assertEq(spice.operator(), mike);
        assertEq(spice.MINIMUM_AUCTION_DURATION(), MINIMUM_AUCTION_DURATION);
        assertEq(spice.MAXIMUM_AUCTION_DURATION(), MAXIMUM_AUCTION_DURATION);
    }

    function _getAuctionConfig() internal view returns (ISpiceAuction.SpiceAuctionConfig memory config) {
        config.duration = 7 days;
        config.waitPeriod = 2 weeks;
        config.minimumDistributedAuctionToken = 1 ether;
        config.isTempleGoldAuctionToken = true;
        config.recipient = treasury;
    }

    function _setAuctionConfig() private returns ( ISpiceAuction.SpiceAuctionConfig memory config){
        config = _getAuctionConfig();
        vm.startPrank(daoExecutor);
        spice.setAuctionConfig(config);
        vm.stopPrank();
    }

    function _startAuction(
        bool _setConfig,
        bool _sendAuctionTokens
    ) internal returns (ISpiceAuction.SpiceAuctionConfig memory config) {
        if (_setConfig) { 
            config = _setAuctionConfig(); 
        } else {
            uint256 epochId = spice.currentEpoch();
            config = spice.getAuctionConfig(epochId+1);
        }
        uint256 startTime = block.timestamp + config.waitPeriod;
        if (_sendAuctionTokens) { _fundNextAuction(config, uint128(startTime)); }
        vm.warp(startTime);
    }

    function _getAuctionToken(bool _isTempleGoldAuctionToken, address _spiceToken) internal view returns (address) {
        return _isTempleGoldAuctionToken ? address(TGLD) : _spiceToken;
    }

    function _setVestingFactor() internal {
        ITempleGold.VestingFactor memory _factor = _getVestingFactor();
        _factor.value = 35;
        _factor.weekMultiplier = 1 weeks;
        vm.startPrank(executor);
        TGLD.setVestingFactor(_factor);
    }

    function _fundNextAuction(
        ISpiceAuction.SpiceAuctionConfig memory config,
        uint128 startTime
    ) internal {
        address auctionToken = config.isTempleGoldAuctionToken ? address(TGLD) : spice.spiceToken();
        uint256 amount = 100 ether;
        dealAdditional(IERC20(auctionToken), cssGnosis, amount);
        vm.startPrank(cssGnosis);
        IERC20(auctionToken).approve(address(spice), amount);
        spice.fundNextAuction(amount, startTime);
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
        ISpiceAuction.EpochInfo memory info = spice.getEpochInfo(spice.currentEpoch());
        vm.warp(info.endTime);
        spice.setAuctionConfig(_getAuctionConfig());
        spice.removeAuctionConfig();
    }

    function test_access_fundNextAuctionFail() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        spice.fundNextAuction(1, uint128(block.timestamp));
    }

    function test_access_fundNextAuctionSuccess() public {
        vm.startPrank(cssGnosis);
        uint128 startTime = uint128(block.timestamp+1);
        // use mock to bypass setting config before call
        vm.mockCall(
            address(spice),
            abi.encodeWithSelector(ISpiceAuction.fundNextAuction.selector, 1, startTime),
            abi.encode(0)
        );
        spice.fundNextAuction(1, startTime);
        vm.clearMockedCalls();
    }

    function test_access_recoverAuctionTokenForBidlessAuctionsFail() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        spice.recoverAuctionTokenForZeroBidAuction(1, address(0));
    }

    function test_access_recoverAuctionTokenForBidlessAuctionsSuccess() public {
        ISpiceAuction.SpiceAuctionConfig memory config = _getAuctionConfig();
        vm.startPrank(daoExecutor);
        spice.setAuctionConfig(config);
        vm.startPrank(cssGnosis);
        _fundNextAuction(config, uint128(block.timestamp+config.waitPeriod));
        IAuctionBase.EpochInfo memory info = spice.getEpochInfo(spice.currentEpoch());
        vm.warp(info.endTime);
        spice.recoverAuctionTokenForZeroBidAuction(1, address(0));
    }
}

contract SpiceAuctionViewTest is SpiceAuctionTestBase {
    function test_getAuctionTokenForCurrentEpoch() public {
        ISpiceAuction.SpiceAuctionConfig memory _config = _startAuction(true, true);
        address auctionToken = _config.isTempleGoldAuctionToken ? address(TGLD) : spice.spiceToken();
        assertEq(auctionToken, spice.getAuctionTokenForCurrentEpoch());
    }

    function test_is_current_epoch_active_spice() public {
        assertEq(spice.isActive(), false);
        _startAuction(true, true);
        assertEq(spice.isActive(), true);
        IAuctionBase.EpochInfo memory _info = spice.getEpochInfo(1);
        vm.warp(_info.endTime);
        assertEq(spice.isActive(), false);
    }

    // function test_getClaimableForEpoch() public {
    //     // bid token == 0
    //     ISpiceAuction.TokenAmount memory claimable = spice.getClaimableForEpoch(alice, 0);
    //     assertEq(claimable.amount, 0);
    //     assertEq(claimable.token, address(0));

    //     _startAuction(true, true);
    //     vm.startPrank(alice);
    //     deal(daiToken, alice, 100 ether);
    //     IERC20(daiToken).approve(address(spice), type(uint).max);
    //     // epoch > 1 . current epoch is 1
    //     claimable = spice.getClaimableForEpoch(alice, 2);
    //     assertEq(claimable.amount, 0);
    //     assertEq(claimable.token, address(0));
        
    //     // see claim and bid tests
    // }

    function test_currentEpoch() public {
        // see claim and bid tests
    }

    function test_get_claimable_and_claimed_for_epochs() public {
        vm.startPrank(executor);
        TGLD.authorizeContract(treasury, true);
        // create and bid a couple of epochs
        deal(daiToken, alice, 100 ether);
        deal(address(TGLD), alice, 100 ether);
        deal(address(TGLD), bob, 100 ether);
        uint256 bidAmount = 10 ether;
        
        // start auction
        ISpiceAuction.SpiceAuctionConfig memory _config = _startAuction(true, true);
        uint256 epoch = spice.currentEpoch();
        IAuctionBase.EpochInfo memory epochInfo = spice.getEpochInfo(epoch);
        vm.warp(epochInfo.startTime);

        vm.startPrank(alice);
        IERC20(daiToken).approve(address(spice), type(uint).max);

        spice.bid(bidAmount);
        // end auction
        vm.warp(epochInfo.endTime);
        // claimable is full amount
        uint256[] memory epochs = new uint256[](1);
        epochs[0] = epoch;
        ISpiceAuction.TokenAmount[] memory claimable = spice.getClaimableForEpochs(alice, epochs);
        ISpiceAuction.TokenAmount[] memory claimed = spice.getClaimedForEpochs(alice, epochs);
        assertEq(claimable[0].amount, epochInfo.totalAuctionTokenAmount);
        assertEq(claimable[0].token, address(TGLD));
        assertEq(claimed[0].amount, 0);
        assertEq(claimed[0].token, address(TGLD));
        assertEq(spice.accountTotalClaimed(alice, address(TGLD)), 0);
        assertEq(spice.accountTotalClaimed(alice, spice.spiceToken()), 0);

        // claim and check
        vm.warp(epochInfo.endTime);
        spice.claim(epoch);
        uint256 aliceSpiceTotalClaimed = spice.accountTotalClaimed(alice, spice.spiceToken());
        uint256 aliceTGldClaimed = spice.accountTotalClaimed(alice, address(TGLD));
        claimable = spice.getClaimableForEpochs(alice, epochs);
        claimed = spice.getClaimedForEpochs(alice, epochs);
        assertEq(claimable[0].amount, 0);
        assertEq(claimed[0].amount, epochInfo.totalAuctionTokenAmount);
        assertEq(aliceTGldClaimed, epochInfo.totalAuctionTokenAmount);
        assertEq(aliceSpiceTotalClaimed, 0);

        skip(_config.waitPeriod);
        _config = _getAuctionConfig();
        _config.isTempleGoldAuctionToken = false;
        vm.startPrank(daoExecutor);
        spice.setAuctionConfig(_config);
        _config = _startAuction(false, true);
        epoch = spice.currentEpoch();
        epochInfo = spice.getEpochInfo(epoch);
        vm.warp(epochInfo.startTime);

        vm.startPrank(alice);
        IERC20(address(TGLD)).approve(address(spice), type(uint).max);
        spice.bid(bidAmount);
        vm.startPrank(bob);
        IERC20(address(TGLD)).approve(address(spice), type(uint).max);
        spice.bid(bidAmount);
        
        vm.warp(epochInfo.endTime);
        uint256 expectedClaimable = epochInfo.totalAuctionTokenAmount/2;
        epochs = new uint256[](2);
        epochs[0] = 1;
        epochs[1] = 2;
        claimable = new ISpiceAuction.TokenAmount[](2);
        claimable = spice.getClaimableForEpochs(alice, epochs);
        assertEq(claimable[0].amount, 0);
        assertEq(claimable[1].amount, expectedClaimable);
        assertEq(claimable[1].token, daiToken);
        claimable = spice.getClaimableForEpochs(bob, epochs);
        assertEq(claimable[0].amount, 0);
        assertEq(claimable[1].token, daiToken);
        assertEq(claimable[1].amount, expectedClaimable);
        assertEq(claimable[1].token, daiToken);
        claimed = new ISpiceAuction.TokenAmount[](2);
        claimed = spice.getClaimedForEpochs(alice, epochs);
        assertEq(claimed[0].amount, aliceTGldClaimed);
        assertEq(claimed[1].amount, 0);
        claimed = spice.getClaimedForEpochs(bob, epochs);
        assertEq(claimed[0].amount, 0);
        assertEq(claimed[1].amount, 0);
        
        uint256 currentEpoch = spice.currentEpoch();
        spice.claim(currentEpoch);
        vm.startPrank(alice);
        spice.claim(currentEpoch);
        assertEq(spice.accountTotalClaimed(alice, address(TGLD)), aliceTGldClaimed);
        assertEq(spice.accountTotalClaimed(alice, spice.spiceToken()), aliceSpiceTotalClaimed+expectedClaimable);
        assertEq(spice.accountTotalClaimed(bob, address(TGLD)), 0);
        assertEq(spice.accountTotalClaimed(bob, spice.spiceToken()), expectedClaimable);
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

        _startAuction(false, true);
        // trying to set config for ongoing auction error
        vm.startPrank(daoExecutor);
        vm.expectRevert(abi.encodeWithSelector(ISpiceAuction.InvalidConfigOperation.selector));
        spice.setAuctionConfig(config);

        epochId = spice.currentEpoch();
        IAuctionBase.EpochInfo memory info = spice.getEpochInfo(epochId);
        vm.warp(_config.waitPeriod+info.endTime);
        vm.startPrank(daoExecutor);
        spice.setAuctionConfig(_config);
        // fund auction
        uint128 startTime = uint128(block.timestamp + _config.waitPeriod + 3 days);
        _fundNextAuction(_config, startTime);
        vm.warp(startTime - 1 seconds);
        vm.startPrank(daoExecutor);
        vm.expectRevert(abi.encodeWithSelector(ISpiceAuction.AuctionFunded.selector));
        spice.setAuctionConfig(config);

        epochId = spice.currentEpoch();
        info = spice.getEpochInfo(epochId);
        vm.warp(info.endTime+_config.waitPeriod);
        vm.expectEmit(address(spice));
        emit AuctionConfigSet(epochId+1, _config);
        spice.setAuctionConfig(_config);
        assertEq(spice.currentEpoch(), epochId);
    }

    function test_removeAuctionConfig() public {
        vm.startPrank(daoExecutor);
        // revert, no epoch
        vm.expectRevert(abi.encodeWithSelector(ISpiceAuction.InvalidConfigOperation.selector));
        spice.removeAuctionConfig();

        ISpiceAuction.SpiceAuctionConfig memory _config = _startAuction(true, true);
        vm.startPrank(daoExecutor);
        // revert , auction active
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.AuctionActive.selector));
        spice.removeAuctionConfig();

        // config set but auction not funded
        IAuctionBase.EpochInfo memory info = spice.getEpochInfo(1);
        vm.warp(info.endTime + _config.waitPeriod);
        _config = _getAuctionConfig();
        spice.setAuctionConfig(_config);

        vm.expectEmit(address(spice));
        emit AuctionConfigRemoved(2, 0);
        spice.removeAuctionConfig();

        ISpiceAuction.SpiceAuctionConfig memory _emptyConfig = spice.getAuctionConfig(2);
        _checkEmptyConfig(_emptyConfig);
        assertEq(spice.currentEpoch(), 1);

        // config set and auction funded but `block.timestamp < startTime`
        _config = _startAuction(true, true);
        // epochId is now 2 for SpiceAuctionConfig and EpochInfo
        info = spice.getEpochInfo(2);
        // warp below start time
        vm.warp(info.startTime - 10 seconds);
        uint256 cssGnosisBalance = IERC20(TGLD).balanceOf(cssGnosis);
        vm.startPrank(daoExecutor);
        vm.expectEmit(address(spice));
        emit AuctionConfigRemoved(2, 2); // meaning Ids 2 were deleted
        spice.removeAuctionConfig();

        _emptyConfig = spice.getAuctionConfig(2);
        _checkEmptyConfig(_emptyConfig);
        assertEq(spice.currentEpoch(), 1);
        assertEq(IERC20(TGLD).balanceOf(cssGnosis), cssGnosisBalance+info.totalAuctionTokenAmount);
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

    function test_recoverAuctionTokenForZeroBidAuction_spice() public {
        vm.startPrank(cssGnosis);
        // invalid epoch
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.InvalidEpoch.selector));
        spice.recoverAuctionTokenForZeroBidAuction(1, alice);

        _startAuction(true, true);
        IAuctionBase.EpochInfo memory info = spice.getEpochInfo(1);
        vm.startPrank(cssGnosis);
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
        vm.startPrank(cssGnosis);
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.InvalidOperation.selector));
        spice.recoverAuctionTokenForZeroBidAuction(1, alice);

        _startAuction(true, true);
        info = spice.getEpochInfo(2);
        _config = spice.getAuctionConfig(2);
        vm.warp(info.endTime + _config.waitPeriod);
        address auctionToken = spice.getAuctionTokenForCurrentEpoch();
        uint256 auctionTokenBalance = IERC20(auctionToken).balanceOf(address(spice));
        uint256 auctionTokenAmount = info.totalAuctionTokenAmount;
        uint256 balance = IERC20(auctionToken).balanceOf(cssGnosis);
        vm.startPrank(cssGnosis);

        assertEq(spice.epochsWithoutBidsRecovered(2), false);
        vm.expectEmit(address(spice));
        emit TokenRecovered(cssGnosis, auctionToken, auctionTokenAmount);
        spice.recoverAuctionTokenForZeroBidAuction(2, cssGnosis);
        assertEq(IERC20(auctionToken).balanceOf(address(spice)), auctionTokenBalance - auctionTokenAmount);
        assertEq(IERC20(auctionToken).balanceOf(cssGnosis), balance + auctionTokenAmount);

        // bidders from previous auction can claim
        vm.startPrank(bob);
        balance = IERC20(auctionToken).balanceOf(bob);
        spice.claim(1);
        assertEq(IERC20(auctionToken).balanceOf(bob), balance + epochOneTotalAuctionTokenAmount);
        assertEq(spice.epochsWithoutBidsRecovered(2), true);

        vm.startPrank(cssGnosis);
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.AlreadyRecovered.selector));
        spice.recoverAuctionTokenForZeroBidAuction(2, executor);
    }

    function test_recoverToken_spice() public {
        IERC20 spiceTokenErc20 = IERC20(daiToken);
        vm.startPrank(daoExecutor);
        address _fakeErc20TokenAddress = address(fakeERC20);
        {
            // revert, invalid params
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
            spice.recoverToken(_fakeErc20TokenAddress, address(0), 0);
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
            spice.recoverToken(_fakeErc20TokenAddress, alice, 0);
        }
       
        {
            dealAdditional(IERC20(_fakeErc20TokenAddress), address(spice), 50 ether);
            vm.expectEmit(address(spice));
            emit TokenRecovered(alice, _fakeErc20TokenAddress, 50 ether);
            spice.recoverToken(_fakeErc20TokenAddress, alice, 50 ether);
            assertEq(fakeERC20.balanceOf(alice), 50 ether);
        }

        address _spiceToken = spice.spiceToken();
        uint256 recoverAmount = 1 ether;

        // current epoch is 0. no donation. no auctions funded
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        spice.recoverToken(_spiceToken, alice, 1);

        // donate TGLD. epoch is 0. no auctions funded
        uint256 tokenBalance = TGLD.balanceOf(bob);
        deal(address(TGLD), address(spice), recoverAmount, true);
        vm.expectEmit(address(spice));
        emit TokenRecovered(bob, address(TGLD), recoverAmount);
        vm.startPrank(daoExecutor);
        spice.recoverToken(address(TGLD), bob, recoverAmount);
        assertEq(TGLD.balanceOf(bob), tokenBalance+recoverAmount);
        assertEq(TGLD.balanceOf(address(spice)), 0);

        // donate spice token. epoch is 0. no auctions funded
        tokenBalance = spiceTokenErc20.balanceOf(bob);
        deal(address(daiToken), address(spice), recoverAmount, true);
        vm.expectEmit(address(spice));
        emit TokenRecovered(bob, address(daiToken), recoverAmount);
        spice.recoverToken(address(daiToken), bob, recoverAmount);
        assertEq(spiceTokenErc20.balanceOf(bob), tokenBalance+recoverAmount);
        assertEq(spiceTokenErc20.balanceOf(address(spice)), 0);

        // no donation. auction funded. epoch is 1
        _startAuction(true, true);
        uint256 epoch = spice.currentEpoch();
        assertEq(epoch, 1);
        vm.startPrank(daoExecutor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        spice.recoverToken(_spiceToken, alice, recoverAmount);

        // startTime <= block.timestamp. cannot recover still, no donation
        IAuctionBase.EpochInfo memory info = spice.getEpochInfo(epoch);
        vm.warp(info.startTime);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        spice.recoverToken(_spiceToken, alice, recoverAmount);

        uint256 bidTokenAmount = 10 ether;
        {
            // some bids. cannot recover spice token or TGLD. still no donation
            deal(daiToken, alice, 100 ether);
            deal(daiToken, bob, 100 ether);
            
            vm.startPrank(alice);
            IERC20(daiToken).approve(address(spice), type(uint).max);
            spice.bid(bidTokenAmount);
            vm.startPrank(bob);
            IERC20(daiToken).approve(address(spice), type(uint).max);
            spice.bid(bidTokenAmount);
            uint256 spiceTokenBalance = spiceTokenErc20.balanceOf(address(spice));
            uint256 templeGoldBalance = TGLD.balanceOf(address(spice));
            vm.startPrank(daoExecutor);
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
            spice.recoverToken(_spiceToken, alice, recoverAmount);
            assertEq(TGLD.balanceOf(address(spice)), templeGoldBalance);
            assertEq(spiceTokenErc20.balanceOf(address(spice)), spiceTokenBalance);
        }

        {
            // donate
            dealAdditional(IERC20(TGLD), address(spice), recoverAmount);
            dealAdditional(spiceTokenErc20, address(spice), recoverAmount);
            // recover token, wrong amount
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
            spice.recoverToken(address(TGLD), alice, recoverAmount+1);
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
            spice.recoverToken(daiToken, alice, recoverAmount+1);
        }
        
        uint256 auctionTokenAllocation = info.totalAuctionTokenAmount;
        {
            uint256 spiceBidTokenBalance = spiceTokenErc20.balanceOf(address(spice));
            uint256 aliceBidTokenBalance = spiceTokenErc20.balanceOf(address(alice));
            uint256 aliceTempleGoldBalance = TGLD.balanceOf(alice);
            uint256 spiceTempleGoldBalance = TGLD.balanceOf(address(spice));

            vm.expectEmit(address(spice));
            emit TokenRecovered(alice, daiToken, recoverAmount);
            spice.recoverToken(daiToken, alice, recoverAmount);
            vm.expectEmit(address(spice));
            emit TokenRecovered(alice, address(TGLD), recoverAmount);
            spice.recoverToken(address(TGLD), alice, recoverAmount);

            assertEq(spiceTempleGoldBalance-recoverAmount, TGLD.balanceOf(address(spice)));
            assertEq(aliceTempleGoldBalance+recoverAmount, TGLD.balanceOf(alice));
            assertEq(spiceBidTokenBalance-recoverAmount, spiceTokenErc20.balanceOf(address(spice)));
            assertEq(aliceBidTokenBalance+recoverAmount, spiceTokenErc20.balanceOf(alice));
        }

        {
            // after token recover, bidders can still claim
            vm.warp(info.endTime);
            vm.startPrank(alice);
            uint256[] memory epochs = new uint256[](1);
            epochs[0] = 1;
            ISpiceAuction.TokenAmount[] memory aliceClaimable = spice.getClaimableForEpochs(alice, epochs);
            ISpiceAuction.TokenAmount[] memory bobClaimable = spice.getClaimableForEpochs(bob, epochs);
            vm.expectEmit(address(spice));
            emit Claim(alice, 1, bidTokenAmount, aliceClaimable[0].amount);
            spice.claim(1);
            vm.startPrank(bob);
            vm.expectEmit(address(spice));
            emit Claim(bob, 1, bidTokenAmount, bobClaimable[0].amount);
            spice.claim(1);
            assertEq(auctionTokenAllocation, bobClaimable[0].amount+aliceClaimable[0].amount);
        }
    }

    function test_cannot_bid_before_auction_start_time() public {
        // fund next auction. try bid and claim before auction start.
        ISpiceAuction.SpiceAuctionConfig memory config = _getAuctionConfig();
        config.isTempleGoldAuctionToken = false;
        config.minimumDistributedAuctionToken = 10 ether;
        vm.startPrank(daoExecutor);
        spice.setAuctionConfig(config);
        vm.startPrank(executor);
        TGLD.authorizeContract(treasury, true);

        uint256 amount = 10 ether;
        uint128 startTime = uint128(_deployTs + config.waitPeriod);
        _dealAndApprove(IERC20(daiToken), cssGnosis, address(spice), amount, true);
        vm.startPrank(cssGnosis);
        spice.fundNextAuction(amount, startTime);
        skip(config.waitPeriod);

        // cannot bid
        vm.warp(startTime-1);
        uint256 bidAmount = 1 ether;
        _dealAndApprove(IERC20(TGLD), alice, address(spice), bidAmount, true);
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.CannotDeposit.selector));
        spice.bid(bidAmount);
    }

    function test_fundNextAuction() public {
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        spice.fundNextAuction(1, uint128(block.timestamp));

        vm.startPrank(cssGnosis);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        spice.fundNextAuction(0, uint128(block.timestamp));

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        spice.fundNextAuction(1, uint128(block.timestamp));

        // active auction error
        _startAuction(true, true);
        vm.startPrank(cssGnosis);
        uint256 epoch = spice.currentEpoch();
        IAuctionBase.EpochInfo memory info = spice.getEpochInfo(epoch);
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.AuctionActive.selector));
        uint128 startTime = uint128(block.timestamp + 1 days);
        spice.fundNextAuction(1, startTime);

        // end auction
        vm.warp(info.endTime);
        uint256 amount = 1 ether;
        startTime = uint128(block.timestamp + 1 days);
        vm.expectRevert(abi.encodeWithSelector(ISpiceAuction.MissingAuctionConfig.selector, epoch+1));
        spice.fundNextAuction(amount, startTime);

        ISpiceAuction.SpiceAuctionConfig memory config = _getAuctionConfig();
        config.isTempleGoldAuctionToken = false;
        config.minimumDistributedAuctionToken = 10 ether;
        vm.startPrank(daoExecutor);
        spice.setAuctionConfig(config);

        vm.startPrank(cssGnosis);
        vm.expectRevert(abi.encodeWithSelector(ISpiceAuction.NotEnoughAuctionTokens.selector));
        spice.fundNextAuction(amount, startTime);

        amount = 11 ether;
        _dealAndApprove(IERC20(daiToken), cssGnosis, address(spice), amount, false);

        uint256 waitPeriod = config.waitPeriod;
        uint256 waitPeriodEnd;
        if (epoch == 0) {
            waitPeriodEnd = waitPeriod + _deployTs;
        } else {
            IAuctionBase.EpochInfo memory infoPrev = spice.getEpochInfo(epoch);
            waitPeriodEnd = infoPrev.endTime + waitPeriod;
        }
        
        startTime = uint128(waitPeriodEnd - 1);
        vm.expectRevert(abi.encodeWithSelector(ISpiceAuction.WaitPeriod.selector));
        spice.fundNextAuction(amount, startTime);

        vm.warp(waitPeriodEnd);
        startTime = uint128(waitPeriodEnd+1);
        uint128 endTime = startTime + config.duration;

        epoch += 1;
        vm.expectEmit(address(spice));
        emit SpiceAuctionEpochSet(epoch, daiToken, startTime, endTime, amount);
        spice.fundNextAuction(amount, startTime);

        info = spice.getEpochInfo(epoch);
        assertEq(info.startTime, startTime);
        assertEq(info.endTime, endTime);
        assertEq(info.totalAuctionTokenAmount, amount);
        assertEq(info.totalBidTokenAmount, 0);
        assertEq(spice.currentEpoch(), epoch);
    }

    function test_fundAuction_resetConfig() public {
        ISpiceAuction.SpiceAuctionConfig memory config = _getAuctionConfig();
        config.isTempleGoldAuctionToken = false;
        config.minimumDistributedAuctionToken = 10 ether;
        vm.startPrank(daoExecutor);
        spice.setAuctionConfig(config);

        vm.startPrank(cssGnosis);
        uint256 amount = 10 ether;
        _dealAndApprove(IERC20(daiToken), cssGnosis, address(spice), amount, false);

        uint128 startTime = uint128(config.waitPeriod + _deployTs);
        spice.fundNextAuction(amount, startTime);
        // cannot reset config. auction has been funded and epoch info set.
        vm.startPrank(daoExecutor);
        vm.expectRevert(abi.encodeWithSelector(ISpiceAuction.AuctionFunded.selector));
        spice.setAuctionConfig(config);
    }

    function test_startSpiceAuction() public {
        vm.expectRevert(abi.encodeWithSelector(ISpiceAuction.Unimplemented.selector));
        spice.startAuction();
    }

    function test_bidSpiceAuction() public {
        deal(daiToken, alice, 100 ether);
        deal(daiToken, bob, 100 ether);
        uint256 aliceBidAmount = 20 ether;
        uint256 bobBidAmount = 30 ether;
        // cannot deposit. epoch inactive
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

        vm.startPrank(alice);
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
        uint256[] memory epochs = new uint256[](1);
        epochs[0] = epoch;
        uint256 claimable = (spice.getClaimableForEpochs(alice, epochs)[0]).amount;
        assertEq(claimable, 100 ether);

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

        epochs[0] = epoch;
        claimable = (spice.getClaimableForEpochs(alice, epochs)[0]).amount;
        assertEq(claimable, 40 ether);
        claimable = (spice.getClaimableForEpochs(bob, epochs)[0]).amount;
        assertEq(claimable, 60 ether);

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

        epochs[0] = epoch;
        claimable = (spice.getClaimableForEpochs(alice, epochs)[0]).amount;
        assertEq(claimable, 100 ether * 20/100);
        claimable = (spice.getClaimableForEpochs(bob, epochs)[0]).amount;
        assertEq(claimable, 100 ether * 80/100);
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
        vm.warp(epochInfo.startTime);

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
        uint256 bobTGoldBalance = TGLD.balanceOf(bob);
        uint256 aliceTGoldBalance = TGLD.balanceOf(alice);
        uint256[] memory epochs = new uint256[](1);
        epochs[0] = epoch;
        ISpiceAuction.TokenAmount[] memory bobClaim = spice.getClaimableForEpochs(bob, epochs);
        ISpiceAuction.TokenAmount[] memory aliceClaim = spice.getClaimableForEpochs(alice, epochs);
        vm.expectEmit(address(spice));
        emit Claim(bob, epoch, bobBidAmount, bobClaim[0].amount);
        spice.claim(epoch);
        assertEq(TGLD.balanceOf(bob), bobTGoldBalance+bobClaim[0].amount);
        assertEq(bobClaim[0].amount, 100 ether * 30/50);

        vm.startPrank(alice);
        vm.expectEmit(address(spice));
        emit Claim(alice, epoch, aliceBidAmount, aliceClaim[0].amount);
        spice.claim(epoch);
        assertEq(TGLD.balanceOf(alice), aliceTGoldBalance+aliceClaim[0].amount);
        assertEq(aliceClaim[0].amount, 100 ether * 20/50);

        assertEq((spice.getClaimableForEpochs(alice, epochs)[0]).amount, 0);
        epochs[0] = epoch + 1;
        assertEq((spice.getClaimableForEpochs(alice, epochs)[0]).amount, 0);
        assertEq(spice.claimedAmount(alice, epoch), aliceClaim[0].amount);
        assertEq(spice.claimed(alice, epoch), true);

        // try to claim and fail
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.AlreadyClaimed.selector));
        spice.claim(epoch);
    }

    function test_claim_tgld_is_bid_token() public {
        {
            _setVestingAndAuthorize(mike, treasury, 4 weeks);
            // team gnosis
            vm.startPrank(mike);
            // distribute TGLD to alice and bob
            IERC20(TGLD).transfer(bob, 100 ether);
            IERC20(TGLD).transfer(alice, 100 ether);
        }

        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.InvalidEpoch.selector));
        spice.claim(1);

        uint256 aliceBidAmount = 20 ether;
        uint256 bobBidAmount = 30 ether;

        ISpiceAuction.SpiceAuctionConfig memory config;
        {
            deal(daiToken, address(spice), 500 ether);
            config = _createSpiceAuctionWithTGLDAsAuctionToken(address(0));
        }
        uint256 currentEpoch = spice.currentEpoch();
        // bids
        vm.startPrank(alice);
        IERC20(TGLD).approve(address(spice), type(uint).max);
        vm.expectEmit(address(spice));
        emit Deposit(alice, currentEpoch, aliceBidAmount);
        spice.bid(aliceBidAmount);

        vm.startPrank(bob);
        IERC20(TGLD).approve(address(spice), type(uint).max);
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

    function test_burn_and_notify_arbitrum() public {
         {
            _setVestingAndAuthorize(mike, treasury, 4 weeks);
            // team gnosis
            vm.startPrank(mike);
            // approve spice auction contract to transfer
            IERC20(TGLD).approve(address(spice), type(uint).max);
            // distribute TGLD to alice
            IERC20(TGLD).transfer(alice, 100 ether);
        }

        uint256 etherAmount = 5 ether;
        vm.deal(address(spice), etherAmount);

        // start spcie auction with TGLD as bid token
        ISpiceAuction.SpiceAuctionConfig memory _config = _createSpiceAuctionWithTGLDAsAuctionToken(cssGnosis);

        uint256 bidAmount = 100 ether;
        uint256 currentEpoch = spice.currentEpoch();

         {
            // bids
            vm.startPrank(alice);
            IERC20(TGLD).approve(address(spice), type(uint).max);
            vm.expectEmit(address(spice));
            emit Deposit(alice, currentEpoch, bidAmount);
            spice.bid(bidAmount);
        }

        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.InvalidEpoch.selector));
        spice.burnAndNotify(3, false);

        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(IAuctionBase.AuctionActive.selector));
        spice.burnAndNotify(currentEpoch, false);

        IAuctionBase.EpochInfo memory _info = spice.getEpochInfo(currentEpoch);
        vm.warp(_info.endTime);

        vm.deal(alice, 1 ether);
        vm.expectRevert(abi.encodeWithSelector(ISpiceAuction.EtherNotNeeded.selector));
        spice.burnAndNotify{value: 1 ether}(currentEpoch, false);

        // approve spice auction for transfer
        vm.startPrank(cssGnosis);
        TGLD.approve(address(spice), type(uint256).max);

        uint256 circulatingSupply = TGLD.circulatingSupply();
        vm.expectEmit(address(spice));
        emit RedeemedTempleGoldBurned(currentEpoch, bidAmount);
        spice.burnAndNotify(currentEpoch, false);
        assertEq(spice.redeemedEpochs(currentEpoch), true);
        assertEq(TGLD.circulatingSupply(), circulatingSupply-bidAmount);

        _startAuction(true, true);
        _config = spice.getAuctionConfig(currentEpoch+1);
        currentEpoch = spice.currentEpoch();
        _info = spice.getEpochInfo(currentEpoch);
        vm.warp(_info.endTime);
        
        // tgld is auction token
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        spice.burnAndNotify(currentEpoch, false);

        skip(_config.waitPeriod);
        _config = _createSpiceAuctionWithTGLDAsAuctionToken(cssGnosis);

        // no bids
        currentEpoch = spice.currentEpoch();
        _info = spice.getEpochInfo(currentEpoch);
        vm.warp(_info.endTime);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        spice.burnAndNotify(currentEpoch, false);
    }

    function test_mint_max_supply_update_circulating_supply() public {
        ITempleGold.VestingFactor memory _factor = _getVestingFactor();
        {
            vm.startPrank(executor);
            _factor.value = 35;
            _factor.weekMultiplier = 1 weeks;
            TGLD.setVestingFactor(_factor);
            TGLD.authorizeContract(mike, true);
            TGLD.authorizeContract(treasury, true);
            skip(365 days);
            TGLD.mint();
            // team gnosis
            vm.startPrank(mike);
            IERC20(TGLD).approve(address(spice), type(uint).max);
            // distribute TGLD to alice
            IERC20(TGLD).transfer(alice, 12_400 ether);
            deal(daiToken, address(spice), 100 ether);
        }
        assertEq(TGLD.circulatingSupply(), TGLD.MAX_CIRCULATING_SUPPLY());
        assertEq(TGLD.getMintAmount(), 0);
        assertEq(TGLD.canDistribute(), false);

        // create spice auction and redeem
        ISpiceAuction.SpiceAuctionConfig memory config;
        config = _createSpiceAuctionWithTGLDAsAuctionToken(mike);

        uint256 bidAmount = 12_333_456_789_012_345_678_900;
        uint256 currentEpoch = spice.currentEpoch();
        // bid
        vm.startPrank(alice);
        IERC20(TGLD).approve(address(spice), type(uint).max);
        spice.bid(bidAmount);

        IAuctionBase.EpochInfo memory epochInfo = spice.getEpochInfo(currentEpoch);
        assertEq(epochInfo.totalBidTokenAmount, bidAmount);
        vm.warp(epochInfo.endTime);

        // burn redeemed TGLD and update circulating supply.
        vm.deal(address(spice), 1 ether);
        vm.startPrank(mike);
        IERC20(TGLD).transfer(address(spice), 12_400 ether);
        uint256 circulatingSupply = TGLD.MAX_CIRCULATING_SUPPLY() - bidAmount;
        vm.expectEmit(address(TGLD));
        emit CirculatingSupplyUpdated(address(spice), bidAmount, circulatingSupply, bidAmount);
        spice.burnAndNotify(currentEpoch, true);
        assertEq(TGLD.circulatingSupply(), circulatingSupply);

        // circulating supply reduced but not enough to mint 10_000
        assertEq(TGLD.canDistribute(), false);
        vm.startPrank(executor);
        // mint faster
        _factor.weekMultiplier = 70;
        TGLD.setVestingFactor(_factor);
        skip(1 weeks);
        assertEq(TGLD.canDistribute(), true);
    }

    function _createSpiceAuctionWithTGLDAsAuctionToken(
        address recipient
    ) private returns (ISpiceAuction.SpiceAuctionConfig memory config) {
        config = _getAuctionConfig();
        config.isTempleGoldAuctionToken = false;
        if (recipient != address(0)) {
            config.recipient = recipient;
        }
        vm.startPrank(daoExecutor);
        spice.setAuctionConfig(config);

        uint128 startTime = uint128(block.timestamp + 3 days);
        vm.startPrank(cssGnosis);
        _fundNextAuction(config, startTime);

        vm.warp(startTime);
    }

    function _setVestingAndAuthorize(address user_a, address user_b, uint256 skipTime) private {
        _setVestingFactor();
        // authorize for transfers
        vm.startPrank(executor);
        TGLD.authorizeContract(user_a, true);
        TGLD.authorizeContract(user_b, true);
        skip(skipTime);
        // mint vested TGLD
        TGLD.mint();
    }

    function _checkEmptyConfig(ISpiceAuction.SpiceAuctionConfig memory config) private pure {
        assertEq(config.duration, 0);
        assertEq(config.waitPeriod, 0);
        assertEq(config.minimumDistributedAuctionToken, 0);
        assertEq(config.isTempleGoldAuctionToken, false);
        assertEq(config.recipient, address(0));
    }

    function _dealAndApprove(
        IERC20 token,
        address to,
        address spender,
        uint256 amount,
        bool prank
    ) private {
        dealAdditional(token, to, amount);
        if (prank) { vm.startPrank(to); }
        token.approve(spender, amount);
        if (prank) { vm.stopPrank(); }
    }
}