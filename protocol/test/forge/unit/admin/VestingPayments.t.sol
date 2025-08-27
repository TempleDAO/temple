pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// (tests/forge/unit/templegold/VestingPayments.t.sol)

import { TempleGoldCommon } from "../templegold/TempleGoldCommon.t.sol";
import { VestingPayments } from "contracts/admin/VestingPayments.sol";
import { TempleGold } from "contracts/templegold/TempleGold.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";
import { ITempleGold } from "contracts/interfaces/templegold/ITempleGold.sol";
import { IVestingPayments } from "contracts/interfaces/admin/IVestingPayments.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { StableGoldAuction } from "contracts/templegold/StableGoldAuction.sol";
import { TempleGoldStaking } from "contracts/templegold/TempleGoldStaking.sol";

contract VestingPaymentsTestBase is TempleGoldCommon {
    event Revoked(bytes32 _id, address indexed _recipient, uint256 _unreleased, uint256 _totalVested);
    event Released(bytes32 _id, address indexed _recipient, uint256 _amount);
    event ScheduleCreated(
        bytes32 _id, address indexed _recipient, uint40 _start,
        uint40 _cliff, uint40 _duration, uint128 _amount
    );
    event RecipientChanged(bytes32 _vestingId, address indexed _oldRecipient, address indexed _recipient);
    event FundsOwnerSet(address indexed _fundsOwner);

    FakeERC20 public fakeToken;
    FakeERC20 public templeToken;
    TempleGold public templeGold;
    VestingPayments public vesting;
    StableGoldAuction public stableGoldAuction;
    TempleGoldStaking public staking;

    uint256 public arbitrumOneForkId;

    function setUp() public {
        arbitrumOneForkId = fork("arbitrum_one");
        ITempleGold.InitArgs memory initArgs = _getTempleGoldInitArgs();
        templeGold = new TempleGold(initArgs);
        fakeToken = new FakeERC20("Fake Token", "FAKE", executor, 1000 ether);
        templeToken = new FakeERC20("Temple Token", "TEMPLE", executor, 1000 ether);
        staking = new TempleGoldStaking(rescuer, executor, address(templeToken), address(templeGold));
        stableGoldAuction = new StableGoldAuction(
            address(templeGold),
            daiToken,
            treasury,
            rescuer,
            executor,
            executor
        );
        // teamGnosis is funds owner
        vesting = new VestingPayments(rescuer, executor, teamGnosis, address(templeGold));

        // configure TGLD
        vm.startPrank(executor);
        templeGold.setStableGoldAuction(address(stableGoldAuction));
        ITempleGold.DistributionParams memory params;
        params.auction = 60 ether;
        params.gnosis = 10 ether;
        params.staking = 30 ether;
        templeGold.setDistributionParams(params);
        ITempleGold.VestingFactor memory factor;
        factor.value = 35;
        factor.weekMultiplier = 1 weeks;
        templeGold.setVestingFactor(factor);
        templeGold.setStaking(address(staking));
        templeGold.setTeamGnosis(address(teamGnosis));
        // whitelist
        templeGold.authorizeContract(address(stableGoldAuction), true);
        templeGold.authorizeContract(address(staking), true);
        templeGold.authorizeContract(teamGnosis, true);
    }

    function test_initialization() public view {
        assertEq(vesting.executor(), executor);
        assertEq(vesting.rescuer(), rescuer);
        assertEq(vesting.fundsOwner(), teamGnosis);
        assertEq(address(vesting.paymentToken()), address(templeGold));
    }

    function test_initialization_invalid_paymentToken() public {
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        /*VestingPayments vestingPayments = */new VestingPayments(rescuer, executor, teamGnosis, address(0));
    }

    function _createVestingOne() internal returns (IVestingPayments.VestingSchedule memory schedule) {
        IVestingPayments.VestingSchedule[] memory schedules = new IVestingPayments.VestingSchedule[](1);
        schedule = _getScheduleOne();
        schedules[0] = schedule;
        vesting.createSchedules(schedules);
    }

    function _createVestingTwo() internal returns (IVestingPayments.VestingSchedule memory schedule) {
        IVestingPayments.VestingSchedule[] memory schedules = new IVestingPayments.VestingSchedule[](1);
        schedule = _getScheduleTwo();
        schedules[0] = schedule;
        vesting.createSchedules(schedules);
    }

    function _getScheduleOne() internal view returns (IVestingPayments.VestingSchedule memory schedule) {
        uint40 start = uint40(block.timestamp);
        uint40 cliff = uint40(start + 12 weeks);
        uint40 duration = uint40(48 weeks);
        schedule = IVestingPayments.VestingSchedule(
            cliff,
            start,
            duration,
            10_000 ether,
            0,
            alice,
            false
        );
    }

    function _getScheduleTwo() internal view returns (IVestingPayments.VestingSchedule memory schedule) {
        uint40 start = uint32(block.timestamp) + 1 weeks;
        uint40 cliff = uint32(start + 16 weeks);
        uint40 duration = 56 weeks;
        schedule = IVestingPayments.VestingSchedule(
            cliff,
            start,
            duration,
            20_000 ether,
            0,
            bob,
            false
        );
    }

    function _getScheduleThree() internal view returns (IVestingPayments.VestingSchedule memory schedule) {
        uint32 start = uint32(block.timestamp) + 4 weeks;
        uint32 cliff = uint32(start + 12 weeks);
        uint32 duration = 56 weeks;
        schedule = IVestingPayments.VestingSchedule(
            cliff,
            start,
            duration,
            30_000 ether,
            0,
            mike,
            false
        );
    }

    function _createFirstSchedule() internal returns (bytes32 _id) {
        _id = _createSchedule(_getScheduleOne(), alice);
    }

    function _createSecondSchedule() internal returns (bytes32 _id) {
        _id = _createSchedule(_getScheduleTwo(), bob);
    }

    function _createSchedule(IVestingPayments.VestingSchedule memory _schedule, address _account) private returns (bytes32 _id) {
        vm.startPrank(executor);
        IVestingPayments.VestingSchedule[] memory schedules = new IVestingPayments.VestingSchedule[](1);
        // create vesting
        _id = vesting.computeNextVestingScheduleIdForHolder(_account);
        schedules[0] = _schedule;
        vesting.createSchedules(schedules);
    }

    function _fundsOwnerApprove() internal {
        vm.startPrank(teamGnosis);
        IERC20(address(templeGold)).approve(address(vesting), type(uint).max);
    }

    function _mint() internal {
        // mint for team gnosis
        skip(8 weeks);
        templeGold.mint();
    }
}

