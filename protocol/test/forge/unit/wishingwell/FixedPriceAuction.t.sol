pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// (tests/forge/wishingwell/FixedPriceAuction.t.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { IERC1271 } from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { ERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

import { TempleTest } from "test/forge/unit/TempleTest.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";

import { IFixedPriceAuction } from "contracts/interfaces/wishingwell/IFixedPriceAuction.sol";
import { FixedPriceAuction } from "contracts/wishingwell/FixedPriceAuction.sol";


contract FixedPriceAuctionToken is FakeERC20, ERC20Permit {
    constructor(string memory name_, string memory symbol_)
        FakeERC20(name_, symbol_, address(0), 0)
        ERC20Permit(name_)
    { }
}

contract FixedPriceAuctionRegistry {
    mapping(address => bool) public supported;
    bool public fail;

    function setSupported(address token, bool value) external {
        supported[token] = value;
    }

    function setFail(bool value) external {
        fail = value;
    }

    function isSupported(address token) external view returns (bool) {
        if (fail) { revert("Registry unavailable"); }
        return supported[token];
    }
}

contract FixedPriceAuctionCompliance {
    mapping(address => bool) public blocked;
    bool public fail;

    function setBlocked(address account, bool value) external {
        blocked[account] = value;
    }

    function setFail(bool value) external {
        fail = value;
    }

    function isBlocked(address account) external view returns (bool) {
        if (fail) { revert("Compliance unavailable"); }
        return blocked[account];
    }
}

