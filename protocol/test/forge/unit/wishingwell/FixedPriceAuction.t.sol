pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// (tests/forge/wishingwell/FixedPriceAuction.t.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { IERC1271 } from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { IERC20Errors } from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
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

    function pauseAuction() internal {
        vm.startPrank(rescuer);
        auction.emergencyPause();
        vm.stopPrank();
    }

    function claimAs(address account) internal {
        vm.startPrank(account);
        auction.claim();
        vm.stopPrank();
    }

    function freezeAccount(address account) internal {
        openDeposit();
        depositAs(account, 100e18);
        complianceCheck.setBlocked(account, true);
        vm.startPrank(executor);
        auction.excludeBidder(account);
        vm.stopPrank();
    }

    function proposeAccountRelease(address account, address to) internal {
        vm.startPrank(executor);
        auction.proposeRelease(account, to);
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

contract FixedPriceAuctionTestPermit is FixedPriceAuctionTestBase {

    function test_valid_permit_deposits_for_signer() public {
        openDeposit();

        address account = vm.addr(key);
        deal(address(TEMPLE_TOKEN), account, 100e18, false);
        uint256 deadline = block.timestamp + 1 days;
        (uint8 v, bytes32 r, bytes32 s) = signPermit(account, 100e18, deadline);
        vm.startPrank(account);
        auction.depositWithPermit(100e18, deadline, v, r, s);

        assertEq(auction.deposits(account), 100e18);
        assertLiabilities(100e18, 0);
    }

    function test_failed_permit_without_allowance_reverts() public {
        openDeposit();

        deal(address(TEMPLE_TOKEN), alice, 100e18, false);
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(auction), 0, 100e18));
        auction.depositWithPermit(100e18, 0, 0, bytes32(0), bytes32(0));

        assertLiabilities(0, 0);
    }

    function test_failed_deposit_rolls_back_successful_permit() public {
        openDeposit();

        address account = vm.addr(key);
        deal(address(TEMPLE_TOKEN), alice, 1e18, false);
        uint256 deadline = block.timestamp + 1 days;
        (uint8 v, bytes32 r, bytes32 s) = signPermit(account, 1e18, deadline);

        vm.startPrank(account);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.DepositBelowMinimum.selector));
        auction.depositWithPermit(1e18, deadline, v, r, s);
    
        assertEq(TEMPLE_TOKEN.allowance(account, address(auction)), 0);
    }

    function test_deposit_with_permit_deposits_paused() public {
        openDeposit();

        vm.startPrank(executor);
        auction.setDepositsPaused(true);

        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.DepositsArePaused.selector));
        auction.depositWithPermit(10e18, 0, 0, bytes32(0), bytes32(0));
    }

    function test_deposit_with_permit_emergency_pause() public {
        openDeposit();
        pauseAuction();

        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.EmergencyPauseActive.selector));
        auction.depositWithPermit(10e18, 0, 0, bytes32(0), bytes32(0));
    }
}