contract VestingPaymentsAccessTest is VestingPaymentsTestBase {
    function test_access_fail_setFundsOwner() public {
        expectElevatedAccess();
        vesting.setFundsOwner(alice);
    }

    function test_access_fail_createSchedules() public {
        IVestingPayments.VestingSchedule[] memory schedules = new IVestingPayments.VestingSchedule[](1);
        schedules[0] = _getScheduleOne();
        expectElevatedAccess();
        vesting.createSchedules(schedules);
    }

    function test_access_fail_revokeVesting() public {
        expectElevatedAccess();
        vesting.revokeVesting(bytes32(bytes("")));
    }

    function test_access_fail_recoverToken() public {
        expectElevatedAccess();
        vesting.recoverToken(address(fakeToken), alice, 1);
    }

    function test_access_success_setFundsOwner() public {
        vm.startPrank(executor);
        vesting.setFundsOwner(alice);
    }

    function test_access_success_createSchedules() public {
        vm.startPrank(executor);
        IVestingPayments.VestingSchedule[] memory schedules = new IVestingPayments.VestingSchedule[](1);
        schedules[0] = _getScheduleOne();
        vesting.createSchedules(schedules);
    }

    function test_access_success_revokeVesting() public {
        vm.startPrank(executor);
        IVestingPayments.VestingSchedule[] memory schedules = new IVestingPayments.VestingSchedule[](1);
        schedules[0] = _getScheduleOne();
        vesting.createSchedules(schedules);
        bytes32[] memory ids = vesting.getVestingIds();
        vesting.revokeVesting(ids[0]);
    }

    function test_access_success_recoverToken() public {
        vm.startPrank(executor);
        deal(address(fakeToken), address(vesting), 1e18, true);
        vesting.recoverToken(address(fakeToken), alice, 1e18);
    }
}