contract FixedPriceAuctionTestBase is TempleTest {
    event AuctionSettled(
        address indexed caller,
        bool early,
        uint256 totalDeposits,
        uint256 filledDeposits,
        uint256 userFunding,
        uint256 userRefund,
        uint256 funderRefund
    );
    event ClaimFrozen(address indexed account, uint256 payout, uint256 refund);
    event ComplianceCheckDisabled();
    event DepositEndScheduled(address indexed caller, uint64 newDepositEnd, uint64 newFulfillmentEnd);
    event DepositWithdrawn(address indexed account, uint256 amount, uint256 accountDeposit, uint256 totalDeposits);
    event Deposited(address indexed account, uint256 amount, uint256 accountDeposit, uint256 totalDeposits);
    event EmergencyPaused(uint64 until);
    event EmergencyUnpaused();
    event ExcessWithdrawn(address indexed funder, uint256 amount, uint256 remainingFunding);
    event FrozenReleased(address indexed account, address indexed to, uint256 bidAmount, uint256 fillAmount);
    event ReleaseProposed(address indexed account, address indexed to, uint64 executableAt);
    event ReleaseVetoed(address indexed account);
    event UserClaimed(address indexed account, uint256 fillTokenAmount, uint256 bidTokenRefund);
    event AuctionConfigured(IFixedPriceAuction.AuctionConfig config, uint8 bidDecimals, uint8 fillDecimals);

    FixedPriceAuction internal auction;
    FixedPriceAuctionToken internal TEMPLE_TOKEN;
    FixedPriceAuctionToken internal USDS;
    FixedPriceAuctionToken internal TGLD;
    FixedPriceAuctionRegistry internal tokenRegistry;
    FixedPriceAuctionCompliance internal complianceCheck;
    IFixedPriceAuction.AuctionConfig internal config;

    address internal funder = makeAddr("funder");
    address internal proceedsRecipient = makeAddr("proceedsRecipient");
    address internal escrow = makeAddr("escrow");
    
    uint256 internal key = 12345;

    function setUp() public virtual {
        vm.warp(1000);
        TEMPLE_TOKEN = new FixedPriceAuctionToken("Temple Token", "TEMPLE");
        USDS = new FixedPriceAuctionToken("USDS", "USDS");
        tokenRegistry = new FixedPriceAuctionRegistry();
        complianceCheck = new FixedPriceAuctionCompliance();
        tokenRegistry.setSupported(address(TEMPLE_TOKEN), true);
        tokenRegistry.setSupported(address(USDS), true);
        config = IFixedPriceAuction.AuctionConfig({
            bidToken: address(TEMPLE_TOKEN),
            fillToken: address(USDS),
            funder: funder,
            proceedsRecipient: proceedsRecipient,
            price: 4e18,
            depositStart: uint64(block.timestamp + 1 days),
            depositDuration: 5 days,
            fulfillmentDuration: 3 days,
            noticePeriod: 1 hours,
            minDeposit: 10e18,
            maxTotalDeposits: 1000e18,
            complianceCheck: address(complianceCheck),
            frozenFundsReceiver: escrow,
            tokenRegistry: address(tokenRegistry)
        });
        auction = new FixedPriceAuction(config, executor, rescuer);
    }

    function deployAuction() internal {
        auction = new FixedPriceAuction(config, executor, rescuer);
    }

    function openDeposit() internal {
        vm.warp(auction.getTiming().depositStart);
    }

    function openFulfillment() internal {
        vm.warp(auction.getTiming().fulfillmentStart);
    }

    function finishAuction() internal {
        vm.warp(auction.getTiming().fulfillmentEnd);
    }

    function depositAs(address account, uint256 amount) internal {
        deal(address(TEMPLE_TOKEN), account, amount, false);
        vm.startPrank(account);
        TEMPLE_TOKEN.approve(address(auction), amount);
        auction.deposit(amount);
    }

    function fundAuction(uint256 amount) internal {
        USDS.mint(funder, amount);
        vm.startPrank(funder);
        USDS.approve(address(auction), amount);
        auction.fund(amount);
        vm.stopPrank();
    }

    function claimAs(address account) internal {
        vm.startPrank(account);
        auction.claim();
        vm.stopPrank();
    }

    function expectPhase(IFixedPriceAuction.Phase expected, IFixedPriceAuction.Phase actual) internal {
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.InvalidPhase.selector, expected, actual));
    }

    function partialAuction() internal {
        openDeposit();
        depositAs(alice, 100e18);
        depositAs(bob, 300e18);
        openFulfillment();
        fundAuction(800e18);
        finishAuction();
    }

    function signPermit(address owner, uint256 amount, uint256 deadline)
        internal
        returns (uint8 v, bytes32 r, bytes32 s)
    {
        bytes32 content = keccak256(
            abi.encode(
                keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                owner,
                address(auction),
                amount,
                TEMPLE_TOKEN.nonces(owner),
                deadline
            )
        );
        bytes32 digest = keccak256(abi.encodePacked(hex"1901", TEMPLE_TOKEN.DOMAIN_SEPARATOR(), content));
        return vm.sign(key, digest);
    }

    function assertLiabilities(uint256 bid, uint256 fill) internal {
        (uint256 actualBid, uint256 actualFill) = auction.liabilities();
        assertEq(actualBid, bid);
        assertEq(actualFill, fill);
        assertGe(TEMPLE_TOKEN.balanceOf(address(auction)), actualBid);
        assertGe(USDS.balanceOf(address(auction)), actualFill);
    }

    function assertUserClaim(address account, uint256 fill, uint256 refund) internal {
        IFixedPriceAuction.UserClaim memory result = auction.claimable(account);
        assertEq(result.fillTokenAmount, fill);
        assertEq(result.bidTokenRefund, refund);
    }

    function assertSettlement(
        uint256 deposits_,
        uint256 filled,
        uint256 payout,
        uint256 refund,
        uint256 surplus
    ) internal {
        IFixedPriceAuction.SettlementPreview memory result = auction.previewSettlement();
        assertEq(result.totalDeposits, deposits_);
        assertEq(result.filledDeposits, filled);
        assertEq(result.userFunding, payout);
        assertEq(result.userRefund, refund);
        assertEq(result.funderRefund, surplus);
    }

    function getConfig() internal view returns (IFixedPriceAuction.AuctionConfig memory) {
        return IFixedPriceAuction.AuctionConfig({
            bidToken: address(TEMPLE_TOKEN),
            fillToken: address(USDS),
            funder: funder,
            proceedsRecipient: proceedsRecipient,
            price: 4e18,
            depositStart: uint64(block.timestamp + 1 days),
            depositDuration: 5 days,
            fulfillmentDuration: 3 days,
            noticePeriod: 1 hours,
            minDeposit: 10e18,
            maxTotalDeposits: 1000e18,
            complianceCheck: address(complianceCheck),
            frozenFundsReceiver: escrow,
            tokenRegistry: address(tokenRegistry)
        });
    }
}