contract FixedPriceAuctionTestFunding is FixedPriceAuctionTestBase {

    function test_fund_emergency_paused() public {
        openDeposit();

        vm.startPrank(rescuer);
        auction.emergencyPause();

        vm.startPrank(funder);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.EmergencyPauseActive.selector));
        auction.fund(1);
    }

    function test_fund_no_funding_during_scheduled() public {
        vm.startPrank(funder);
        expectPhase(IFixedPriceAuction.Phase.Fulfillment, IFixedPriceAuction.Phase.Scheduled);
        auction.fund(1);
    }

    function test_fund_no_funding_during_deposit() public {
        openDeposit();

        vm.startPrank(funder);
        expectPhase(IFixedPriceAuction.Phase.Fulfillment, IFixedPriceAuction.Phase.Deposit);
        auction.fund(1);
    }

    function test_fund_no_funding_during_settled() public {
        finishAuction();

        vm.startPrank(funder);
        expectPhase(IFixedPriceAuction.Phase.Fulfillment, IFixedPriceAuction.Phase.Settled);
        auction.fund(1);
    }

    function test_fund_zero_amount() public {
        openFulfillment();

        vm.startPrank(funder);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        auction.fund(0);
    }

    function test_fund_installments_and_excess_withdrawal() public {
        openDeposit();
        depositAs(alice, 100e18);
        openFulfillment();
        fundAuction(200e18);

        assertEq(auction.withdrawableExcess(), 0);

        fundAuction(300e18);
        assertEq(auction.fullFundingRequired(), 400e18);
        assertEq(auction.withdrawableExcess(), 100e18);

        vm.startPrank(funder);
        vm.expectEmit(true, true, true, true, address(auction));
        emit ExcessWithdrawn(funder, 100e18, 400e18);
        auction.withdrawExcess(100e18);

        assertEq(USDS.balanceOf(funder), 100e18);
        assertEq(auction.remainingFunding(), 400e18);
        assertLiabilities(100e18, 400e18);
    }

    function test_fund_committed_funds_cannot_be_withdrawn() public {
        openDeposit();
        depositAs(alice, 100e18);
        openFulfillment();
        fundAuction(200e18);

        vm.startPrank(funder);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.ExcessExceeded.selector, 1, 0));
        auction.withdrawExcess(1);

        assertLiabilities(100e18, 200e18);
    }

    function test_donated_fill_tokens_are_not_funding() public {
        openDeposit();
        depositAs(alice, 100e18);

        deal(address(USDS), address(auction), 400e18, false);
        openFulfillment();

        assertEq(auction.remainingFunding(), 0);
        assertEq(auction.withdrawableExcess(), 0);

        finishAuction();
        assertUserClaim(alice, 0, 100e18);
    }

    function test_fund_no_deposits() public {
        openFulfillment();
        fundAuction(400e18);

        assertEq(auction.withdrawableExcess(), 400e18);

        vm.startPrank(funder);
        auction.withdrawExcess(400e18);

        assertLiabilities(0, 0);
    }

    // -------
    function test_withdraw_excess_zero_excess() public {
        openFulfillment();

        vm.startPrank(funder);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        auction.withdrawExcess(0);
    }

    function test_withdraw_excess_zero_after_fulfillment() public {
        assertEq(auction.withdrawableExcess(), 0);

        openFulfillment();
        fundAuction(400e18);
        finishAuction();

        assertEq(auction.withdrawableExcess(), 0);
    }

    function test_withdraw_excess_emergency_paused() public {
        openDeposit();
        openFulfillment();
        fundAuction(400e18);

        vm.startPrank(rescuer);
        auction.emergencyPause();

        vm.startPrank(funder);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.EmergencyPauseActive.selector));
        auction.withdrawExcess(1);

        assertLiabilities(0, 400e18);
    }

    function test_withdraw_excess_phase() public {
        finishAuction();
        
        vm.startPrank(funder);
        expectPhase(IFixedPriceAuction.Phase.Fulfillment, IFixedPriceAuction.Phase.Settled);
        auction.withdrawExcess(1);
    }

    function test_withdraw_excess_amount_exceeds_excess() public {
        openDeposit();
        depositAs(alice, 100e18);

        deal(address(USDS), address(auction), 400e18, false);
        openFulfillment();

        vm.startPrank(funder);
        uint256 withdrawableExcess = auction.withdrawableExcess();
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.ExcessExceeded.selector, withdrawableExcess+1, withdrawableExcess));
        auction.withdrawExcess(withdrawableExcess+1);
    }

    function test_withdraw_excess() public {
        openFulfillment();
        fundAuction(400e18);

        vm.startPrank(funder);
        vm.expectEmit(address(auction));
        emit ExcessWithdrawn(config.funder, 400e18, 0);
        auction.withdrawExcess(400e18);
    }
}