contract VestingPaymentsViewTest is VestingPaymentsTestBase {
    function test_getLastVestingScheduleForHolder_zero_vesting_count() public view {
        IVestingPayments.VestingSchedule memory schedule = vesting.getLastVestingScheduleForHolder(alice);
        // empty schedule
        assertEq(schedule.amount, 0);
        assertEq(schedule.start, 0);
        assertEq(schedule.revoked, false);
        assertEq(schedule.duration, 0);
        assertEq(schedule.cliff, 0);
        assertEq(schedule.recipient, address(0));
    }

    function test_getLastVestingScheduleForHolder() public {
        IVestingPayments.VestingSchedule memory schedule = _createVestingOne(); 
        IVestingPayments.VestingSchedule memory _schedule = vesting.getLastVestingScheduleForHolder(alice);
        assertEq(_schedule.amount, schedule.amount);
        assertEq(_schedule.duration, schedule.duration);
        assertEq(_schedule.cliff, schedule.cliff);
        assertEq(_schedule.start, schedule.start);
        assertEq(_schedule.revoked, schedule.revoked);
        assertEq(_schedule.recipient, schedule.recipient);
    }

    function test_getVestingIdAtIndex_zero_ids() public {
        vm.expectRevert(abi.encodeWithSelector(IVestingPayments.NoVesting.selector));
        vesting.getVestingIdAtIndex(1);
    }

    function test_getVestingIdAtIndex() public {
        IVestingPayments.VestingSchedule memory _schedule = _createVestingOne();
        bytes32 id = vesting.getVestingIdAtIndex(0);
        IVestingPayments.VestingSchedule memory schedule = vesting.getSchedule(id);
        assertEq(_schedule.amount, schedule.amount);
        assertEq(_schedule.start, schedule.start);
        assertEq(_schedule.cliff, schedule.cliff);
        assertEq(_schedule.distributed, schedule.distributed);
        assertEq(_schedule.duration, schedule.duration);
        assertEq(_schedule.recipient, schedule.recipient);
        assertEq(_schedule.revoked, schedule.revoked);
    }

    function test_getVestingIds() public {
        IVestingPayments.VestingSchedule memory schedule = _createVestingOne();
        bytes32[] memory ids = vesting.getVestingIds();
        assertEq(ids.length, 1);
        assertEq(ids[0], vesting.getVestingIdAtIndex(0));
        schedule = _createVestingTwo();
        ids = vesting.getVestingIds();
        assertEq(ids.length, 2);
        assertEq(ids[1], vesting.getVestingIdAtIndex(1));   
    }

    function test_getReleasableAmount_zero_amount() public view {
        bytes32 id;
        assertEq(vesting.getReleasableAmount(id), 0);
    }

    function test_getReleasableAmount_less_than_equal_to_start() public {
        IVestingPayments.VestingSchedule memory schedule = _createVestingOne();
        bytes32[] memory ids = vesting.getVestingIds();
        // go to less than start time
        vm.warp(schedule.start-1);
        assertEq(vesting.getReleasableAmount(ids[0]), 0);
    }

    function test_getReleasableAmount_less_than_equal_to_cliff() public {
        IVestingPayments.VestingSchedule memory schedule = _createVestingOne();
        bytes32[] memory ids = vesting.getVestingIds();
        // go to less than cliff time
        vm.warp(schedule.cliff-1);
        assertEq(vesting.getReleasableAmount(ids[0]), 0);
    }

    function test_getReleasableAmount_revoked_unclaimed() public {
        _createVestingOne();
        bytes32[] memory ids = vesting.getVestingIds();
        skip(16 weeks);
        vesting.revokeVesting(ids[0]);
        assertEq(vesting.getReleasableAmount(ids[0]), vesting.revokedAccountsReleasable(alice));
    }

    function test_getReleasableAmount_revoked_claimed() public {
        _fundsOwnerApprove();
        _mint();
        vm.startPrank(executor);
        _createVestingOne();
        bytes32[] memory ids = vesting.getVestingIds();
        skip(16 weeks);
        vesting.revokeVesting(ids[0]);
        vm.startPrank(alice);
        vesting.release(ids[0]);
        assertEq(vesting.getReleasableAmount(ids[0]), 0);
    }

    function test_getReleasableAmount_arithmetic() public {
        _fundsOwnerApprove();
        _mint();
        vm.startPrank(executor);
        _createVestingOne();
        bytes32[] memory ids = vesting.getVestingIds();
        skip(16 weeks);

        IVestingPayments.VestingSchedule memory schedule = vesting.getSchedule(ids[0]);
        uint256 amount = 16 * schedule.amount / 48;
        assertEq(vesting.getReleasableAmount(ids[0]), amount);

        _createVestingTwo();
        ids = vesting.getVestingIds();

        schedule = vesting.getSchedule(ids[1]);
        // 1 week + (cliff - start)) + 11 weeks
        skip(29 weeks);
        amount = 28 * schedule.amount / 56;
        assertEq(vesting.getReleasableAmount(ids[1]), amount);
    }

    function test_getVestingIdAtIndex_after_revoke() public {
        vm.startPrank(executor);
        IVestingPayments.VestingSchedule[] memory schedules = new IVestingPayments.VestingSchedule[](3);
        schedules[0] = _getScheduleOne();
        schedules[1] = _getScheduleTwo();
        schedules[2] = _getScheduleThree();
        vesting.createSchedules(schedules);
        bytes32[] memory ids = vesting.getVestingIds();
        assertEq(ids.length, 3);
        assertEq(vesting.getVestingIdAtIndex(0), ids[0]);
        vesting.revokeVesting(ids[1]);
        // got popped after revoke
        assertNotEq(vesting.getVestingIdAtIndex(1), ids[1]);
        assertEq(vesting.getVestingIdAtIndex(1), ids[2]);

        ids = vesting.getVestingIds();
        assertEq(ids.length, 2);
        assertEq(vesting.getVestingIdAtIndex(0), ids[0]);
        assertEq(vesting.getVestingIdAtIndex(1), ids[1]);
    }

    function test_getTotalVestedAt_zero_amount() public view {
        bytes32 randomId = bytes32("0x123");
        assertEq(0, vesting.getTotalVestedAt(randomId, uint40(block.timestamp+30 days)));
    }

    function test_getTotalVestedAt_at_less_than_start() public {
        vm.startPrank(executor);
        IVestingPayments.VestingSchedule[] memory schedules = new IVestingPayments.VestingSchedule[](1);
        schedules[0] = _getScheduleOne();
        vesting.createSchedules(schedules);
        bytes32[] memory ids = vesting.getVestingIds();
        assertEq(0, vesting.getTotalVestedAt(ids[0], uint40(schedules[0].start-1)));
    }

    function test_getTotalVestedAt_weeks() public {
        vm.startPrank(executor);
        IVestingPayments.VestingSchedule[] memory schedules = new IVestingPayments.VestingSchedule[](1);
        schedules[0] = _getScheduleOne();
        vesting.createSchedules(schedules);
        bytes32[] memory ids = vesting.getVestingIds();
        // 12 weeks. still under cliff
        assertEq(0, vesting.getTotalVestedAt(ids[0], uint40(block.timestamp+12 weeks)));

        // 16 weeks
        uint256 vested = 16 * schedules[0].amount / 48;
        assertEq(vested, vesting.getTotalVestedAt(ids[0], uint40(block.timestamp+16 weeks)));

        // 48 weeks
        assertEq(schedules[0].amount, vesting.getTotalVestedAt(ids[0], uint40(block.timestamp+48 weeks)));

        // beyond duration
        assertEq(schedules[0].amount, vesting.getTotalVestedAt(ids[0], uint40(block.timestamp+48 weeks+1 seconds)));
        assertEq(schedules[0].amount, vesting.getTotalVestedAt(ids[0], uint40(block.timestamp+56 weeks)));
    }
}