contract FixedPriceAuctionTestInitialization is FixedPriceAuctionTestBase {

    function test_initialization_fpa() public {
        assertEq(auction.executor(), executor);
        assertEq(auction.rescuer(), rescuer);
        assertEq(auction.bidDecimals(), 18);
        assertEq(auction.fillDecimals(), 18);
        assertEq(abi.encode(auction.getConfig()), abi.encode(config));
        assertEq(auction.complianceCheck(), address(complianceCheck));
        assertEq(auction.maxTotalDeposits(), 1000e18);
        assertEq(auction.EMERGENCY_PAUSE_DURATION(), 14 days);
        assertEq(auction.FROZEN_ACTION_DELAY(), 7 days);
        assertEq(auction.MIN_NOTICE(), 1 hours);
        assertEq(auction.MAX_DURATION(), 30 days);
        assertFalse(auction.depositsPaused());
        assertFalse(auction.emergencyPaused());
        assertFalse(auction.emergencyPauseUsed());
        assertEq(auction.emergencyPausedUntil(), 0);
        assertEq(auction.unclaimedBidders(), 0);
        assertLiabilities(0, 0);
    }

    function test_constructor_validation_bid_token_equal_fill_token() public {
        IFixedPriceAuction.AuctionConfig memory _config = getConfig();
        _config.bidToken = _config.fillToken;
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.InvalidConfig.selector));
        new FixedPriceAuction(_config, executor, rescuer);
    }

    function test_constructor_validation_invalid_funder_zero_address() public {
        IFixedPriceAuction.AuctionConfig memory _config = getConfig();
        _config.funder = address(0);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.InvalidConfig.selector));
        new FixedPriceAuction(_config, executor, rescuer);
    }

    function test_constructor_validation_invalid_proceedsRecipient_zero_address() public {
        IFixedPriceAuction.AuctionConfig memory _config = getConfig();
        _config.proceedsRecipient = address(0);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.InvalidConfig.selector));
        new FixedPriceAuction(_config, executor, rescuer);
    }
    
    function test_constructor_validation_invalid_frozen_funds_receiver_zero_address() public {
        IFixedPriceAuction.AuctionConfig memory _config = getConfig();
        _config.frozenFundsReceiver = address(0);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.InvalidConfig.selector));
        new FixedPriceAuction(_config, executor, rescuer);
    }

    function test_constructor_validation_invalid_frozen_funds_receiver_contract_address() public {
        // The test contract deploys the next auction using CREATE.
        address predictedAuction = vm.computeCreateAddress(
            address(this),
            vm.getNonce(address(this))
        );
        IFixedPriceAuction.AuctionConfig memory _config = getConfig();
        _config.frozenFundsReceiver = predictedAuction;
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.InvalidConfig.selector));
        new FixedPriceAuction(_config, executor, rescuer);
    }

    function test_constructor_validation_zero_price() public {
        IFixedPriceAuction.AuctionConfig memory _config = getConfig();
        _config.price = 0;
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.InvalidConfig.selector));
        new FixedPriceAuction(_config, executor, rescuer);
    }

    function test_constructor_validation_zero_deposit_duration() public {
        IFixedPriceAuction.AuctionConfig memory _config = getConfig();
        _config.depositDuration = 0;
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.InvalidConfig.selector));
        new FixedPriceAuction(_config, executor, rescuer);
    }

    function test_constructor_validation_invalid_deposit_Start() public {
        IFixedPriceAuction.AuctionConfig memory _config = getConfig();
        _config.depositStart = uint64(block.timestamp - 1);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.InvalidConfig.selector));
        new FixedPriceAuction(_config, executor, rescuer);
    }

    function test_constructor_validation_deposit_duration_exceeds_max_duration() public {
        IFixedPriceAuction.AuctionConfig memory _config = getConfig();
        _config.depositDuration = auction.MAX_DURATION() + 1;
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.InvalidConfig.selector));
        new FixedPriceAuction(_config, executor, rescuer);
    }

    function test_constructor_validation_zero_fulfillment_duration() public {
        IFixedPriceAuction.AuctionConfig memory _config = getConfig();
        _config.fulfillmentDuration = 0;
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.InvalidConfig.selector));
        new FixedPriceAuction(_config, executor, rescuer);
    }

    function test_constructor_validation_fulfillment_duration_exceeds_max_duration() public {
        IFixedPriceAuction.AuctionConfig memory _config = getConfig();
        _config.fulfillmentDuration = auction.MAX_DURATION() + 1;
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.InvalidConfig.selector));
        new FixedPriceAuction(_config, executor, rescuer);
    }

    function test_constructor_validation_notice_period_less_than_min_notice() public {
        IFixedPriceAuction.AuctionConfig memory _config = getConfig();
        _config.noticePeriod = auction.MIN_NOTICE() - 1;
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.InvalidConfig.selector));
        new FixedPriceAuction(_config, executor, rescuer);
    }

    function test_constructor_validation_notice_period_exceeds_deposit_duration() public {
        IFixedPriceAuction.AuctionConfig memory _config = getConfig();
        _config.noticePeriod = _config.depositDuration + 1;
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.InvalidConfig.selector));
        new FixedPriceAuction(_config, executor, rescuer);
    }

    function test_constructor_validation_unsupported_bid_token() public {
        IFixedPriceAuction.AuctionConfig memory _config = getConfig();
        tokenRegistry.setSupported(address(TEMPLE_TOKEN), false);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.InvalidConfig.selector));
        new FixedPriceAuction(_config, executor, rescuer);
    }

    function test_constructor_validation_unsupported_fill_token() public {
        IFixedPriceAuction.AuctionConfig memory _config = getConfig();
        tokenRegistry.setSupported(address(USDS), false);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.InvalidConfig.selector));
        new FixedPriceAuction(_config, executor, rescuer);
    }

    function test_constructor_validation_decimals_above_eighteen() public {
        IFixedPriceAuction.AuctionConfig memory _config = getConfig();
        FixedPriceAuctionToken token = new FixedPriceAuctionToken("Invalid", "BAD");
        tokenRegistry.setSupported(address(token), true);
        vm.mockCall(address(token), abi.encodeWithSelector(IERC20Metadata.decimals.selector), abi.encode(uint8(19)));
        _config.bidToken = address(token);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.InvalidConfig.selector));
        new FixedPriceAuction(_config, executor, rescuer);
    }

    function test_constructor_initialization() public {
        address predictedAuction = vm.computeCreateAddress(
            address(this),
            vm.getNonce(address(this))
        );
        IFixedPriceAuction.AuctionConfig memory _config = getConfig();
        vm.expectEmit(address(predictedAuction));
        emit IFixedPriceAuction.AuctionConfigured(_config, 18, 18);
        new FixedPriceAuction(_config, executor, rescuer);
    }
}