contract FixedPriceAuctionTestSettlement is FixedPriceAuctionTestBase {

    function test_partial_fill_at_four_usds_per_temple() public {
        // Alice offers 100 TEMPLE, Bob 300; 800 USDS fills half at the fixed price of 4.
        partialAuction();

        assertSettlement(400e18, 200e18, 800e18, 200e18, 0);
        assertUserClaim(alice, 200e18, 50e18);
        assertUserClaim(bob, 600e18, 150e18);
        claimAs(alice);
        claimAs(bob);
        vm.startPrank(unauthorizedUser);
        auction.claimTreasury();

        assertEq(USDS.balanceOf(alice), 200e18);
        assertEq(TEMPLE_TOKEN.balanceOf(alice), 50e18);
        assertEq(USDS.balanceOf(bob), 600e18);
        assertEq(TEMPLE_TOKEN.balanceOf(bob), 150e18);
        assertEq(TEMPLE_TOKEN.balanceOf(proceedsRecipient), 200e18);
        assertEq(TEMPLE_TOKEN.balanceOf(unauthorizedUser), 0);
        assertLiabilities(0, 0);
    }

    function test_full_fill() public {
        openDeposit();
        depositAs(alice, 100e18);
        openFulfillment();
        fundAuction(400e18);
        finishAuction();
        claimAs(alice);
        auction.claimTreasury();

        assertEq(USDS.balanceOf(alice), 400e18);
        assertEq(TEMPLE_TOKEN.balanceOf(proceedsRecipient), 100e18);
        assertLiabilities(0, 0);
    }

    function test_zero_fill_refunds_bid_tokens() public {
        openDeposit();
        depositAs(alice, 100e18);
        finishAuction();
        assertSettlement(100e18, 0, 0, 100e18, 0);
        claimAs(alice);
        auction.claimTreasury();

        assertEq(TEMPLE_TOKEN.balanceOf(alice), 100e18);
        assertLiabilities(0, 0);
    }

    // --- Claims ---- //

    function test_claim() public {
        partialAuction();

        vm.startPrank(alice);
        vm.expectEmit(true, true, true, true, address(auction));
        emit AuctionSettled(alice, false, 400e18, 200e18, 800e18, 200e18, 0);
        vm.expectEmit(true, true, true, true, address(auction));
        emit UserClaimed(alice, 200e18, 50e18);
        auction.claim();

        assertTrue(auction.claimed(alice));
        assertUserClaim(alice, 0, 0);
    }

    function test_claim_already_claimed() public {
        partialAuction();
        claimAs(alice);

        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.AlreadyClaimed.selector));
        auction.claim();
    }

    function test_claim_treasury_already_claimed() public {
        partialAuction();
        auction.claimTreasury();

        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.AlreadyClaimed.selector));
        auction.claimTreasury();

        IFixedPriceAuction.TreasuryClaim memory result = auction.treasuryClaimable();
        assertEq(result.bidTokenAmount, 0);
        assertEq(result.fillTokenRefund, 0);
    }

    function test_claim_before_end() public {
        openDeposit();
        depositAs(alice, 100e18);

        assertUserClaim(alice, 0, 0);
        assertEq(auction.treasuryClaimable().bidTokenAmount, 0);

        vm.startPrank(alice);
        expectPhase(IFixedPriceAuction.Phase.Settled, IFixedPriceAuction.Phase.Deposit);
        auction.claim();
    }

    function test_claim_no_expiry() public {
        partialAuction();

        vm.warp(block.timestamp + 10 * 365 days);
        claimAs(alice);

        assertEq(USDS.balanceOf(alice), 200e18);
        assertUserClaim(bob, 600e18, 150e18);
    }

    function test_claim_emergency_paused() public {
        openDeposit();
        depositAs(alice, 100e18);

        openFulfillment();
        fundAuction(200e18);
        finishAuction();

        vm.startPrank(rescuer);
        auction.emergencyPause();

        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.EmergencyPauseActive.selector));
        auction.claim();
    }

    function test_claim_ensure_finalized() public {
        openDeposit();
        depositAs(alice, 100e18);

        openFulfillment();
        fundAuction(200e18);

        // Claims cannot finalize the auction before fulfillment ends.
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.InvalidPhase.selector, IFixedPriceAuction.Phase.Settled, IFixedPriceAuction.Phase.Fulfillment));
        auction.claim();
    }

    function test_claim_zero_deposit() public {
        finishAuction();

        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.NothingToClaim.selector));
        auction.claim();
    }

    function test_claim_account_excluded() public {
        openDeposit();
        depositAs(alice, 100e18);

        complianceCheck.setBlocked(alice, true);

        vm.startPrank(executor);
        auction.excludeBidder(alice);

        finishAuction();

        uint256 bidBalanceBefore = TEMPLE_TOKEN.balanceOf(alice);
        uint256 fillBalanceBefore = USDS.balanceOf(alice);

        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.BidderIsExcluded.selector, alice));
        auction.claim();

        assertTrue(auction.excluded(alice));
        assertFalse(auction.claimed(alice));
        assertEq(auction.deposits(alice), 0);
        assertUserClaim(alice, 0, 0);

        // Exclusion freezes the entire deposit before settlement.
        assertEq(auction.frozenBid(alice), 100e18);
        assertEq(auction.frozenFill(alice), 0);
        assertEq(TEMPLE_TOKEN.balanceOf(alice), bidBalanceBefore);
        assertEq(USDS.balanceOf(alice), fillBalanceBefore);
        assertLiabilities(100e18, 0);
    }

    function test_claim_account_blocked_freeze() public {
        openDeposit();
        depositAs(alice, 100e18);

        openFulfillment();
        fundAuction(200e18);
        finishAuction();

        // At 4 USDS per TEMPLE: 200 USDS payout and 50 TEMPLE refund.
        assertUserClaim(alice, 200e18, 50e18);
        complianceCheck.setBlocked(alice, true);

        uint256 bidBalanceBefore = TEMPLE_TOKEN.balanceOf(alice);
        uint256 fillBalanceBefore = USDS.balanceOf(alice);

        vm.startPrank(alice);
        vm.expectEmit(address(auction));
        emit IFixedPriceAuction.ClaimFrozen(alice, 200e18, 50e18);
        auction.claim();

        // Claim is processed, but neither token is transferred to Alice.
        assertTrue(auction.claimed(alice));
        assertEq(auction.unclaimedBidders(), 0);
        assertUserClaim(alice, 0, 0);
        assertEq(TEMPLE_TOKEN.balanceOf(alice), bidBalanceBefore);
        assertEq(USDS.balanceOf(alice), fillBalanceBefore);

        assertEq(auction.frozenBid(alice), 50e18);
        assertEq(auction.frozenFill(alice), 200e18);

        // Reserves include Alice's frozen funds and the funder's bid proceeds.
        assertLiabilities(100e18, 200e18);

        auction.claimTreasury();

        // Frozen funds stay reserved after the proceeds are claimed.
        assertLiabilities(50e18, 200e18);
    }

    function test_claim_account_fill_and_bid_transfers() public {
        openDeposit();
        depositAs(alice, 100e18);

        openFulfillment();
        fundAuction(200e18);
        finishAuction();

        // At 4 USDS per TEMPLE, funding fills 50 of Alice's 100 TEMPLE.
        assertUserClaim(alice, 200e18, 50e18);

        uint256 bidBalanceBefore = TEMPLE_TOKEN.balanceOf(alice);
        uint256 fillBalanceBefore = USDS.balanceOf(alice);

        vm.startPrank(alice);
        vm.expectEmit(address(auction));
        emit IFixedPriceAuction.UserClaimed(alice, 200e18, 50e18);
        auction.claim();

        assertEq(TEMPLE_TOKEN.balanceOf(alice), bidBalanceBefore + 50e18);
        assertEq(USDS.balanceOf(alice), fillBalanceBefore + 200e18);
        assertTrue(auction.claimed(alice));
        assertUserClaim(alice, 0, 0);

        // The remaining bid tokens belong to the proceeds recipient.
        assertLiabilities(50e18, 0);
    }

    function test_claim_dust_removed() public {
        IFixedPriceAuction.AuctionConfig memory _config = getConfig();
        _config.price = 1e18;
        _config.minDeposit = 0;
        auction = new FixedPriceAuction(_config, executor, rescuer);

        // Use base units to produce rounding dust.
        openDeposit();
        depositAs(alice, 2);
        depositAs(bob, 4);

        openFulfillment();
        fundAuction(4);
        finishAuction();

        // Total deposits: 6; filled: 4; refund budget: 2.
        // Alice receives 1 fill token and 0 bid-token refund.
        // Bob receives 2 fill tokens and 1 bid-token refund.
        // This leaves 1 base unit of each token as dust.
        assertUserClaim(alice, 1, 0);
        assertUserClaim(bob, 2, 1);

        auction.claimTreasury();
        claimAs(alice);

        // Dust remains reserved until Bob, the final bidder, claims.
        assertEq(auction.unclaimedBidders(), 1);
        assertLiabilities(2, 3);

        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.InsufficientRecoverableBalance.selector));
        auction.recoverToken(address(USDS), executor, 1);

        claimAs(bob);

        // The final claim releases both dust amounts from liabilities.
        assertEq(auction.unclaimedBidders(), 0);
        assertLiabilities(0, 0);
        assertEq(TEMPLE_TOKEN.balanceOf(address(auction)), 1);
        assertEq(USDS.balanceOf(address(auction)), 1);

        vm.startPrank(executor);
        auction.recoverToken(address(TEMPLE_TOKEN), executor, 1);
        auction.recoverToken(address(USDS), executor, 1);

        assertEq(TEMPLE_TOKEN.balanceOf(address(auction)), 0);
        assertEq(USDS.balanceOf(address(auction)), 0);
    }

    // --- Claim Treasury --- //

    function test_claim_treasury_paused() public {
        openDeposit();
        depositAs(alice, 100e18);

        openFulfillment();
        fundAuction(200e18);
        finishAuction();

        vm.startPrank(rescuer);
        auction.emergencyPause();

        vm.startPrank(funder);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.EmergencyPauseActive.selector));
        auction.claimTreasury();

        assertFalse(auction.treasuryClaimed());
        assertEq(TEMPLE_TOKEN.balanceOf(address(auction)), 100e18);
        assertEq(USDS.balanceOf(address(auction)), 200e18);
    }

    function test_claim_treasury_ensure_finalized() public {
        openDeposit();
        depositAs(alice, 100e18);

        openFulfillment();
        fundAuction(200e18);

        finishAuction();

        uint256 balanceBefore = TEMPLE_TOKEN.balanceOf(proceedsRecipient);

        vm.startPrank(funder);
        vm.expectEmit(address(auction));
        emit IFixedPriceAuction.AuctionSettled(funder, false, 100e18, 50e18, 200e18, 50e18, 0);
        auction.claimTreasury();

        assertTrue(auction.treasuryClaimed());
        assertEq(TEMPLE_TOKEN.balanceOf(proceedsRecipient), balanceBefore + 50e18);

        assertEq(USDS.balanceOf(address(auction)), 200e18);
        assertEq(TEMPLE_TOKEN.balanceOf(address(auction)), 50e18);
    }

    function test_claim_treasury() public {
        openDeposit();
        depositAs(alice, 100e18);

        openFulfillment();
        fundAuction(500e18);
        finishAuction();

        uint256 proceedsBalanceBefore = TEMPLE_TOKEN.balanceOf(proceedsRecipient);
        uint256 funderBalanceBefore = USDS.balanceOf(funder);

        // Full fill costs 400 USDS; the remaining 100 USDS returns to the funder.
        vm.startPrank(funder);
        vm.expectEmit(address(auction));
        emit IFixedPriceAuction.TreasuryClaimed(funder, proceedsRecipient, funder, 100e18, 100e18);
        auction.claimTreasury();

        assertTrue(auction.treasuryClaimed());
        assertEq(TEMPLE_TOKEN.balanceOf(proceedsRecipient), proceedsBalanceBefore + 100e18);
        assertEq(USDS.balanceOf(funder), funderBalanceBefore + 100e18);
        assertEq(TEMPLE_TOKEN.balanceOf(address(auction)), 0);
        assertEq(USDS.balanceOf(address(auction)), 400e18);
        assertFalse(auction.claimed(alice));
    }

}

