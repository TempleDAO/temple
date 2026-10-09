pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// (tests/forge/wishingwell/WishingWell.t.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";

import { IWishingWell } from "contracts/interfaces/wishingwell/IWishingWell.sol";

import { TempleGoldCommon } from "test/forge/unit/templegold/TempleGoldCommon.t.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";

import { WishingWell } from "contracts/wishingwell/WishingWell.sol";


/// @notice Read-only compliance adapter. Reverts deliberately fail screening closed (FPA-31).
interface IComplianceCheck {
    /// @dev FPA-31.
    /// @param account Account to check.
    function isBlocked(address account) external view returns (bool);
}

contract WishingWellTestRegistry {
    mapping(address => bool) public supported;
    bool public fail;

    function setSupported(address token, bool value) external {
        supported[token] = value;
    }

    function setFail(bool value) external {
        fail = value;
    }

    function isSupported(address token) external view returns (bool) {
        if (fail) { return false; }
        return supported[token];
    }
}

contract WishingWellTestCompliance {
    mapping(address => bool) public blocked;
    bool public fail;

    function setBlocked(address account, bool value) external {
        blocked[account] = value;
    }

    function setFail(bool value) external {
        fail = value;
    }

    function isBlocked(address account) external view returns (bool) {
        if (fail) { return false; }
        return blocked[account];
    }
}

contract MockWallet is IERC1271 {
    bytes32 public digest;

    function approve(bytes32 digest_) external {
        digest = digest_;
    }

    function isValidSignature(bytes32 hash, bytes memory) external view returns (bytes4) {
        return hash == digest ? IERC1271.isValidSignature.selector : bytes4(0xffffffff);
    }
}

contract RevertingWallet is IERC1271 {
    function isValidSignature(bytes32, bytes memory) external pure returns (bytes4) {
        revert("Wallet validation failed");
    }
}

contract WishingWellTestBase is TempleGoldCommon {

    event WishSet(
        address indexed account,
        address indexed targetToken,
        address indexed amountAsset,
        IWishingWell.Direction direction,
        uint128 amount,
        uint64 expiresAt,
        uint256 nonce
    );
    event WishRevoked(address indexed account, address indexed targetToken, uint256 nonce);
    event ExclusionSet(address indexed targetToken, address indexed account, bool excluded);

    string internal constant WELL_NAME = "Wishing Well";
    string internal constant WELL_VERSION = "1.0";

    WishingWell well;
    WishingWellTestRegistry internal tokenRegistry;
    WishingWellTestCompliance internal complianceCheck;

    FakeERC20 internal TEMPLE_TOKEN;
    FakeERC20 internal TGLD;
    FakeERC20 internal USDS;
    uint256 key = 12345;

    function setUp() public {
        vm.warp(1000);
        tokenRegistry = new WishingWellTestRegistry();
        complianceCheck = new WishingWellTestCompliance();
        well = new WishingWell(executor, rescuer, address(tokenRegistry), address(complianceCheck), WELL_NAME, WELL_VERSION);
        TEMPLE_TOKEN = new FakeERC20("Temple Token", "TEMPLE", executor, 1000 ether);
        TGLD = new FakeERC20("Temple Gold", "TGLD", executor, 1000 ether);
        USDS = new FakeERC20("USDC", "USDC", executor, 1000 ether);
    }

    function setExcluded(address account, bool value) internal {
        vm.startPrank(executor);
        well.setExcluded(address(USDS), account, value);
        vm.stopPrank();
    }

    function sell(address account, uint128 amount, uint64 duration) internal {
        vm.startPrank(account);
        well.setWish(address(USDS), IWishingWell.Direction.Sell, address(USDS), amount, duration);
        vm.stopPrank();
    }

    function active(address account) internal view returns (uint256) {
        return well.activeAmount(account, address(USDS), IWishingWell.Direction.Sell, address(USDS));
    }

    function signedWish() internal returns (IWishingWell.SignedWish memory) {
        emit log_string("Key's account");
        emit log_address(vm.addr(key));
        return IWishingWell.SignedWish(
            vm.addr(key),
            address(USDS),
            address(USDS),
            IWishingWell.Direction.Sell,
            100,
            uint64(block.timestamp + 30 days),
            0,
            uint64(block.timestamp + 1 days)
        );
    }

    function sign(IWishingWell.SignedWish memory wish) internal returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, well.wishDigest(wish));
        return abi.encodePacked(r, s, v);
    }

    function stated() internal view returns (uint256) {
        return well.totalStated(address(USDS), IWishingWell.Direction.Sell, address(USDS));
    }

    function setSupported(address token, bool supported) internal {
        vm.startPrank(executor);
        tokenRegistry.setSupported(token, supported);
        vm.stopPrank();
    }

    function setBuyPaymentAsset(address targetToken, address asset) internal {
        vm.startPrank(executor);
        well.setBuyPaymentAsset(targetToken, asset);
        vm.stopPrank();
    }

    function addSupportedAndDeal(uint256 dealAmount) internal {
        setSupported(address(TGLD), true);
        setSupported(address(USDS), true);
        deal(address(USDS), alice, dealAmount, false);
        deal(address(TGLD), alice, dealAmount, false);

        deal(address(USDS), bob, dealAmount, false);
        deal(address(TGLD), bob, dealAmount, false);
    }

    function test_wishing_well_initialization() public {
        assertEq(well.executor(), executor);
        assertEq(well.rescuer(), rescuer);
        assertEq(well.name(), WELL_NAME);
        assertEq(well.version(), WELL_VERSION);
        assertEq(well.tokenRegistry(), address(tokenRegistry));
        assertEq(well.complianceCheck(), address(complianceCheck));
    }
}

contract WishingWellTestAccess is WishingWellTestBase {

    function test_access_set_excluded() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        well.setExcluded(address(USDS), alice, true);
    }

    function test_access_set_buy_payment_asset() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        well.setBuyPaymentAsset(address(USDS), address(TGLD));
    }

    function test_access_set_threshold() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        well.setThreshold(address(USDS), IWishingWell.Direction.Buy, 1e18);
    }

    function test_access_set_min_quorum_duration() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        well.setMinQuorumDuration(address(USDS), IWishingWell.Direction.Buy, 3 days);
    }

    function test_access_set_compliance_check() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        well.setComplianceCheck(address(complianceCheck));
    }
}