contract FixedPriceAuctionTestLifeCycle is FixedPriceAuctionTestBase {

    function test_phases_time_boundaries() public {
        IFixedPriceAuction.AuctionTiming memory timing = auction.getTiming();
        assertEq(timing.scheduledDepositEnd, config.depositStart + 5 days);
        assertEq(timing.fulfillmentStart, timing.effectiveDepositEnd);

        vm.warp(timing.depositStart - 1);
        assertEq(uint256(auction.phase()), uint256(IFixedPriceAuction.Phase.Scheduled));

        vm.warp(timing.depositStart);
        assertEq(uint256(auction.phase()), uint256(IFixedPriceAuction.Phase.Deposit));

        vm.warp(timing.effectiveDepositEnd - 1);
        assertEq(uint256(auction.phase()), uint256(IFixedPriceAuction.Phase.Deposit));

        vm.warp(timing.effectiveDepositEnd);
        assertEq(uint256(auction.phase()), uint256(IFixedPriceAuction.Phase.Fulfillment));

        vm.warp(timing.fulfillmentEnd - 1);
        assertEq(uint256(auction.phase()), uint256(IFixedPriceAuction.Phase.Fulfillment));

        vm.warp(timing.fulfillmentEnd);
        assertEq(uint256(auction.phase()), uint256(IFixedPriceAuction.Phase.Settled));
    }

    function test_end_deposit_preserves_notice_and_full_fulfillment_window() public {
        openDeposit();

        uint64 expectedEnd = uint64(block.timestamp + config.noticePeriod);
        vm.startPrank(executor);
        vm.expectEmit(true, true, true, true, address(auction));
        emit DepositEndScheduled(executor, expectedEnd, expectedEnd + config.fulfillmentDuration);
        auction.endDeposit();

        IFixedPriceAuction.AuctionTiming memory timing = auction.getTiming();
        assertEq(timing.effectiveDepositEnd, expectedEnd);
        assertEq(timing.scheduledDepositEnd, config.depositStart + config.depositDuration);
        assertEq(timing.fulfillmentEnd, expectedEnd + config.fulfillmentDuration);

        vm.warp(expectedEnd - 1);
        depositAs(alice, 10e18);

        vm.warp(expectedEnd);
        assertEq(uint256(auction.phase()), uint256(IFixedPriceAuction.Phase.Fulfillment));
    }

    function test_end_deposit_cannot_extend_existing_notice() public {
        openDeposit();

        vm.startPrank(executor);
        auction.endDeposit();

        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.NoEarlierEnd.selector));
        auction.endDeposit();
    }
    
    function test_end_deposit_rejects_when_notice_reaches_scheduled_end() public {
        vm.warp(auction.getTiming().effectiveDepositEnd - config.noticePeriod);

        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.NoEarlierEnd.selector));
        auction.endDeposit();
    }

    function test_end_deposit_rejects_scheduled() public {
        vm.startPrank(executor);
        expectPhase(IFixedPriceAuction.Phase.Deposit, IFixedPriceAuction.Phase.Scheduled);
        auction.endDeposit();
    }

    function test_end_deposit_rejects_fulfillment() public {
        openFulfillment();

        vm.startPrank(executor);
        expectPhase(IFixedPriceAuction.Phase.Deposit, IFixedPriceAuction.Phase.Fulfillment);
        auction.endDeposit();
    }

    function test_end_deposit_rejects_settled() public {
        finishAuction();

        vm.startPrank(executor);
        expectPhase(IFixedPriceAuction.Phase.Deposit, IFixedPriceAuction.Phase.Settled);
        auction.endDeposit();
    }

    function test_finalize_is_permissionless() public {
        partialAuction();
        auction.finalize();
        bytes memory result = abi.encode(auction.previewSettlement());
        auction.finalize();
        assertEq(abi.encode(auction.previewSettlement()), result);
        assertLiabilities(400e18, 800e18);
    }

    function test_finalize_rejects_before_end() public {
        openFulfillment();

        expectPhase(IFixedPriceAuction.Phase.Settled, IFixedPriceAuction.Phase.Fulfillment);
        auction.finalize();
    }

    function test_end_fulfillment_settles_early() public {
        openDeposit();
        depositAs(alice, 100e18);
        openFulfillment();
        fundAuction(200e18);

        vm.startPrank(executor);
        auction.endFulfillment();

        assertEq(uint256(auction.phase()), uint256(IFixedPriceAuction.Phase.Settled));
        assertUserClaim(alice, 200e18, 50e18);
        claimAs(alice);
    }

    function test_end_fulfillment_without_funding_refunds_all() public {
        openDeposit();
        depositAs(alice, 100e18);
        openFulfillment();

        vm.startPrank(executor);
        auction.endFulfillment();
        assertUserClaim(alice, 0, 100e18);
    }
}