contract FixedPriceAuctionTestCancellation is FixedPriceAuctionTestBase {

    function test_cancel_scheduled_refunds_original_assets() public {
        vm.startPrank(executor);
        auction.cancelScheduled();

        assertEq(uint256(auction.phase()), uint256(IFixedPriceAuction.Phase.Cancelled));
        assertSettlement(0, 0, 0, 0, 0);
        auction.finalize();
        assertLiabilities(0, 0);
    }

    function test_cancel_deposit_refunds_original_assets() public {
        openDeposit();
        depositAs(alice, 100e18);
        vm.startPrank(executor);
        auction.cancelDeposit();
    
        assertEq(uint256(auction.phase()), uint256(IFixedPriceAuction.Phase.Cancelled));
        assertUserClaim(alice, 0, 100e18);
        claimAs(alice);
        assertEq(TEMPLE_TOKEN.balanceOf(alice), 100e18);
        auction.finalize();

        assertLiabilities(0, 0);
    }

    function test_cancel_fulfillment_refunds_original_assets() public {
        openDeposit();
        depositAs(alice, 100e18);
        openFulfillment();
        fundAuction(400e18);

        vm.startPrank(executor);
        auction.cancelFulfillment();
    
        assertEq(uint256(auction.phase()), uint256(IFixedPriceAuction.Phase.Cancelled));
        assertSettlement(100e18, 0, 0, 100e18, 400e18);
        claimAs(alice);
        auction.claimTreasury();

        assertEq(USDS.balanceOf(funder), 400e18);
        assertEq(TEMPLE_TOKEN.balanceOf(proceedsRecipient), 0);
        auction.finalize();

        assertLiabilities(0, 0);
    }

    function test_cancel_scheduled_cannot_cancel_after_natural_settlement() public {
        finishAuction();

        vm.startPrank(executor);
        expectPhase(IFixedPriceAuction.Phase.Scheduled, IFixedPriceAuction.Phase.Settled);
        auction.cancelScheduled();
    }

    function test_cancel_deposit_cannot_cancel_after_natural_settlement() public {
        finishAuction();

        vm.startPrank(executor);
        expectPhase(IFixedPriceAuction.Phase.Deposit, IFixedPriceAuction.Phase.Settled);
        auction.cancelDeposit();
    }

    function test_cancel_fulfillment_cannot_cancel_after_natural_settlement() public {
        finishAuction();

        vm.startPrank(executor);
        expectPhase(IFixedPriceAuction.Phase.Fulfillment, IFixedPriceAuction.Phase.Settled);
        auction.cancelFulfillment();
    }

    function test_cancel_preserves_excluded_funds() public {
        freezeAccount(alice);

        vm.startPrank(executor);
        auction.cancelDeposit();
 
        assertEq(auction.frozenBid(alice), 100e18);
        assertUserClaim(alice, 0, 0);
        assertLiabilities(100e18, 0);
    }

    function test_cancelled_auction_never_reopens() public {
        vm.startPrank(executor);
        auction.cancelScheduled();

        finishAuction();
        assertEq(uint256(auction.phase()), uint256(IFixedPriceAuction.Phase.Cancelled));
        expectPhase(IFixedPriceAuction.Phase.Deposit, IFixedPriceAuction.Phase.Cancelled);
        auction.deposit(1);
    }
}