contract WishingWellTestAdmin is WishingWellTestBase {

    function test_set_excluded_invalid_target() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        well.setExcluded(address(0), alice, true);
    }
    function test_set_excluded_invalid_account() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        well.setExcluded(address(USDS), address(0), true);
    }

    function test_set_excluded_with_contribution_removal() public {

    }

    function test_set_excluded() public {
        vm.startPrank(executor);

        vm.expectEmit(address(well));
        emit ExclusionSet(address(USDS), alice, true);
        well.setExcluded(address(USDS), alice, true);

        assertEq(well.excluded(address(USDS), alice), true);

        vm.expectEmit(address(well));
        emit ExclusionSet(address(USDS), alice, false);
        well.setExcluded(address(USDS), alice, false);
        assertEq(well.excluded(address(USDS), alice), false);
    }

    function test_set_buy_payment_asset_invalid_target() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        well.setBuyPaymentAsset(address(0), address(USDS));
    }

    function test_set_buy_payment_asset() public {
        setSupported(address(USDS), true);
        setSupported(address(TEMPLE_TOKEN), true);
        setSupported(address(TGLD), true);
        vm.startPrank(executor);

        vm.expectEmit(address(well));
        emit IWishingWell.BuyPaymentAssetSet(address(USDS), address(TGLD));
        well.setBuyPaymentAsset(address(USDS), address(TGLD));
        
        assertEq(well.buyPaymentAsset(address(USDS)), address(TGLD));

        vm.expectEmit(address(well));
        emit IWishingWell.BuyPaymentAssetSet(address(TEMPLE_TOKEN), address(USDS));
        well.setBuyPaymentAsset(address(TEMPLE_TOKEN), address(USDS));

        assertEq(well.buyPaymentAsset(address(TEMPLE_TOKEN)), address(USDS));
    }

    function test_set_buy_payment_asset_asset_equal_target() public {
        setSupported(address(USDS), true);
        setSupported(address(TEMPLE_TOKEN), true);
        setSupported(address(TGLD), true);
        vm.startPrank(executor);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        well.setBuyPaymentAsset(address(TGLD), address(TGLD));
    }

    function test_set_buy_payment_asset_reset_asset() public {
        test_set_buy_payment_asset();
        vm.expectEmit(address(well));
        emit IWishingWell.BuyPaymentAssetSet(address(TGLD), address(0));
        well.setBuyPaymentAsset(address(TGLD), address(0));

        assertEq(well.buyPaymentAsset(address(TGLD)), address(0));
    }

    function test_set_threshold_invalid_target() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        well.setThreshold(address(0), IWishingWell.Direction.Sell, 1e18);
    }

    function test_set_threshold_zero_disables_quorum() public {
        vm.startPrank(executor);
        well.setThreshold(address(TEMPLE_TOKEN), IWishingWell.Direction.Sell, 100e18);
        assertEq(well.threshold(address(TEMPLE_TOKEN), IWishingWell.Direction.Sell), 100e18);
        well.setThreshold(address(TEMPLE_TOKEN), IWishingWell.Direction.Sell, 0);

        assertEq(well.threshold(address(TEMPLE_TOKEN), IWishingWell.Direction.Sell), 0);
    }

    function test_set_threshold() public {
        vm.startPrank(executor);
        vm.expectEmit(address(well));
        emit IWishingWell.ThresholdSet(address(TEMPLE_TOKEN), IWishingWell.Direction.Buy, 100e18);
        well.setThreshold(address(TEMPLE_TOKEN), IWishingWell.Direction.Buy, 100e18);
    }

    function test_set_min_quorum_duration_invalid_target() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        well.setMinQuorumDuration(address(0), IWishingWell.Direction.Buy, 1 weeks);
        // setMinQuorumDuration(address targetToken, Direction direction, uint64 duration)
    }

    function test_set_min_quorum_duration_zero_duration() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        well.setMinQuorumDuration(address(TEMPLE_TOKEN), IWishingWell.Direction.Buy, 0);
    }

    function test_set_min_quorum_over_max_duration() public {
        uint64 duration = well.MAX_QUORUM_DURATION() + 1;
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(IWishingWell.InvalidQuorumDuration.selector));
        well.setMinQuorumDuration(address(TEMPLE_TOKEN), IWishingWell.Direction.Buy, duration);
    }

    function test_set_min_quorum_below_min_duration() public {
        uint64 duration = well.MIN_QUORUM_DURATION() - 1;
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(IWishingWell.InvalidQuorumDuration.selector));
        well.setMinQuorumDuration(address(TEMPLE_TOKEN), IWishingWell.Direction.Buy, duration);
    }

    function test_set_min_quorum_duration() public {
        vm.startPrank(executor);
        uint64 duration = well.MIN_QUORUM_DURATION() + 1;
        vm.expectEmit(address(well));
        emit IWishingWell.MinQuorumDurationSet(address(TEMPLE_TOKEN), IWishingWell.Direction.Sell, duration);
        well.setMinQuorumDuration(address(TEMPLE_TOKEN), IWishingWell.Direction.Sell, duration);
        assertEq(well.minQuorumDuration(address(TEMPLE_TOKEN),  IWishingWell.Direction.Sell), duration);
    }

    function test_set_compliance_check_invalid_address() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        well.setComplianceCheck(address(0));
    }
    function test_set_compliance_check() public {
        vm.startPrank(executor);
        vm.expectEmit(address(well));
        emit IWishingWell.ComplianceCheckSet(alice);
        well.setComplianceCheck(alice);
    }

    function test_buy_asset_setter_validation_and_clear_after_delisting() public {
        setSupported(address(TEMPLE_TOKEN), true);
        setSupported(address(USDS), true);

        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        well.setBuyPaymentAsset(address(0), address(TEMPLE_TOKEN));

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        well.setBuyPaymentAsset(address(USDS), address(USDS));

        vm.expectRevert(abi.encodeWithSelector(IWishingWell.UnsupportedToken.selector, alice));
        well.setBuyPaymentAsset(address(USDS), alice);

        tokenRegistry.setSupported(address(USDS), false);
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(IWishingWell.UnsupportedToken.selector, address(USDS)));
        well.setBuyPaymentAsset(address(USDS), address(TEMPLE_TOKEN));

        well.setBuyPaymentAsset(address(USDS), address(0));
        assertEq(well.buyPaymentAsset(address(USDS)), address(0));
    }

    function test_clear_and_restore_buy_asset_preserves_records_and_sell_demand() public {
        setSupported(address(USDS), true);
        setSupported(address(TGLD), true);
        setBuyPaymentAsset(address(USDS), address(TGLD));

        deal(address(USDS), bob, 100e18, false);
        deal(address(TGLD), alice, 100e18, false);
        sell(bob, 50, 1 days);
        vm.startPrank(alice);
        well.setWish(address(USDS), IWishingWell.Direction.Buy, address(TGLD), 100, 1 days);

        vm.startPrank(executor);
        well.setBuyPaymentAsset(address(USDS), address(0));
        assertEq(well.activeAmount(alice, address(USDS), IWishingWell.Direction.Buy, address(TGLD)), 0);
        assertEq(well.totalStated(address(USDS), IWishingWell.Direction.Buy, address(TGLD)), 0);
        assertEq(stated(), 50);
        assertEq(well.getWish(alice, address(USDS)).amount, 100);

        vm.startPrank(executor);
        well.setBuyPaymentAsset(address(USDS), address(TGLD));
        assertEq(well.totalStated(address(USDS), IWishingWell.Direction.Buy, address(TGLD)), 100);
        assertEq(well.nonces(alice), 1);
    }

    function test_rescue_mode_gates_settings_but_does_not_stop_user_wishes() public {
        vm.startPrank(rescuer);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        well.setExcluded(address(USDS), alice, true);
        vm.startPrank(rescuer);
        well.setRescueMode(true);

        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        well.setThreshold(address(USDS), IWishingWell.Direction.Sell, 1);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        well.setExcluded(address(USDS), alice, true);

        vm.startPrank(rescuer);
        well.setThreshold(address(USDS), IWishingWell.Direction.Sell, 20);
        well.setMinQuorumDuration(address(USDS), IWishingWell.Direction.Sell, 1 days);
        well.setBuyPaymentAsset(address(USDS), address(0));
        well.setComplianceCheck(address(complianceCheck));
        well.setExcluded(address(USDS), bob, true);

        setSupported(address(TGLD), true);
        setSupported(address(USDS), true);
        deal(address(USDS), alice, 100e18, false);
        sell(alice, 100, 1 days);
        vm.startPrank(alice);
        well.revokeWish(address(USDS));

        vm.startPrank(rescuer);
        well.setRescueMode(false);
        vm.startPrank(executor);
        well.setThreshold(address(USDS), IWishingWell.Direction.Sell, 30);
    }

    function test_quorum_defaults_and_independent_directions_and_tokens() public {
        assertEq(well.threshold(address(USDS), IWishingWell.Direction.Sell), 0);
        assertEq(well.threshold(address(USDS), IWishingWell.Direction.Buy), 0);
        assertEq(well.minQuorumDuration(address(USDS), IWishingWell.Direction.Sell), 3 days);
        assertEq(well.minQuorumDuration(address(USDS), IWishingWell.Direction.Buy), 3 days);
        
        setSupported(address(TGLD), true);
        setSupported(address(USDS), true);
        deal(address(USDS), alice, 100e18, false);
        sell(alice, 100, 1 days);
        assertEq(well.threshold(address(USDS), IWishingWell.Direction.Sell), 0);
        vm.startPrank(executor);
        well.setThreshold(address(USDS), IWishingWell.Direction.Sell, 50);
        well.setMinQuorumDuration(address(USDS), IWishingWell.Direction.Sell, 1 hours);
        
        assertEq(well.threshold(address(USDS), IWishingWell.Direction.Sell), 50);
        assertEq(well.threshold(address(USDS), IWishingWell.Direction.Buy), 0);
        assertEq(well.threshold(address(TGLD), IWishingWell.Direction.Sell), 0);
        assertEq(well.minQuorumDuration(address(USDS), IWishingWell.Direction.Buy), 3 days);
        assertEq(well.minQuorumDuration(address(TGLD), IWishingWell.Direction.Sell), 3 days);
    }

    function test_quorum_duration_bounds_and_zero_threshold_reset() public {
        vm.startPrank(executor);
        well.setMinQuorumDuration(address(USDS), IWishingWell.Direction.Buy, 1 hours);
        well.setMinQuorumDuration(address(USDS), IWishingWell.Direction.Buy, 30 days);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        well.setMinQuorumDuration(address(USDS), IWishingWell.Direction.Buy, 0);

        vm.expectRevert(abi.encodeWithSelector(IWishingWell.InvalidQuorumDuration.selector));
        well.setMinQuorumDuration(address(USDS), IWishingWell.Direction.Buy, 1 hours - 1);

        vm.expectRevert(abi.encodeWithSelector(IWishingWell.InvalidQuorumDuration.selector));
        well.setMinQuorumDuration(address(USDS), IWishingWell.Direction.Buy, 30 days + 1);

        well.setThreshold(address(USDS), IWishingWell.Direction.Buy, type(uint256).max);
        well.setThreshold(address(USDS), IWishingWell.Direction.Buy, 0);

        assertEq(well.minQuorumDuration(address(USDS), IWishingWell.Direction.Buy), 30 days);
        assertEq(well.threshold(address(USDS), IWishingWell.Direction.Buy), 0);
    }

    function test_configuration_events_and_no_wish_mutation() public {
        setSupported(address(TGLD), true);
        setSupported(address(USDS), true);
        deal(address(USDS), alice, 100e18, false);
        sell(alice, 100, 1 days);

        vm.startPrank(executor);
        vm.expectEmit(address(well));
        emit IWishingWell.ThresholdSet(address(USDS), IWishingWell.Direction.Sell, 20);
        well.setThreshold(address(USDS), IWishingWell.Direction.Sell, 20);

        vm.expectEmit(address(well));
        emit IWishingWell.MinQuorumDurationSet(address(USDS), IWishingWell.Direction.Sell, 1 days);
        well.setMinQuorumDuration(address(USDS), IWishingWell.Direction.Sell, 1 days);

        vm.expectEmit(address(well));
        emit IWishingWell.BuyPaymentAssetSet(address(USDS), address(0));
        well.setBuyPaymentAsset(address(USDS), address(0));

        vm.expectEmit(address(well));
        emit IWishingWell.ComplianceCheckSet(address(complianceCheck));
        well.setComplianceCheck(address(complianceCheck));
    
        assertEq(well.nonces(alice), 1);
        assertEq(well.getWish(alice, address(USDS)).amount, 100);
        assertEq(stated(), 100);
    }

    function test_changing_buy_asset_does_not_silently_change_threshodl_settings() public {
        vm.startPrank(executor);
        well.setThreshold(address(USDS), IWishingWell.Direction.Buy, 200);
        well.setMinQuorumDuration(address(USDS), IWishingWell.Direction.Buy, 5 days);
        well.setBuyPaymentAsset(address(USDS), address(0));

        assertEq(well.threshold(address(USDS), IWishingWell.Direction.Buy), 200);
        assertEq(well.minQuorumDuration(address(USDS), IWishingWell.Direction.Buy), 5 days);
    }
}