contract FixedPriceAuctionTestAccess is FixedPriceAuctionTestBase {
    function test_access_end_deposit() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        auction.endDeposit();
    }

    function test_access_cancel_scheduled() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        auction.cancelScheduled();
    }

    function test_access_cancel_deposit() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        auction.cancelDeposit();
    }

    function test_access_cancel_fulfillment() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        auction.cancelFulfillment();
    }

    function test_access_end_fulfillment() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        auction.endFulfillment();
    }

    function test_access_exclude_bidder() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        auction.excludeBidder(alice);
    }

    function test_access_propose_release() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        auction.proposeRelease(alice, alice);
    }

    function test_access_execute_release() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        auction.executeRelease(alice);
    }

    function test_access_disable_compliance() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        auction.disableComplianceCheck();
    }

    function test_access_pause_deposits() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        auction.setDepositsPaused(true);
    }

    function test_access_set_cap() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        auction.setMaxTotalDeposits(0);
    }

    function test_access_recover_token() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        auction.recoverToken(address(TEMPLE_TOKEN), alice, 1);
    }

    function test_access_fund() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.OnlyFunder.selector));
        auction.fund(1);
    }

    function test_access_withdraw_excess() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.OnlyFunder.selector));
        auction.withdrawExcess(1);
    }

    function test_access_emergency_pause() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.OnlyRescuer.selector));
        auction.emergencyPause();
    }

     function test_access_emergency_unpause() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.OnlyRescuer.selector));
        auction.emergencyUnpause();
    }

    function test_access_veto_release() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.OnlyRescuer.selector));
        auction.vetoRelease(alice);
    }

    function test_rescue_mode_changes_admin_not_funding_or_claim_authority() public {
        partialAuction();
        vm.startPrank(rescuer);
        auction.setRescueMode(true);
        auction.setDepositsPaused(true);

        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        auction.setDepositsPaused(false);

        vm.startPrank(rescuer);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.OnlyFunder.selector));
        auction.fund(1);

        claimAs(alice);
        assertEq(USDS.balanceOf(alice), 200e18);
        vm.startPrank(rescuer);
        auction.setRescueMode(false);

        vm.startPrank(executor);
        auction.setDepositsPaused(false);
    }
}