contract FixedPriceAuctionTestCompliance is FixedPriceAuctionTestBase {

    function test_reverting_source_preserves_unclaimed_entitlement() public {
        partialAuction();
        complianceCheck.setFail(true);

        vm.startPrank(alice);
        vm.expectRevert(bytes("Compliance unavailable"));
        auction.claim();

        assertFalse(auction.claimed(alice));
        assertEq(auction.unclaimedBidders(), 2);
        assertLiabilities(400e18, 800e18);
    }

    function test_disable_compliance_restores_claims_and_preserves_config() public {
        partialAuction();
        complianceCheck.setFail(true);

        vm.startPrank(executor);
        vm.expectEmit(true, true, true, true, address(auction));
        emit ComplianceCheckDisabled();
        auction.disableComplianceCheck();
    
        assertEq(auction.complianceCheck(), address(0));
        assertEq(auction.getConfig().complianceCheck, address(complianceCheck));
    }

    function test_exclusion_during_fulfillment_creates_excess() public {
        openDeposit();
        depositAs(alice, 100e18);
        depositAs(bob, 100e18);
        openFulfillment();
        fundAuction(800e18);

        complianceCheck.setBlocked(alice, true);
        vm.startPrank(executor);
        auction.excludeBidder(alice);

        assertEq(auction.withdrawableExcess(), 400e18);
        finishAuction();
        assertUserClaim(bob, 400e18, 0);
        claimAs(bob);
        auction.claimTreasury();
        assertEq(USDS.balanceOf(funder), 400e18);
        assertLiabilities(100e18, 0);
    }

    function test_exclude_unflagged() public {
        openDeposit();
        depositAs(alice, 100e18);

        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.AccountNotBlocked.selector));
        auction.excludeBidder(alice);
    }

    function test_exclude_no_deposit() public {
        openDeposit();
        complianceCheck.setBlocked(alice, true);

        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.NothingToClaim.selector));
        auction.excludeBidder(alice);
    }

    function test_exclide_after_settlement() public {
        partialAuction();
        complianceCheck.setBlocked(alice, true);

        vm.startPrank(executor);
        expectPhase(IFixedPriceAuction.Phase.Deposit, IFixedPriceAuction.Phase.Settled);
        auction.excludeBidder(alice);
    }

    function test_flagged_cancelled_claim_freezes_full_refund() public {
        openDeposit();
        depositAs(alice, 100e18);

        vm.startPrank(executor);
        auction.cancelDeposit();

        complianceCheck.setBlocked(alice, true);
        claimAs(alice);
        assertEq(auction.frozenBid(alice), 100e18);
        assertEq(auction.frozenFill(alice), 0);
        assertLiabilities(100e18, 0);
    }

}