contract WishingWellSellTest is WishingWellTestBase {
    function test_sell_2500_tgld_for_usds() public {
        setSupported(address(TGLD), true);
        setSupported(address(USDS), true);
       
        deal(address(TGLD), alice, 3000e18, false);

        // Alice wants a future USDS-funded auction. A Sell wish records TGLD only;
        vm.startPrank(alice);
        vm.expectEmit(address(well));
        emit WishSet(
            alice,
            address(TGLD),
            address(TGLD),
            IWishingWell.Direction.Sell,
            2_500 ether,
            uint64(block.timestamp + 30 days),
            0
        );
        well.setWish(address(TGLD), IWishingWell.Direction.Sell, address(TGLD), 2_500 ether, 30 days);

        IWishingWell.Wish memory wish = well.getWish(alice, address(TGLD));
        assertEq(wish.amountAsset, address(TGLD));
        assertEq(wish.amount, 2_500 ether);
        assertEq(uint256(wish.direction), uint256(IWishingWell.Direction.Sell));
        assertEq(well.activeAmount(alice, address(TGLD), IWishingWell.Direction.Sell, address(TGLD)), 2_500 ether);
        assertEq(well.totalStated(address(TGLD), IWishingWell.Direction.Sell, address(TGLD)), 2_500 ether);
        assertEq(well.activeAmount(alice, address(TGLD), IWishingWell.Direction.Sell, address(USDS)), 0);
        assertEq(TGLD.balanceOf(alice), 3_000 ether);
        assertEq(TGLD.balanceOf(address(well)), 0);
        assertEq(USDS.balanceOf(alice), 0);
    }

    function test_sell_1000_temple_for_usds() public {
        setSupported(address(TEMPLE_TOKEN), true);
        setSupported(address(USDS), true);
       
        deal(address(TEMPLE_TOKEN), alice, 1200e18, false);

        // USDS is the intended target. The Sell amount is 1000 TEMPLE.
        vm.startPrank(alice);
        well.setWish(address(TEMPLE_TOKEN), IWishingWell.Direction.Sell, address(TEMPLE_TOKEN), 1_000 ether, 14 days);

        IWishingWell.Wish memory wish = well.getWish(alice, address(TEMPLE_TOKEN));
        assertEq(wish.amountAsset, address(TEMPLE_TOKEN));
        assertEq(wish.amount, 1_000 ether);
        assertEq(uint256(wish.direction), uint256(IWishingWell.Direction.Sell));
        assertEq(
            well.activeAmount(alice, address(TEMPLE_TOKEN), IWishingWell.Direction.Sell, address(TEMPLE_TOKEN)),
            1_000 ether
        );
        assertEq(
            well.totalStated(address(TEMPLE_TOKEN), IWishingWell.Direction.Sell, address(TEMPLE_TOKEN)), 1_000 ether
        );
        assertEq(TEMPLE_TOKEN.balanceOf(alice), 1_200 ether);
        assertEq(TEMPLE_TOKEN.balanceOf(address(well)), 0);
        assertEq(USDS.balanceOf(alice), 0);
    }

    function test_sell_same_user_sells_tgld_and_temple_independently() public {
        setSupported(address(TEMPLE_TOKEN), true);
        setSupported(address(USDS), true);
        setSupported(address(TGLD), true);
       
        deal(address(TEMPLE_TOKEN), alice, 1000e18, false);
        deal(address(TGLD), alice, 2500e18, false);

        vm.startPrank(alice);
        well.setWish(address(TGLD), IWishingWell.Direction.Sell, address(TGLD), 2_500 ether, 30 days);
        well.setWish(address(TEMPLE_TOKEN), IWishingWell.Direction.Sell, address(TEMPLE_TOKEN), 1_000 ether, 30 days);
        well.revokeWish(address(TGLD));

        assertEq(well.totalStated(address(TGLD), IWishingWell.Direction.Sell, address(TGLD)), 0);
        assertEq(
            well.totalStated(address(TEMPLE_TOKEN), IWishingWell.Direction.Sell, address(TEMPLE_TOKEN)), 1_000 ether
        );
        assertEq(well.getWish(alice, address(TEMPLE_TOKEN)).amount, 1_000 ether);
        assertEq(well.nonces(alice), 3);
    }

    function test_sell_two_accounts_offer_4000_usds_for_temple() public {
        setSupported(address(TEMPLE_TOKEN), true);
        setSupported(address(USDS), true);
       
        deal(address(USDS), alice, 1500e18, false);
        deal(address(USDS), bob, 2500e18, false);

        setBuyPaymentAsset(address(TEMPLE_TOKEN), address(USDS));

        vm.startPrank(alice);
        well.setWish(address(TEMPLE_TOKEN), IWishingWell.Direction.Buy, address(USDS), 1_500 ether, 30 days);

        vm.startPrank(bob);
        well.setWish(address(TEMPLE_TOKEN), IWishingWell.Direction.Buy, address(USDS), 2_500 ether, 30 days);

        address[] memory accounts = new address[](2);
        accounts[0] = bob;
        accounts[1] = alice;

        assertEq(
            well.totalForAccounts(address(TEMPLE_TOKEN), IWishingWell.Direction.Buy, address(USDS), accounts),
            4_000 ether
        );
        assertEq(well.totalStated(address(TEMPLE_TOKEN), IWishingWell.Direction.Buy, address(USDS)), 4_000 ether);

        // Alice spends 1,000 USDS elsewhere but stored on-chain demand stays unchanged.
        uint256 toSpend = 1000e18;
        vm.startPrank(alice);
        USDS.transfer(operator, toSpend);
        assertEq(well.activeAmount(alice, address(TEMPLE_TOKEN), IWishingWell.Direction.Buy, address(USDS)), 500 ether);
        assertEq(
            well.totalForAccounts(address(TEMPLE_TOKEN), IWishingWell.Direction.Buy, address(USDS), accounts),
            3_000 ether
        );
        assertEq(well.totalStated(address(TEMPLE_TOKEN), IWishingWell.Direction.Buy, address(USDS)), 4_000 ether);
    }

    function test_sell_reduce_usds_for_temple_wish_then_revoke() public {
        setSupported(address(TEMPLE_TOKEN), true);
        setSupported(address(USDS), true);
       
        deal(address(USDS), alice, 1500e18, false);
        setBuyPaymentAsset(address(TEMPLE_TOKEN), address(USDS));

        vm.startPrank(alice);
        well.setWish(address(TEMPLE_TOKEN), IWishingWell.Direction.Buy, address(USDS), 1_500 ether, 30 days);
        // Reduce
        well.setWish(address(TEMPLE_TOKEN), IWishingWell.Direction.Buy, address(USDS), 600 ether, 7 days);

        assertEq(well.totalStated(address(TEMPLE_TOKEN), IWishingWell.Direction.Buy, address(USDS)), 600 ether);
        assertEq(well.activeAmount(alice, address(TEMPLE_TOKEN), IWishingWell.Direction.Buy, address(USDS)), 600 ether);

        vm.startPrank(alice);
        well.revokeWish(address(TEMPLE_TOKEN));
        vm.stopPrank();

        assertEq(well.totalStated(address(TEMPLE_TOKEN), IWishingWell.Direction.Buy, address(USDS)), 0);
        assertEq(well.getWish(alice, address(TEMPLE_TOKEN)).amount, 0);
        assertEq(well.nonces(alice), 3);
        assertEq(USDS.balanceOf(alice), 1_500 ether);
    }
}