contract FixedPriceAuctionTestDeposits is FixedPriceAuctionTestBase {
    function test_deposit_emergency_paused() public {
        // vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.OnlyFunder.selector));
    }

    function test_deposit_not_deposit_phase() public {
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.InvalidPhase.selector, IFixedPriceAuction.Phase.Deposit, IFixedPriceAuction.Phase.Scheduled));
        auction.deposit(10e18);

        openFulfillment();
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.InvalidPhase.selector, IFixedPriceAuction.Phase.Deposit, IFixedPriceAuction.Phase.Fulfillment));
        auction.deposit(10e18);

        finishAuction();
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.InvalidPhase.selector, IFixedPriceAuction.Phase.Deposit, IFixedPriceAuction.Phase.Settled));
        auction.deposit(10e18);
    }

    function test_deposit_deposit_paused() public {
        openDeposit();

        vm.startPrank(executor);
        auction.setDepositsPaused(true);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.DepositsArePaused.selector));
        auction.deposit(10e18);
    }

    function test_deposit_deposit_bidder_Blocked() public {
        vm.startPrank(executor);
        complianceCheck.setBlocked(alice, true);
        openDeposit();

        deal(address(TEMPLE_TOKEN), alice, 10e18, false);
        vm.startPrank(alice);
        TEMPLE_TOKEN.approve(address(auction), 10e18);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.BlockedAccount.selector, alice));
        auction.deposit(10e18);
    }

    function test_deposit_deposit_bidder_blocked() public {
        openDeposit();
        deal(address(TEMPLE_TOKEN), alice, 100e18, false);
        complianceCheck.setBlocked(alice, true);

        vm.startPrank(alice);
        TEMPLE_TOKEN.approve(address(auction), 100e18);

        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.BlockedAccount.selector, alice));
        auction.deposit(100e18);
    }

    function test_deposit_zero_amount() public {
        openDeposit();

        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        auction.deposit(0);

        assertEq(auction.totalDeposits(), 0);
    }

    function test_deposit_deposit_below_min() public {
        openDeposit();

        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.DepositBelowMinimum.selector));
        auction.deposit(10e18 - 1);
    
        assertEq(auction.totalDeposits(), 0);
    }

    function test_deposit_deposit_cap_exceeded() public {
        openDeposit();

        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.DepositCapExceeded.selector));
        auction.deposit(1000e18 + 1);

        assertEq(auction.totalDeposits(), 0);
    }

    function test_deposit_required_funding_overflows() public {
        config.price = type(uint256).max;
        deployAuction();
        openDeposit();
        deal(address(TEMPLE_TOKEN), alice, 100e18, false);

        vm.startPrank(alice);
        TEMPLE_TOKEN.approve(address(auction), 100e18);

        vm.expectRevert(
            abi.encodeWithSignature(
                "PRBMath_MulDiv_Overflow(uint256,uint256,uint256)",
                uint256(100e18),
                type(uint256).max,
                uint256(1e18)
            )
        );
        auction.deposit(100e18);
    }

    function test_deposit_reject_scheduled() public {
        expectPhase(IFixedPriceAuction.Phase.Deposit, IFixedPriceAuction.Phase.Scheduled);
        auction.deposit(10e18);
    }

    function test_deposit_reject_fulfillment() public {
        openFulfillment();
        expectPhase(IFixedPriceAuction.Phase.Deposit, IFixedPriceAuction.Phase.Fulfillment);
        auction.deposit(10e18);
    }

    function test_deposit_reject_settled() public {
        finishAuction();
        expectPhase(IFixedPriceAuction.Phase.Deposit, IFixedPriceAuction.Phase.Settled);
        auction.deposit(10e18);
    }

    function test_multiple_deposits() public {
        openDeposit();

        depositAs(alice, 10e18);
        depositAs(alice, 1);
        depositAs(bob, 10e18);
        assertEq(auction.unclaimedBidders(), 2);
        assertEq(auction.deposits(alice), 10e18 + 1);
        assertEq(auction.deposits(bob), 10e18);
        assertLiabilities(20e18 + 1, 0);
    }

    function test_deposit_only_pause_allows_withdrawals_and_later_claims() public {
        openDeposit();
        depositAs(alice, 100e18);

        vm.startPrank(executor);
        auction.setDepositsPaused(true);
    
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.DepositsArePaused.selector));
        auction.deposit(10e18);
        auction.withdrawDeposit(50e18);
    
        openFulfillment();
        fundAuction(200e18);
        finishAuction();
        claimAs(alice);
        assertEq(USDS.balanceOf(alice), 200e18);
    }

    function test_deposit_deposit_after_unpause() public {
        openDeposit();

        vm.startPrank(executor);
        auction.setDepositsPaused(true);

        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.DepositsArePaused.selector));
        auction.deposit(10e18);

        vm.startPrank(executor);
        auction.setDepositsPaused(false);

        depositAs(alice, 10e18);
        assertEq(auction.deposits(alice), 10e18);
    }

    function test_deposit() public {
        openDeposit();
        deal(address(TEMPLE_TOKEN), alice, 100e18, false);

        vm.startPrank(alice);
        TEMPLE_TOKEN.approve(address(auction), 100e18);
        vm.expectEmit(true, true, true, true, address(auction));
        emit Deposited(alice, 100e18, 100e18, 100e18);
        auction.deposit(100e18);

        assertEq(auction.deposits(alice), 100e18);
        assertEq(auction.totalDeposits(), 100e18);
        assertEq(auction.unclaimedBidders(), 1);
        assertEq(TEMPLE_TOKEN.balanceOf(alice), 0);
        assertLiabilities(100e18, 0);
    }
}