contract VestingPaymentsTest is VestingPaymentsTestBase {
    function test_setFundsOwner() public {
        vm.startPrank(executor);
        vm.expectEmit(address(vesting));
        emit FundsOwnerSet(alice);
        vesting.setFundsOwner(alice);
        assertEq(vesting.fundsOwner(), alice);

        vm.expectEmit(address(vesting));
        emit FundsOwnerSet(mike);
        vesting.setFundsOwner(mike);
        assertEq(vesting.fundsOwner(), mike);
    }

    function test_createSchedules() public {
        vm.startPrank(executor);
        IVestingPayments.VestingSchedule[] memory schedules = new IVestingPayments.VestingSchedule[](0);
        // error length
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        vesting.createSchedules(schedules);

        schedules = new IVestingPayments.VestingSchedule[](1);
        IVestingPayments.VestingSchedule memory _schedule = _getScheduleOne();
        _schedule.distributed = uint128(1);
        schedules[0] = _schedule;
        // error distributed and revoked
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        vesting.createSchedules(schedules);
        _schedule.distributed = 0;
        _schedule.revoked = true;
        schedules[0] = _schedule;
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        vesting.createSchedules(schedules);
        _schedule.revoked = false;

        // error recipient
        _schedule.recipient = address(0);
        schedules[0] = _schedule;
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        vesting.createSchedules(schedules);
        _schedule.recipient = alice;

        _schedule.start = uint32(block.timestamp - 1);
        schedules[0] = _schedule;
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        vesting.createSchedules(schedules);
        _schedule.start = uint32(block.timestamp);

        _schedule.cliff = _schedule.start;
        schedules[0] = _schedule;
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        vesting.createSchedules(schedules);
        _schedule.cliff = _schedule.start + 12 weeks;
        _schedule.duration = 12 weeks - 1;
        schedules[0] = _schedule;
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        vesting.createSchedules(schedules);
        _schedule.duration = 24 weeks;
        _schedule.amount = 0;
        schedules[0] = _schedule;
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        vesting.createSchedules(schedules);

        _schedule = _getScheduleOne();
        schedules[0] = _schedule;
        bytes32 _id = vesting.computeNextVestingScheduleIdForHolder(_schedule.recipient);
        vm.expectEmit(address(vesting));
        emit ScheduleCreated(_id, _schedule.recipient, _schedule.start, _schedule.cliff, _schedule.duration, _schedule.amount);
        vesting.createSchedules(schedules);
        bytes32[] memory ids = vesting.getVestingIds();
        assertEq(vesting.totalVestedAndUnclaimed(), _schedule.amount);
        assertEq(vesting.getVestingIdAtIndex(0), _id);
        assertEq(ids.length, 1);
        assertEq(ids[0], _id);
        assertEq(vesting.isActiveVestingId(_id), true);
        assertEq(vesting.holdersVestingCount(_schedule.recipient), 1);
        IVestingPayments.VestingSchedule memory _storedVest = vesting.getVestingScheduleByAddressAndIndex(_schedule.recipient, 0);
        assertEq(_storedVest.amount, _schedule.amount);
        assertEq(_storedVest.cliff, _schedule.cliff);
        assertEq(_storedVest.distributed, 0);
        assertEq(_storedVest.duration, _schedule.duration);
        assertEq(_storedVest.recipient, _schedule.recipient);
        assertEq(_storedVest.revoked, false);
        assertEq(_storedVest.start, _schedule.start);

        schedules = new IVestingPayments.VestingSchedule[](2);
        schedules[0] = _getScheduleTwo();
        schedules[1] = _getScheduleThree();
        bytes32 _id2 = vesting.computeNextVestingScheduleIdForHolder(schedules[0].recipient);
        bytes32 _id3 = vesting.computeNextVestingScheduleIdForHolder(schedules[1].recipient);
        vm.expectEmit(address(vesting));
        emit ScheduleCreated(_id2, schedules[0].recipient, schedules[0].start, schedules[0].cliff, schedules[0].duration, schedules[0].amount);
        vm.expectEmit(address(vesting));
        emit ScheduleCreated(_id3, schedules[1].recipient, schedules[1].start, schedules[1].cliff, schedules[1].duration, schedules[1].amount);
        vesting.createSchedules(schedules);

        ids = vesting.getVestingIds();
        assertEq(vesting.totalVestedAndUnclaimed(), _schedule.amount + schedules[0].amount + schedules[1].amount);
        assertEq(vesting.getVestingIdAtIndex(1), _id2);
        assertEq(vesting.getVestingIdAtIndex(2), _id3);
        assertEq(ids.length, 3);
        assertEq(vesting.isActiveVestingId(_id2), true);
        assertEq(vesting.isActiveVestingId(_id3), true);
        assertEq(vesting.holdersVestingCount(schedules[0].recipient), 1);
        assertEq(vesting.holdersVestingCount(schedules[1].recipient), 1);
        _storedVest = vesting.getVestingScheduleByAddressAndIndex(schedules[0].recipient, 0);
        assertEq(_storedVest.amount, schedules[0].amount);
        assertEq(_storedVest.cliff, schedules[0].cliff);
        assertEq(_storedVest.distributed, 0);
        assertEq(_storedVest.duration, schedules[0].duration);
        assertEq(_storedVest.recipient, schedules[0].recipient);
        assertEq(_storedVest.revoked, false);
        assertEq(_storedVest.start, schedules[0].start);
        _storedVest = vesting.getVestingScheduleByAddressAndIndex(schedules[1].recipient, 0);
        assertEq(_storedVest.amount, schedules[1].amount);
        assertEq(_storedVest.cliff, schedules[1].cliff);
        assertEq(_storedVest.distributed, 0);
        assertEq(_storedVest.duration, schedules[1].duration);
        assertEq(_storedVest.recipient, schedules[1].recipient);
        assertEq(_storedVest.revoked, false);
        assertEq(_storedVest.start, schedules[1].start);
    }

    function test_revokeVesting() public {
        bytes32 _id;
        IVestingPayments.VestingSchedule[] memory schedules = new IVestingPayments.VestingSchedule[](1);
        IVestingPayments.VestingSchedule memory _schedule = _getScheduleOne();
        {
            // create vesting
            _id = vesting.computeNextVestingScheduleIdForHolder(alice);
            schedules[0] = _schedule;
            vesting.createSchedules(schedules);
        }

        {
            _id = vesting.computeNextVestingScheduleIdForHolder(bob);
            _schedule = _getScheduleTwo();
            schedules[0] = _schedule;
            vesting.createSchedules(schedules);
        }

        // skip to cliff to claim vested
        vm.warp(_schedule.cliff + 1);
        uint256 bobBalanceBefore = templeGold.balanceOf(bob);
        uint256 _elapsed = block.timestamp - _schedule.start > _schedule.duration ? _schedule.duration : block.timestamp - _schedule.start;
        uint256 releasable = _schedule.amount * _elapsed / _schedule.duration;
        uint256 unreleased = _schedule.amount - _schedule.distributed;
        uint256 releasableAmount = vesting.getReleasableAmount(_id);

        uint256 totalVestedAndUnclaimed = vesting.totalVestedAndUnclaimed();
        vm.expectEmit(address(vesting));
        emit Revoked(_id, _schedule.recipient, unreleased, totalVestedAndUnclaimed);
        vesting.revokeVesting(_id);
        assertEq(releasableAmount, releasable);
        // account has not claimed yet after revoke
        assertEq(templeGold.balanceOf(bob), bobBalanceBefore);
    }

    function test_revokeVesting_revoke_after_vesting() public {
        test_revokeVesting();
        // revoke for future time
        bytes32 _id = vesting.computeNextVestingScheduleIdForHolder(mike);
        IVestingPayments.VestingSchedule[] memory schedules = new IVestingPayments.VestingSchedule[](1);
        IVestingPayments.VestingSchedule memory _schedule = _getScheduleThree();
        schedules[0] = _schedule;
        vesting.createSchedules(schedules);

        // try to revoke after end of vesting
        vm.warp(_schedule.start + 500 days);
        vm.expectRevert(abi.encodeWithSelector(IVestingPayments.FullyVested.selector));
        vesting.revokeVesting(_id);
    }

    function test_revokeVesting_immediate_revoke_after_creation() public {
        bytes32 _id;
        IVestingPayments.VestingSchedule[] memory schedules = new IVestingPayments.VestingSchedule[](1);
        IVestingPayments.VestingSchedule memory _schedule = _getScheduleOne();
        {
            // create vesting
            _id = vesting.computeNextVestingScheduleIdForHolder(alice);
            schedules[0] = _schedule;
            vesting.createSchedules(schedules);
        }
        uint256 totalVestedAndUnclaimed = vesting.totalVestedAndUnclaimed();
        {
            // no time passed, immediate revoke
            vm.expectEmit(address(vesting));
            emit Revoked(_id, _schedule.recipient, _schedule.amount, totalVestedAndUnclaimed);
            vesting.revokeVesting(_id);
            IVestingPayments.VestingSchedule memory _storedVest = vesting.getVestingScheduleByAddressAndIndex(alice, 0);
            assertEq(_storedVest.revoked, true);
            bytes32[] memory activeIds = vesting.getVestingIds();
            assertEq(activeIds.length, 0);
            assertEq(vesting.totalVestedAndUnclaimed(), totalVestedAndUnclaimed);
        }
    }

    function test_revokeVesting_invalid_id_after_revoke() public {
        test_revokeVesting_immediate_revoke_after_creation();
        // use previous index to match id
        bytes32 _id = vesting.computeVestingScheduleIdForAddressAndIndex(alice, 0);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        vesting.revokeVesting(_id);
    }

    function test_revokeVesting_invalid_vesting_id() public {
        _fundsOwnerApprove();
        _mint();
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        vesting.revokeVesting(bytes32(bytes("")));
    }
    
    function test_revoke_vesting_user_calls_release_immediately_after() public {
        _fundsOwnerApprove();
        _mint();

        vm.startPrank(executor);
        bytes32 _id;
        IVestingPayments.VestingSchedule[] memory schedules = new IVestingPayments.VestingSchedule[](1);
        IVestingPayments.VestingSchedule memory _schedule = _getScheduleOne();
        {
            // create vesting
            _id = vesting.computeNextVestingScheduleIdForHolder(alice);
            schedules[0] = _schedule;
            vesting.createSchedules(schedules);
        }

        // skip 16 weeks. 12 weeks vestng.
        skip(16 weeks);
        uint256 expectedAmount = 16 * _schedule.amount / 48;
        // revoke and expect releasable amount to equal expected vest
        vesting.revokeVesting(_id);
        assertEq(vesting.revokedAccountsReleasable(alice), expectedAmount);

        // release immediately after
        uint256 balance = templeGold.balanceOf(alice);
        vm.startPrank(alice);
        vesting.release(_id);
        assertEq(templeGold.balanceOf(alice), balance+expectedAmount);
        assertEq(vesting.revokedAccountsReleasable(alice), 0);
    }

    function test_revoke_vesting_user_calls_release_after_some_time() public {
        _fundsOwnerApprove();
        _mint();

        vm.startPrank(executor);
        bytes32 _id;
        IVestingPayments.VestingSchedule[] memory schedules = new IVestingPayments.VestingSchedule[](1);
        IVestingPayments.VestingSchedule memory _schedule = _getScheduleOne();
        {
            // create vesting
            _id = vesting.computeNextVestingScheduleIdForHolder(alice);
            schedules[0] = _schedule;
            vesting.createSchedules(schedules);
        }
        // skip
        skip(16 weeks);
        uint256 expectedAmount = 16 * _schedule.amount / 48;
        // revoke and expect releasable amount to equal expected vest
        vesting.revokeVesting(_id);
        assertEq(vesting.revokedAccountsReleasable(alice), expectedAmount);
        
        // release after some time
        skip(4 weeks);
        uint256 balance = templeGold.balanceOf(alice);
        vm.startPrank(alice);
        vesting.release(_id);
        // still expecting vested at revoke time even after some time has passed
        assertEq(templeGold.balanceOf(alice), balance+expectedAmount);
        assertEq(vesting.revokedAccountsReleasable(alice), 0);
    }

    function test_recoverToken_vesting() public {
        uint256 amount = 100 ether;
        deal(address(fakeToken), address(vesting), amount, true);

        vm.expectEmit();
        emit CommonEventsAndErrors.TokenRecovered(alice, address(fakeToken), amount);

        vm.startPrank(executor);
        vesting.recoverToken(address(fakeToken), alice, amount);
        assertEq(fakeToken.balanceOf(alice), amount);
        assertEq(fakeToken.balanceOf(address(vesting)), 0);
    }

    function test_computeNextVestingScheduleIdForHolder() public {
        assertEq(vesting.holdersVestingCount(alice), 0);
        assertEq(vesting.holdersVestingCount(alice), 0);
        bytes32 nextId = keccak256(abi.encodePacked(alice, uint(0)));
        assertEq(vesting.computeNextVestingScheduleIdForHolder(alice), nextId);
        assertEq(vesting.computeVestingScheduleIdForAddressAndIndex(alice, 0), nextId);
        // create vesting
        _createFirstSchedule();
        assertEq(vesting.holdersVestingCount(alice), 1);
        nextId = keccak256(abi.encodePacked(alice, uint(1)));
        assertEq(vesting.computeNextVestingScheduleIdForHolder(alice), nextId);
        assertEq(vesting.computeVestingScheduleIdForAddressAndIndex(alice, 1), nextId);
    }

    function test_isActiveVestingId() public {
        assertEq(vesting.isVestingRevoked(bytes32(bytes(""))), false);
        bytes32 _id = _createFirstSchedule();
        assertEq(vesting.isActiveVestingId(_id), true);
        bytes32[] memory _ids = vesting.getVestingIds();
        assertEq(_ids.length, 1);
        assertEq(_ids[0], _id);
        // revoke immediately
        vesting.revokeVesting(_id);
        assertEq(vesting.isVestingRevoked(_id), true);
    }

    function test_getSchedule() public {
        vm.startPrank(executor);
        IVestingPayments.VestingSchedule[] memory schedules = new IVestingPayments.VestingSchedule[](1);
        IVestingPayments.VestingSchedule memory _schedule = _getScheduleOne();
        bytes32 _id;
        {
            // create vesting
            _id = vesting.computeNextVestingScheduleIdForHolder(alice);
            schedules[0] = _schedule;
            vesting.createSchedules(schedules);
        }
        IVestingPayments.VestingSchedule memory schedule = vesting.getSchedule(_id);
        assertEq(schedule.cliff, _schedule.cliff);
        assertEq(schedule.duration, _schedule.duration);
        assertEq(schedule.amount, _schedule.amount);
        assertEq(schedule.revoked, _schedule.revoked);
        assertEq(schedule.distributed, _schedule.distributed);
    }

    function test_release_invalid_id() public {
        _fundsOwnerApprove();
        _mint();
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        vesting.release(bytes32(bytes("")));

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        vesting.release(bytes32(bytes("0x123")));
    }

    function test_release_wrong_recipient() public {
        bytes32 _id = _createFirstSchedule();
        vm.startPrank(bob);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        vesting.release(_id);
    }

    function test_release_revoked_recipient_before_cliff() public {
        // zero releasable, before cliff
        uint256 balance = templeGold.balanceOf(alice);
        bytes32 id = createAndRevokeSchedule(1 weeks);
        uint256 releasableAmount = vesting.revokedAccountsReleasable(alice);
        assertEq(releasableAmount, 0);
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        vesting.release(id);
        assertEq(templeGold.balanceOf(alice), balance+0);
    }

    function test_release_revoked_recipient_releasable_amount() public returns (bytes32 id) {
        id = createAndRevokeSchedule(16 weeks);
        uint256 releasableAmount = vesting.revokedAccountsReleasable(alice);
        vm.startPrank(alice);
        vm.expectEmit(address(vesting));
        emit Released(id, alice, releasableAmount);
        vesting.release(id);
        assertEq(templeGold.balanceOf(alice), releasableAmount);
    }

    function test_release_revoked_inactive() public {
        bytes32 id = test_release_revoked_recipient_releasable_amount();
        // alice released. now `revokedAccountsReleasable[alice]` is 0 and alice id is inactive
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        vesting.release(id);
    }

    function test_release_no_amount() public {
        _fundsOwnerApprove();
        _mint();
        bytes32 _id = _createFirstSchedule();
        vm.startPrank(alice);
        IVestingPayments.VestingSchedule memory _schedule = vesting.getSchedule(_id);
        vm.warp(_schedule.cliff + 1 weeks);
        uint256 releasable = vesting.getReleasableAmount(_id);
        uint256 balance = templeGold.balanceOf(alice);
        uint256 totalVestedAndUnclaimed = vesting.totalVestedAndUnclaimed();
        vm.expectEmit(address(vesting));
        emit Released(_id, alice, releasable);
        vesting.release(_id);
        assertEq(templeGold.balanceOf(alice), balance+releasable);
        _schedule = vesting.getSchedule(_id);
        assertEq(_schedule.distributed, releasable);
        assertEq(vesting.totalVestedAndUnclaimed(), totalVestedAndUnclaimed-releasable);

        // revoke and release
        skip(1 weeks);
        vm.startPrank(executor);
        balance = templeGold.balanceOf(alice);
        totalVestedAndUnclaimed = vesting.totalVestedAndUnclaimed();
        releasable = vesting.getReleasableAmount(_id);
        
        skip(3 weeks);
        balance = templeGold.balanceOf(alice);
        totalVestedAndUnclaimed = vesting.totalVestedAndUnclaimed();
        releasable = vesting.getReleasableAmount(_id);
        vm.startPrank(alice);
        vm.expectEmit(address(vesting));
        emit Released(_id, alice, releasable);
        vesting.release(_id);
        uint256 distributed = _schedule.distributed + releasable;
        _schedule = vesting.getSchedule(_id);
        assertEq(_schedule.distributed, distributed);
        assertEq(vesting.totalVestedAndUnclaimed(), totalVestedAndUnclaimed-releasable);
       
        // skip to after schedule end
        skip(48 weeks);
        balance = templeGold.balanceOf(alice);
        totalVestedAndUnclaimed = vesting.totalVestedAndUnclaimed();
        releasable = vesting.getReleasableAmount(_id);

        vesting.release(_id);
        distributed = _schedule.distributed + releasable;
        _schedule = vesting.getSchedule(_id);
        assertEq(_schedule.distributed, distributed);
        assertEq(vesting.totalVestedAndUnclaimed(), totalVestedAndUnclaimed-releasable);
        assertEq(_schedule.amount, _schedule.distributed);

        // error after trying again after full vest
        vm.expectRevert(abi.encodeWithSelector(IVestingPayments.FullyVested.selector));
        vesting.release(_id);
        // amounts not changed
        _schedule = vesting.getSchedule(_id);
        assertEq(_schedule.distributed, distributed);
        assertEq(vesting.totalVestedAndUnclaimed(), totalVestedAndUnclaimed-releasable);
        assertEq(_schedule.amount, _schedule.distributed);
    }

    function test_getVestingSummary() public {
        _fundsOwnerApprove();
        _mint();
        bytes32 _id1 = _createFirstSchedule();
        bytes32 _id2 = _createSecondSchedule();
        IVestingPayments.VestingSchedule memory _schedule1 = vesting.getSchedule(_id1);
        IVestingPayments.VestingSchedule memory _schedule2 = vesting.getSchedule(_id2);

        // alice: skip to below cliff
        skip(_schedule1.cliff-1);
        bytes32[] memory _ids = new bytes32[](2);
        uint256 releasable = vesting.getReleasableAmount(_id1);
        IVestingPayments.VestingSummary[] memory summary = vesting.getVestingSummary(_ids);
        assertEq(summary[0].distributed, 0);
        assertEq(summary[0].vested, 0);

        // to cliff
        vm.warp(_schedule1.cliff);
        _ids[0] = _id1;
        _ids[1] = _id2;
        summary = vesting.getVestingSummary(_ids);
        assertEq(summary[0].recipient, alice);
        assertEq(summary[0].distributed, 0); // unclaimed
        assertEq(summary[0].vested, 0);
        assertEq(summary[1].distributed, 0); // unclaimed
        assertEq(summary[1].vested, 0);
        assertEq(summary[1].recipient, bob);

        skip(1 seconds);
        vm.startPrank(alice);
        releasable = vesting.getReleasableAmount(_id1);
        vesting.release(_id1);
        summary = vesting.getVestingSummary(_ids);
        assertEq(summary[0].distributed, releasable);
        assertEq(summary[0].vested, vesting.getTotalVestedAt(_id1, uint40(block.timestamp)));
        assertEq(summary[1].distributed, 0); // unclaimed
        assertEq(summary[1].vested, vesting.getTotalVestedAt(_id2, uint40(block.timestamp)));

        vm.warp(_schedule2.cliff + 4 weeks);
        vm.startPrank(bob);
        uint256 bobReleasable = vesting.getReleasableAmount(_id2);
        vesting.release(_id2);
        summary = vesting.getVestingSummary(_ids);
        assertEq(summary[0].distributed, releasable); // same
        assertEq(summary[0].vested, vesting.getTotalVestedAt(_id1, uint40(block.timestamp)));
        assertEq(summary[1].distributed, bobReleasable);
        assertEq(summary[1].vested, vesting.getTotalVestedAt(_id2, uint40(block.timestamp)));
    }

    function test_release_past_duration() public {
        _fundsOwnerApprove();
        _mint();
        bytes32 _id1 = _createFirstSchedule();
        
        // so there's double the amount total vested and unclaimed
        _createFirstSchedule();

        vm.startPrank(alice);
        IVestingPayments.VestingSchedule memory _schedule = vesting.getSchedule(_id1);
        vm.warp(_schedule.start + _schedule.duration);
        assertEq(vesting.getReleasableAmount(_id1), _schedule.amount);
        assertEq(vesting.totalVestedAndUnclaimed(), _schedule.amount * 2);

        vm.warp(_schedule.start + _schedule.duration * 2);
        assertEq(vesting.getReleasableAmount(_id1), _schedule.amount);
        assertEq(vesting.totalVestedAndUnclaimed(), _schedule.amount * 2);

        vesting.release(_id1);
        assertEq(templeGold.balanceOf(alice), _schedule.amount);
    }

    function createAndRevokeSchedule(uint256 skipTime) private returns (bytes32) {
        _fundsOwnerApprove();
        _mint();

        vm.startPrank(executor);
        IVestingPayments.VestingSchedule[] memory schedules = new IVestingPayments.VestingSchedule[](1);
        IVestingPayments.VestingSchedule memory _schedule = _getScheduleOne();
        // create vesting
        bytes32 _id = vesting.computeNextVestingScheduleIdForHolder(alice);
        schedules[0] = _schedule;
        vesting.createSchedules(schedules);
        // skip if applicable
        if (skipTime > 0) {
            skip(skipTime);
        }
        // revoke
        vesting.revokeVesting(_id);

        return _id;
    }
}