contract WishingWellTest is WishingWellTestBase {

    function test_set_replace_and_expiry_boundary() public {
        addSupportedAndDeal(100);

        sell(alice, 100, 10);
        assertEq(active(alice), 100);
        skip(5);
        sell(alice, 40, 20);
        assertEq(active(alice), 40);
        skip(5);
        assertEq(active(alice), 40);
        skip(15);
        assertEq(active(alice), 0);
        assertEq(well.getWish(alice, address(USDS)).amount, 40); // history retained; no expiry transaction
    }

    function test_replacement_across_directions_and_assets() public {
        addSupportedAndDeal(1e18);
        setBuyPaymentAsset(address(USDS), address(TGLD));

        sell(alice, 100, 100);
        vm.prank(alice);
        well.setWish(address(USDS), IWishingWell.Direction.Buy, address(TGLD), 400, 100);
        assertEq(active(alice), 0);
        assertEq(well.activeAmount(alice, address(USDS), IWishingWell.Direction.Buy, address(TGLD)), 400);
        assertEq(well.activeAmount(alice, address(USDS), IWishingWell.Direction.Buy, address(201)), 0);
    }

    function test_independent_tokens_and_accounts() public {
        addSupportedAndDeal(1e18);
        setBuyPaymentAsset(address(USDS), address(TGLD));

        sell(alice, 100, 100);
        sell(bob, 50, 100);

        vm.startPrank(alice);
        well.setWish(address(TGLD), IWishingWell.Direction.Sell, address(TGLD), 400, 100);

        assertEq(active(alice), 100);
        assertEq(active(bob), 50);
        assertEq(well.getWish(alice, address(TGLD)).amount, 400);
    }

    function test_revocation_only_affects_caller() public {
        addSupportedAndDeal(1e18);

        sell(alice, 100, 100);
        sell(bob, 50, 100);
        vm.prank(bob);
        well.revokeWish(address(USDS));
        assertEq(active(alice), 100);
        assertEq(active(bob), 0);
    }

    function test_exclusion_and_restoration() public {
        addSupportedAndDeal(1e18);
        
        sell(alice, 100, 100);
        vm.startPrank(executor);
        well.setExcluded(address(USDS), alice, true);
        assertEq(active(alice), 0);

        sell(alice, 200, 100);
        assertEq(active(alice), 0); // cannot evade by replacement

        vm.startPrank(executor);
        well.setExcluded(address(USDS), alice, false);
        assertEq(active(alice), 200);

        well.setExcluded(address(TGLD), alice, true);
        assertEq(active(alice), 200);
    }

    function test_excluded_user_can_revoke() public {
        addSupportedAndDeal(1e18);

        sell(alice, 100, 100);

        vm.startPrank(executor);
        well.setExcluded(address(USDS), alice, true);

        vm.startPrank(alice);
        well.revokeWish(address(USDS));
        assertEq(well.getWish(alice, address(USDS)).amount, 0);
    }

    function test_restoration_does_not_revive_expired_wish() public {
        addSupportedAndDeal(1e18);

        sell(alice, 100, 10);

        vm.startPrank(executor);
        well.setExcluded(address(USDS), alice, true);
        skip(10);
        well.setExcluded(address(USDS), alice, false);
        assertEq(active(alice), 0);
    }

    function test_set_wish_zero_amount() public {
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        well.setWish(address(USDS), IWishingWell.Direction.Sell, address(USDS), 0, 10);
    }

    function test_set_wish_zero_duration() public {
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        well.setWish(address(USDS), IWishingWell.Direction.Sell, address(USDS), 1, 0);
    }

    function test_set_wish_sell_asset_not_target() public {
        addSupportedAndDeal(1e18);

        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(IWishingWell.InvalidWish.selector));
        well.setWish(address(USDS), IWishingWell.Direction.Sell, address(TGLD), 1, 10);
        vm.stopPrank();
    }

    function test_set_wish_buy_asset_equal_target() public {
        addSupportedAndDeal(1e18);

        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(IWishingWell.InvalidWish.selector));
        well.setWish(address(USDS), IWishingWell.Direction.Buy, address(USDS), 1, 10);
        vm.stopPrank();
    }

    function test_set_wish_invalid_target() public {
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        well.setWish(address(0), IWishingWell.Direction.Sell, address(USDS), 1, 10);
    }

    function test_set_wish_invalid_address() public {
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        well.setWish(address(USDS), IWishingWell.Direction.Buy, address(0), 100, 10);
    }

     function test_set_wish_invalid_wish_fields_non_zeros() public {
        vm.expectRevert(CommonEventsAndErrors.ExpectedNonZero.selector);
        well.setWish(address(USDS), IWishingWell.Direction.Sell, address(USDS), 0, 10);
        vm.expectRevert(CommonEventsAndErrors.ExpectedNonZero.selector);
        well.setWish(address(USDS), IWishingWell.Direction.Sell, address(USDS), 1, 0);
    }

    function test_total_filters_expiry_and_rejects_unsorted_accounts() public {
        addSupportedAndDeal(1e18);

        sell(alice, 100, 10);
        sell(bob, 50, 20);
        // bob < alice
        address[] memory accounts = new address[](2);
        accounts[0] = alice;
        accounts[1] = bob;
        vm.expectRevert(IWishingWell.InvalidAccountList.selector);
        well.totalForAccounts(address(USDS), IWishingWell.Direction.Sell, address(USDS), accounts);

        // correct order
        accounts[0] = accounts[1];
        accounts[1] = alice;
        well.totalForAccounts(address(USDS), IWishingWell.Direction.Sell, address(USDS), accounts);
    }

    function test_total_filters_expiry_and_rejects_duplicate_accounts() public {
        addSupportedAndDeal(1e18);

        sell(alice, 100, 10);
        sell(bob, 50, 20);
        address[] memory accounts = new address[](2);
        accounts[0] = bob;
        accounts[1] = alice;
        assertEq(well.totalForAccounts(address(USDS), IWishingWell.Direction.Sell, address(USDS), accounts), 150);
        vm.warp(1010);
        assertEq(well.totalForAccounts(address(USDS), IWishingWell.Direction.Sell, address(USDS), accounts), 50);
        accounts[1] = bob;
        vm.expectRevert(IWishingWell.InvalidAccountList.selector);
        well.totalForAccounts(address(USDS), IWishingWell.Direction.Sell, address(USDS), accounts);
    }

    function test_total_for_accounts_empty_list() public {
        address[] memory accounts = new address[](0);
        // empty list, returns 0
        uint256 total = well.totalForAccounts(address(USDS), IWishingWell.Direction.Sell, address(USDS), accounts);
        assertEq(total, 0);
    }

    function test_total_for_accounts_list_with_zero_address() public {
        address[] memory accounts = new address[](2);
        accounts[0] = address(0);
        accounts[1] = bob;
        vm.expectRevert(IWishingWell.InvalidAccountList.selector);
        well.totalForAccounts(address(USDS), IWishingWell.Direction.Sell, address(USDS), accounts);
    }

    function test_total_for_accounts_oversize_lists() public {
        address[] memory accounts = new address[](101);
        vm.expectRevert(IWishingWell.InvalidAccountList.selector);
        well.totalForAccounts(address(USDS), IWishingWell.Direction.Sell, address(USDS), accounts);
    }

    function test_wish_by_signature_invalid_account() public {
        IWishingWell.SignedWish memory wish = signedWish();
        wish.account = address(0);
        bytes memory sig = sign(wish);
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        well.setWishBySignature(wish, sig);
    }

    function test_set_wish_by_signature_duration_over_maximum() public {
        IWishingWell.SignedWish memory wish = signedWish();
        wish.expiresAt = uint64(block.timestamp + uint256(well.MAX_WISH_DURATION()) + 1);

        bytes memory signature = sign(wish);

        vm.expectRevert(abi.encodeWithSelector(IWishingWell.InvalidWish.selector));
        well.setWishBySignature(wish, signature);

        assertEq(well.nonces(wish.account), wish.nonce);
    }

    function test_set_wish_blocked_account() public {
        addSupportedAndDeal(1e18);
        complianceCheck.setBlocked(alice, true);

        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(IWishingWell.BlockedAccount.selector, alice));
        well.setWish(address(USDS), IWishingWell.Direction.Sell, address(USDS), 100, 1 days);

        assertEq(well.nonces(alice), 0);
        assertEq(well.getWish(alice, address(USDS)).amount, 0);
    }

    function test_set_wish_amount_exceeds_balance() public {
        addSupportedAndDeal(100);

        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(IWishingWell.InsufficientWishBalance.selector));
        well.setWish(address(USDS), IWishingWell.Direction.Sell, address(USDS), 101, 1 days);

        assertEq(well.nonces(alice), 0);
        assertEq(well.getWish(alice, address(USDS)).amount, 0);
    }

    function test_set_wish_by_signature_signed_wish_and_replay() public {
        addSupportedAndDeal(1e18);

        deal(address(USDS), address(vm.addr(key)), 1e18, false);
        deal(address(TGLD), address(vm.addr(key)), 1e18, false);
        IWishingWell.SignedWish memory wish = signedWish();
        bytes memory sig = sign(wish);
        emit log_string("Address check");
        emit log_address(address(this));
        vm.startPrank(bob);
        well.setWishBySignature(wish, sig);
        assertEq(active(vm.addr(key)), 100);
        vm.expectRevert(IWishingWell.InvalidNonce.selector);
        well.setWishBySignature(wish, sig);
    }

    function test_set_wish_by_signature_revoke_invalidates_unsubmitted_signature() public {
        IWishingWell.SignedWish memory wish = signedWish();
        bytes memory sig = sign(wish);
        vm.prank(wish.account);
        well.revokeWish(address(USDS));
        vm.expectRevert(IWishingWell.InvalidNonce.selector);
        well.setWishBySignature(wish, sig);
    }

    function test_set_wish_by_signature_direct_replacement_invalidates_signature() public {
        addSupportedAndDeal(1e18);
        deal(address(USDS), address(vm.addr(key)), 1e18, false);

        IWishingWell.SignedWish memory wish = signedWish();
        bytes memory sig = sign(wish);
        sell(wish.account, 5, 100);
        vm.expectRevert(IWishingWell.InvalidNonce.selector);
        well.setWishBySignature(wish, sig);
    }

    function test_set_wish_by_signature_tampering_and_wrong_signer() public {
        addSupportedAndDeal(1e18);

        IWishingWell.SignedWish memory wish = signedWish();
        bytes memory sig = sign(wish);
        wish.amount = 101;
        vm.expectRevert(IWishingWell.InvalidSignature.selector);
        well.setWishBySignature(wish, sig);
        wish.amount = 100;
        wish.account = bob;
        vm.expectRevert(IWishingWell.InvalidSignature.selector);
        well.setWishBySignature(wish, sig);
        emit log_address(address(this));
    }

    function test_set_wish_by_signature_deadline_boundary() public {
        addSupportedAndDeal(1e18);

        IWishingWell.SignedWish memory wish = signedWish();
        bytes memory sig = sign(wish);
        vm.warp(wish.submissionDeadline);
        vm.expectRevert(IWishingWell.SignatureExpired.selector);
        well.setWishBySignature(wish, sig);
    }

    function test_set_wish_by_signature_relay_does_not_extend_expiry() public {
        addSupportedAndDeal(1e18);
        deal(address(USDS), address(vm.addr(key)), 1e18, false);

        IWishingWell.SignedWish memory wish = signedWish();
        bytes memory sig = sign(wish);
        vm.warp(block.timestamp + 1 hours);
        well.setWishBySignature(wish, sig);
        assertEq(well.getWish(wish.account, address(USDS)).expiresAt, wish.expiresAt);
    }

    function test_set_wish_by_signature_cross_contract_and_chain_replay_rejected() public {
        addSupportedAndDeal(1e18);

        IWishingWell.SignedWish memory wish = signedWish();
        bytes memory sig = sign(wish);
        WishingWell other = new WishingWell(executor, operator, address(tokenRegistry),
            address(complianceCheck), WELL_NAME, WELL_VERSION);
        vm.expectRevert(IWishingWell.InvalidSignature.selector);
        other.setWishBySignature(wish, sig);
        vm.chainId(block.chainid + 1);
        vm.expectRevert(IWishingWell.InvalidSignature.selector);
        well.setWishBySignature(wish, sig);
    }

    function test_set_wish_by_signature_contract_wallet_signature() public {
        addSupportedAndDeal(1e18);

        MockWallet wallet = new MockWallet();
        deal(address(USDS), address(wallet), 1e18, false);
        IWishingWell.SignedWish memory wish = signedWish();
        wish.account = address(wallet);
        wallet.approve(well.wishDigest(wish));
        well.setWishBySignature(wish, hex"1234");
        assertEq(active(address(wallet)), 100);
    }

     function test_set_wish_by_signature_competing_signatures_at_same_nonce_first_wins() public {
        addSupportedAndDeal(1e18);
        deal(address(USDS), address(vm.addr(key)), 1e18, false);
        
        IWishingWell.SignedWish memory first = signedWish();
        IWishingWell.SignedWish memory second = signedWish();
        second.amount = 200;
        bytes memory secondSig = sign(second);
        well.setWishBySignature(first, sign(first));
        vm.expectRevert(IWishingWell.InvalidNonce.selector);
        well.setWishBySignature(second, secondSig);
        assertEq(active(first.account), 100);
        assertEq(well.nonces(first.account), 1);
    }

    function test_set_wish_by_signature_reject_invalid_contract_wallet_signature() public {
        IWishingWell.SignedWish memory wish = signedWish();
        wish.account = address(new MockWallet());
        vm.expectRevert(IWishingWell.InvalidSignature.selector);
        well.setWishBySignature(wish, hex"1234");
    }

    function test_reject_ether() public {
        vm.deal(address(this), 1 ether);
        (bool success,) = address(well).call{value: 1}("");
        assertFalse(success);
    }

    function test_one_second_wish_and_renewal_after_expiry() public {
        addSupportedAndDeal(1e18);
        sell(alice, 100, 1);

        assertEq(active(alice), 100);
        skip(1);
        assertEq(active(alice), 0);

        sell(alice, 25, 1);
        assertEq(active(alice), 25);
        assertEq(well.nonces(alice), 2);
        skip(1);
        assertEq(active(alice), 0);
    }

    function test_exclude_unexclude_does_not_restore_revoked_wish() public {
        addSupportedAndDeal(1e18);
        sell(alice, 100, 100);

        vm.startPrank(executor);
        well.setExcluded(address(USDS), alice, true);
        vm.startPrank(alice);
        well.revokeWish(address(USDS));
        vm.startPrank(executor);
        well.setExcluded(address(USDS), alice, false);

        assertEq(active(alice), 0);
        assertEq(well.getWish(alice, address(USDS)).amount, 0);
    }

    function test_set_excluded_signed_wish_cannot_bypass_exclusion() public {
        addSupportedAndDeal(1e18);
        deal(address(USDS), address(vm.addr(key)), 1e18, false);

        IWishingWell.SignedWish memory wish = signedWish();
        vm.startPrank(executor);
        well.setExcluded(address(USDS), wish.account, true);
        well.setWishBySignature(wish, sign(wish));

        assertEq(active(wish.account), 0);
        assertEq(well.getWish(wish.account, address(USDS)).amount, 100);

        well.setExcluded(address(USDS), wish.account, false);
        assertEq(active(wish.account), 100);
    }

    function test_set_wish_by_signature_failed_signature_preserves_existing_wish() public {
        addSupportedAndDeal(1e18);
        deal(address(USDS), address(vm.addr(key)), 1e18, false);

        IWishingWell.SignedWish memory wish = signedWish();
        sell(wish.account, 75, 100);
        wish.nonce = 1;
        bytes memory sig = sign(wish);
        wish.amount = 200;
        vm.expectRevert(IWishingWell.InvalidSignature.selector);
        well.setWishBySignature(wish, sig);

        assertEq(active(wish.account), 75);
        assertEq(well.nonces(wish.account), 1);
        assertEq(well.getWish(wish.account, address(USDS)).expiresAt, 1100);
    }

    function test_set_wish_by_signature_submission_immediately_before_deadline_and_expiry() public {
        addSupportedAndDeal(1e18);
        deal(address(USDS), address(vm.addr(key)), 1e18, false);

        IWishingWell.SignedWish memory wish = signedWish();
        wish.submissionDeadline = wish.expiresAt;
        bytes memory sig = sign(wish);
        vm.warp(uint256(wish.expiresAt) - 1);
        well.setWishBySignature(wish, sig);
        assertEq(active(wish.account), 100);
        vm.warp(wish.expiresAt);
        assertEq(active(wish.account), 0);
    }

    function test_set_wish_by_signature_expired_signed_wish() public {
        addSupportedAndDeal(1e18);
        deal(address(USDS), address(vm.addr(key)), 1e18, false);

        IWishingWell.SignedWish memory wish = signedWish();
        wish.submissionDeadline = wish.expiresAt;
        bytes memory sig = sign(wish);
        vm.warp(wish.expiresAt);
        vm.expectRevert(IWishingWell.SignatureExpired.selector);
        well.setWishBySignature(wish, sig);
        assertEq(well.nonces(wish.account), 0);
    }

    function test_set_wish_by_signature_reverting_contract_wallets_rejected() public {
        addSupportedAndDeal(1e18);
        deal(address(USDS), address(vm.addr(key)), 1e18, false);

        IWishingWell.SignedWish memory wish = signedWish();
        wish.account = address(new RevertingWallet());
        vm.expectRevert(IWishingWell.InvalidSignature.selector);
        well.setWishBySignature(wish, hex"1234");
        assertEq(well.nonces(wish.account), 0);
    }

    function test_set_wish_by_signature_signed_invalid_target_address() public {
        IWishingWell.SignedWish memory wish = signedWish();
        wish.targetToken = address(0);
        bytes memory sig = sign(wish);
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        well.setWishBySignature(wish, sig);
    }

    function test_set_wish_by_signature_signed_invalid_asset_address() public {
        IWishingWell.SignedWish memory wish = signedWish();
        wish.amountAsset = address(0);
        bytes memory sig = sign(wish);
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        well.setWishBySignature(wish, sig);
        wish = signedWish();
    }

    function test_set_wish_buy_amounts_never_mixed_across_payment_assets() public {
        addSupportedAndDeal(1e18);
        setSupported(address(TEMPLE_TOKEN), true);

        // deal(address(TGLD), alice, 1e18, false);
        deal(address(TEMPLE_TOKEN), bob, 1e18, false);

        // Each target token supports one current Buy payment asse
        setBuyPaymentAsset(address(USDS), address(TGLD));

        vm.startPrank(alice);
        well.setWish(address(USDS), IWishingWell.Direction.Buy, address(TGLD), 100, 100);
        vm.stopPrank();

        setBuyPaymentAsset(address(USDS), address(TEMPLE_TOKEN));

        vm.startPrank(bob);
        well.setWish(address(USDS), IWishingWell.Direction.Buy, address(TEMPLE_TOKEN), 200, 100);
        vm.stopPrank();

        address[] memory accounts = new address[](2);
        accounts[0] = uint160(alice) < uint160(bob) ? alice : bob;
        accounts[1] = uint160(alice) < uint160(bob) ? bob : alice;

        // The previous payment asset no longer contributes.
        assertEq(
            well.totalForAccounts(address(USDS), IWishingWell.Direction.Buy, address(TGLD), accounts),
            0
        );
        assertEq(
            well.totalForAccounts(address(USDS), IWishingWell.Direction.Buy, address(TEMPLE_TOKEN), accounts),
            200
        );

        // Alice's original wish remains stored.
        assertEq(well.getWish(alice, address(USDS)).amount, 100);

        // Restoring TGLD makes Alice's unexpired wish count again.
        setBuyPaymentAsset(address(USDS), address(TGLD));

        assertEq(
            well.totalForAccounts(address(USDS), IWishingWell.Direction.Buy, address(TGLD), accounts),
            100
        );
        assertEq(
            well.totalForAccounts(address(USDS), IWishingWell.Direction.Buy, address(TEMPLE_TOKEN), accounts),
            0
        );
    }

    function test_set_wish_by_signature_repeated_revoke_invalidates_pending_signatures() public {
        addSupportedAndDeal(1e18);

        IWishingWell.SignedWish memory wish = signedWish();
        vm.startPrank(wish.account);
        well.revokeWish(address(USDS));
        wish.nonce = 1;
        bytes memory sig = sign(wish);

        vm.startPrank(wish.account);
        well.revokeWish(address(USDS));
        vm.expectRevert(IWishingWell.InvalidNonce.selector);
        well.setWishBySignature(wish, sig);
        assertEq(well.nonces(wish.account), 2);
    }

    function test_total_for_accounts_timeline() public {
        addSupportedAndDeal(1e18);
        deal(address(USDS), operator, 1e18, false);

        uint256 start = block.timestamp;
        address[] memory accounts = new address[](3);
        accounts[0] = bob;
        accounts[1] = alice;
        accounts[2] = operator;
        sell(alice, 100, 30 days);
        assertEq(well.totalForAccounts(address(USDS), IWishingWell.Direction.Sell, address(USDS), accounts), 100);
        skip(15 days);
        sell(bob, 500, 60 days);
        assertEq(well.totalForAccounts(address(USDS), IWishingWell.Direction.Sell, address(USDS), accounts), 600);
        skip(15 days);
        assertEq(well.totalForAccounts(address(USDS), IWishingWell.Direction.Sell, address(USDS), accounts), 500);
        skip(20 days);
        sell(operator, 200, 30 days);
        assertEq(well.totalForAccounts(address(USDS), IWishingWell.Direction.Sell, address(USDS), accounts), 700);
        skip(10 days);
        sell(bob, 400, 30 days);
        assertEq(well.totalForAccounts(address(USDS), IWishingWell.Direction.Sell, address(USDS), accounts), 600);
        skip(20 days);
        assertEq(well.totalForAccounts(address(USDS), IWishingWell.Direction.Sell, address(USDS), accounts), 400);
        skip(10 days);
        assertEq(well.totalForAccounts(address(USDS), IWishingWell.Direction.Sell, address(USDS), accounts), 0);
    }

    function test_events_identify_replacements_and_consumed_nonce() public {
        addSupportedAndDeal(1e18);

        vm.expectEmit(true, true, true, true, address(well));
        emit WishSet(alice, address(USDS), address(USDS), IWishingWell.Direction.Sell, 100, 1100, 0);
        sell(alice, 100, 100);
        vm.expectEmit(true, true, true, true, address(well));
        emit WishSet(alice, address(USDS), address(USDS), IWishingWell.Direction.Sell, 50, 1200, 1);
        sell(alice, 50, 200);
        vm.expectEmit(true, true, false, true, address(well));
        emit WishRevoked(alice, address(USDS), 2);
        vm.prank(alice);
        well.revokeWish(address(USDS));
        assertEq(well.nonces(alice), 3);
    }

    function test_exclusion_event_and_no_nonce_change() public {
        addSupportedAndDeal(1e18);

        sell(alice, 100, 100);
        vm.expectEmit(true, true, false, true, address(well));
        emit ExclusionSet(address(USDS), alice, true);
        vm.startPrank(executor);
        well.setExcluded(address(USDS), alice, true);
        assertEq(well.nonces(alice), 1);
        assertEq(well.getWish(alice, address(USDS)).amount, 100);
    }

    function test_maximum_batch_and_amounts_do_not_overflow() public {
        addSupportedAndDeal(1e18);

        // 100 as MAX_ACCOUNTS
        address[] memory accounts = new address[](well.MAX_ACCOUNTS());
        address account;
        for (uint256 i; i < accounts.length; ++i) {
            account = accounts[i] = address(uint160(1000 + i));
            deal(address(USDS), account, type(uint128).max, false);
            sell(account, type(uint128).max, 100);
        }
        assertEq(
            well.totalForAccounts(address(USDS), IWishingWell.Direction.Sell, address(USDS), accounts),
            uint256(type(uint128).max) * accounts.length
        );
    }

    function test_set_wish_expiry_overflow_rejected_without_replacing_wish() public {
        addSupportedAndDeal(100);

        sell(alice, 100, 100);
        vm.prank(alice);
        vm.expectRevert(IWishingWell.InvalidWish.selector);
        well.setWish(address(USDS), IWishingWell.Direction.Sell, address(USDS), 200, type(uint64).max);
        assertEq(active(alice), 100);
        assertEq(well.nonces(alice), 1);
    }

    function test_revoke_wish_invalid_address() public {
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        well.revokeWish(address(0));
    }


    function test_set_excluded_invalid_address() public {
        vm.startPrank(executor);
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        well.setExcluded(address(0), alice, true);
        vm.expectRevert(CommonEventsAndErrors.InvalidAddress.selector);
        well.setExcluded(address(USDS), address(0), true);
    }

    function test_typed_digest_matches_independent_encoding() public {
        addSupportedAndDeal(100);

        IWishingWell.SignedWish memory wish = signedWish();
        bytes32 domain = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("Wishing Well"),
                keccak256("1.0"),
                block.chainid,
                address(well)
            )
        );
        bytes32 content = keccak256(
            abi.encode(
                keccak256(
                    "Wish(address account,address targetToken,address amountAsset,uint8 direction,uint128 amount,uint64 expiresAt,uint256 nonce,uint64 submissionDeadline)"
                ),
                wish.account,
                wish.targetToken,
                wish.amountAsset,
                uint8(wish.direction),
                wish.amount,
                wish.expiresAt,
                wish.nonce,
                wish.submissionDeadline
            )
        );
        assertEq(well.wishDigest(wish), keccak256(abi.encodePacked(hex"1901", domain, content)));
    }

    function test_set_wish_by_signature_signed_buy_and_sequential_nonce() public {
        addSupportedAndDeal(400);
        setBuyPaymentAsset(address(USDS), address(TGLD));
        deal(address(TGLD), vm.addr(key), type(uint128).max, false);

        IWishingWell.SignedWish memory wish = signedWish();
        wish.direction = IWishingWell.Direction.Buy;
        wish.amountAsset = address(TGLD);
        well.setWishBySignature(wish, sign(wish));
        wish.nonce = 1;
        wish.amount = 400;
        well.setWishBySignature(wish, sign(wish));
        assertEq(well.activeAmount(wish.account, address(USDS), IWishingWell.Direction.Buy, address(TGLD)), 400);
        assertEq(well.nonces(wish.account), 2);
    }

    function test_set_wish_by_signature_revoking_one_token_invalidates_another_token_signature() public {
        IWishingWell.SignedWish memory wish = signedWish();
        bytes memory sig = sign(wish);

        vm.startPrank(wish.account);
        well.revokeWish(address(TGLD));

        vm.expectRevert(abi.encodeWithSelector(IWishingWell.InvalidNonce.selector));
        well.setWishBySignature(wish, sig);
        vm.stopPrank();

        assertEq(well.nonces(wish.account), wish.nonce + 1);
    }

    function test_set_wish_by_signature_invalid_signed_wish_does_not_consume_nonce() public {
        addSupportedAndDeal(100);
        deal(address(USDS), vm.addr(key), type(uint128).max, false);

        IWishingWell.SignedWish memory wish = signedWish();
        wish.amount = 0;
        bytes memory sig = sign(wish);
        vm.expectRevert(CommonEventsAndErrors.ExpectedNonZero.selector);
        well.setWishBySignature(wish, sig);
        assertEq(well.nonces(wish.account), 0);
        wish.amount = 100;
        well.setWishBySignature(wish, sign(wish));
        assertEq(active(wish.account), 100);
    }

    function test_set_wish_by_signature_signed_deadline_beyond_wish_expiry_rejected() public {
        IWishingWell.SignedWish memory wish = signedWish();
        wish.submissionDeadline = wish.expiresAt + 1;
        bytes memory sig = sign(wish);
        vm.expectRevert(IWishingWell.InvalidWish.selector);
        well.setWishBySignature(wish, sig);
    }

    function test_set_wish_by_signatuer_malformed_signature() public {
        IWishingWell.SignedWish memory wish = signedWish();
        vm.expectRevert(IWishingWell.InvalidSignature.selector);
        well.setWishBySignature(wish, hex"1234");
        assertEq(well.nonces(wish.account), 0);
    }

    function test_set_wish_by_signature_revoked_contract_wallet_approval_rejected() public {
        MockWallet wallet = new MockWallet();
        IWishingWell.SignedWish memory wish = signedWish();
        wish.account = address(wallet);
        wallet.approve(well.wishDigest(wish));
        wallet.approve(bytes32(0));
        vm.expectRevert(IWishingWell.InvalidSignature.selector);
        well.setWishBySignature(wish, hex"1234");
    }

    function test_maximum_duration_and_largest_representable_expiry() public {
        addSupportedAndDeal(type(uint128).max);
        setBuyPaymentAsset(address(USDS), address(TGLD));

        // A maximum timestamp is valid only when the remaining duration is within one year.
        sell(alice, type(uint128).max, 365 days);
        assertEq(well.getWish(alice, address(USDS)).expiresAt, block.timestamp + 365 days);

        vm.warp(uint256(type(uint64).max) - 365 days);
        sell(alice, type(uint128).max, 365 days);
        assertEq(well.getWish(alice, address(USDS)).expiresAt, type(uint64).max);
        vm.warp(uint256(type(uint64).max) - 1);
        assertEq(active(alice), type(uint128).max);
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(IWishingWell.InvalidWish.selector));
        well.setWish(address(USDS), IWishingWell.Direction.Sell, address(USDS), 1, 2);
        
        vm.warp(type(uint64).max);
        assertEq(active(alice), 0);
    }

    function test_delist_and_relist_restores_existing_wish() public {
        addSupportedAndDeal(type(uint128).max);

        sell(alice, 100, 2 days);
        tokenRegistry.setSupported(address(USDS), false);
        assertEq(active(alice), 0);
        assertEq(stated(), 0);
        assertEq(well.getWish(alice, address(USDS)).amount, 100);
        tokenRegistry.setSupported(address(USDS), true);
        assertEq(active(alice), 100);
        assertEq(stated(), 100);
        tokenRegistry.setSupported(address(USDS), false);
        vm.startPrank(alice);
        well.revokeWish(address(USDS));

        tokenRegistry.setSupported(address(USDS), true);
        assertEq(stated(), 0);
    }

    function test_unsupported_buy_asset_rejects_and_suppresses_existing_demand() public {
        addSupportedAndDeal(100);
        setBuyPaymentAsset(address(USDS), address(TGLD));

        vm.startPrank(alice);
        well.setWish(address(USDS), IWishingWell.Direction.Buy, address(TGLD), 100, 2 days);

        tokenRegistry.setSupported(address(TGLD), false);
        assertEq(well.activeAmount(alice, address(USDS), IWishingWell.Direction.Buy, address(TGLD)), 0);
        assertEq(well.totalStated(address(USDS), IWishingWell.Direction.Buy, address(TGLD)), 0);
        vm.startPrank(bob);
        vm.expectRevert(abi.encodeWithSelector(IWishingWell.UnsupportedToken.selector, address(TGLD)));
        well.setWish(address(USDS), IWishingWell.Direction.Buy, address(TGLD), 100, 2 days);

        IWishingWell.SignedWish memory wish = signedWish();
        wish.direction = IWishingWell.Direction.Buy;
        wish.amountAsset = address(TGLD);
        bytes memory signature = sign(wish);
        vm.expectRevert(abi.encodeWithSelector(IWishingWell.UnsupportedToken.selector, address(TGLD)));
        well.setWishBySignature(wish, signature);
        tokenRegistry.setSupported(address(TGLD), true);
        assertEq(well.activeAmount(alice, address(USDS), IWishingWell.Direction.Buy, address(TGLD)), 100);
    }
}