contract FixedPriceAuctionTestFrozenRelease is FixedPriceAuctionTestBase {

    function test_release_proposal_seven_day_delay() public {
        freezeAccount(alice);
        uint64 executableAt = uint64(block.timestamp + 7 days);
        vm.startPrank(executor);
        vm.expectEmit(true, true, true, true, address(auction));
        emit ReleaseProposed(alice, escrow, executableAt);
        auction.proposeRelease(alice, escrow);

        IFixedPriceAuction.ReleaseProposal memory proposal = auction.releaseProposal(alice);
        assertEq(proposal.to, escrow);
        assertEq(proposal.executableAt, executableAt);
        assertLiabilities(100e18, 0);
    }

    function test_release() public {
        freezeAccount(alice);
        proposeAccountRelease(alice, alice);

        uint64 executableAt = auction.releaseProposal(alice).executableAt;
        uint256 balanceBefore = TEMPLE_TOKEN.balanceOf(alice);

        vm.warp(executableAt - 1);
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.ReleaseNotReady.selector));
        auction.executeRelease(alice);

        assertEq(TEMPLE_TOKEN.balanceOf(alice), balanceBefore);
        assertEq(auction.frozenBid(alice), 100e18);
        assertEq(auction.releaseProposal(alice).executableAt, executableAt);
        assertLiabilities(100e18, 0);

        vm.warp(executableAt);
        vm.startPrank(executor);
        vm.expectEmit(address(auction));
        emit IFixedPriceAuction.FrozenReleased(alice, alice, 100e18, 0);
        auction.executeRelease(alice);

        assertEq(TEMPLE_TOKEN.balanceOf(alice), balanceBefore + 100e18);
        assertEq(auction.frozenBid(alice), 0);
        assertEq(auction.releaseProposal(alice).to, address(0));
        assertEq(auction.releaseProposal(alice).executableAt, 0);
        assertLiabilities(0, 0);
    }

    function test_execute_release() public {
        freezeAccount(alice);
        proposeAccountRelease(alice, escrow);

        vm.warp(auction.releaseProposal(alice).executableAt);
        vm.startPrank(executor);
        vm.expectEmit(true, true, true, true, address(auction));
        emit FrozenReleased(alice, escrow, 100e18, 0);
        auction.executeRelease(alice);
        vm.stopPrank();
        assertEq(TEMPLE_TOKEN.balanceOf(escrow), 100e18);
        assertEq(auction.frozenBid(alice), 0);
        assertEq(auction.releaseProposal(alice).to, address(0));
        assertLiabilities(0, 0);
    }

    function test_release_frozen_bid_and_fill_claim() public {
        partialAuction();
        complianceCheck.setBlocked(alice, true);
        claimAs(alice);
        proposeAccountRelease(alice, escrow);

        vm.warp(auction.releaseProposal(alice).executableAt);
        vm.startPrank(executor);
        auction.executeRelease(alice);

        assertEq(TEMPLE_TOKEN.balanceOf(escrow), 50e18);
        assertEq(USDS.balanceOf(escrow), 200e18);
        claimAs(bob);
        auction.claimTreasury();
        assertLiabilities(0, 0);
    }

    function test_propose_release_invalid_address() public {
        freezeAccount(alice);
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.InvalidReleaseRecipient.selector));
        auction.proposeRelease(alice, bob);
    }

    function test_propose_zero_address() public {
        freezeAccount(alice);
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        auction.proposeRelease(alice, address(0));
    }

    function test_proposal_zero_frozen_balance() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.NothingToClaim.selector));
        auction.proposeRelease(alice, alice);
    }

    function test_execute_release_no_proposal() public {
        freezeAccount(alice);
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.NoReleaseProposal.selector));
        auction.executeRelease(alice);
    }
}