contract FixedPriceAuctionTestWithdraws is FixedPriceAuctionTestBase {

    function test_withdraw_emergency_pause_set() public {
        vm.startPrank(rescuer);
        auction.emergencyPause();

        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.EmergencyPauseActive.selector));
        auction.withdrawDeposit(10e18);
    }

    function test_withdraw_not_deposit_phase() public {
        openDeposit();
        depositAs(alice, 100e18);
        openFulfillment();

        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.InvalidPhase.selector,IFixedPriceAuction.Phase.Deposit,IFixedPriceAuction.Phase.Fulfillment));
        auction.withdrawDeposit(100e18);
    }

    function test_withdraw_bidder_excluded() public {
        openDeposit();
        depositAs(alice, 100e18);
        complianceCheck.setBlocked(alice, true);

        vm.startPrank(executor);
        auction.excludeBidder(alice);

        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.BidderIsExcluded.selector, alice));
        auction.withdrawDeposit(100e18);
    }

    function test_withdraw_zzero_amount() public {
        openDeposit();
        depositAs(alice, 100e18);

        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        auction.withdrawDeposit(0);

        assertLiabilities(100e18, 0);
    }

    function test_withdraw_insufficient_deposit() public {
        openDeposit();

        depositAs(alice, 100e18);
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.InsufficientDeposit.selector));
        auction.withdrawDeposit(100e18 + 1);

        assertLiabilities(100e18, 0);
    }

    function test_withdraw_remainder_below_min() public {
        openDeposit();

        depositAs(alice, 100e18);
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.DepositBelowMinimum.selector));
        auction.withdrawDeposit(95e18);

        assertLiabilities(100e18, 0);
    }

    function test_withdraw_exact_minimum_remainder() public {
        openDeposit();
        depositAs(alice, 100e18);

        vm.startPrank(alice);
        auction.withdrawDeposit(90e18);

        assertEq(auction.deposits(alice), 10e18);
    }

    function test_withdraw_locked_during_fulfillment() public {
        openDeposit();
        depositAs(alice, 100e18);
        openFulfillment();

        vm.startPrank(alice);
        expectPhase(IFixedPriceAuction.Phase.Deposit, IFixedPriceAuction.Phase.Fulfillment);
        auction.withdrawDeposit(100e18);
    }

    function test_withdraw_allowed_when_flagged_or_compliance_unavailable() public {
        openDeposit();
        depositAs(alice, 100e18);

        complianceCheck.setBlocked(alice, true);
        complianceCheck.setFail(true);

        vm.startPrank(alice);
        auction.withdrawDeposit(100e18);

        assertLiabilities(0, 0);
    }

    function test_partial_and_full_withdrawal_update_accounting() public {
        openDeposit();
        depositAs(alice, 100e18);
        vm.startPrank(alice);
        vm.expectEmit(true, true, true, true, address(auction));
        emit DepositWithdrawn(alice, 40e18, 60e18, 60e18);
        auction.withdrawDeposit(40e18);
    
        assertEq(auction.unclaimedBidders(), 1);
        assertLiabilities(60e18, 0);
        vm.startPrank(alice);
        auction.withdrawDeposit(60e18);
        
        assertEq(auction.deposits(alice), 0);
        assertEq(auction.unclaimedBidders(), 0);
        assertEq(TEMPLE_TOKEN.balanceOf(alice), 100e18);
        assertLiabilities(0, 0);
        depositAs(alice, 10e18);
        assertEq(auction.unclaimedBidders(), 1);
    }
}

contract FixedPriceAuctionTest is FixedPriceAuctionTestBase {
    function test_cap_cannot_decrease() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.CannotLowerCap.selector));
        auction.setMaxTotalDeposits(999e18);
    }

    function test_unlimited_cap_cannot_be_reintroduced() public {
        vm.startPrank(executor);
        auction.setMaxTotalDeposits(0);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.CannotLowerCap.selector));
        auction.setMaxTotalDeposits(1000e18);
    }

    function test_cap_cannot_change_after_settlement() public {
        finishAuction();

        vm.startPrank(executor);
        expectPhase(IFixedPriceAuction.Phase.Deposit, IFixedPriceAuction.Phase.Settled);
        auction.setMaxTotalDeposits(0);
    }
}