contract FixedPriceAuctionTestRecovery is FixedPriceAuctionTestBase {

    function test_recover_token_zero_amount() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        auction.recoverToken(address(TEMPLE_TOKEN), executor, 0);
    }

    function test_recover_token_invalid_address() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        auction.recoverToken(address(TEMPLE_TOKEN), address(0), 1e18);
    }

    function test_recover_token_recovery_amount_exceeds_balance() public {
        TEMPLE_TOKEN.mint(address(auction), 100e18);

        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.InsufficientRecoverableBalance.selector));
        auction.recoverToken(address(TEMPLE_TOKEN), executor, 100e18 + 1);

        assertEq(TEMPLE_TOKEN.balanceOf(address(auction)), 100e18);
    }

    function test_recover_token_amount_exceeds_recoverable_balance() public {
        openDeposit();
        depositAs(alice, 100e18);

        // Only additional 20 tokens are recoverable
        TEMPLE_TOKEN.mint(address(auction), 20e18);

        uint256 balanceBefore = TEMPLE_TOKEN.balanceOf(executor);

        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(IFixedPriceAuction.InsufficientRecoverableBalance.selector));
        auction.recoverToken(address(TEMPLE_TOKEN), executor, 20e18+1);

        assertEq(TEMPLE_TOKEN.balanceOf(executor), balanceBefore);
        assertEq(TEMPLE_TOKEN.balanceOf(address(auction)), 120e18);
        assertEq(auction.deposits(alice), 100e18);
        assertLiabilities(100e18, 0);
    }

    function test_recover_token() public {
        openDeposit();
        depositAs(alice, 100e18);

        // Only additional 20 tokens are recoverable
        TEMPLE_TOKEN.mint(address(auction), 20e18);

        uint256 balanceBefore = TEMPLE_TOKEN.balanceOf(executor);

        vm.startPrank(executor);
        auction.recoverToken(address(TEMPLE_TOKEN), executor, 20e18);

        assertEq(TEMPLE_TOKEN.balanceOf(executor), balanceBefore + 20e18);
        assertEq(TEMPLE_TOKEN.balanceOf(address(auction)), 100e18);
        assertEq(auction.deposits(alice), 100e18);
        assertLiabilities(100e18, 0);
    }
}