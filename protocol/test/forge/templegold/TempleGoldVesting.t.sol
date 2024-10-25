pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// (tests/forge/templegold/TempleGoldVesting.t.sol)

import { TempleGoldCommon } from "./TempleGoldCommon.t.sol";
import { TempleGoldVesting } from "contracts/templegold/TempleGoldVesting.sol";
import { TempleGold } from "contracts/templegold/TempleGold.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";
import { ITempleGold } from "contracts/interfaces/templegold/ITempleGold.sol";
import { ITempleGoldVesting } from "contracts/interfaces/templegold/ITempleGoldVesting.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { DaiGoldAuction } from "contracts/templegold/DaiGoldAuction.sol";
import { TempleGoldStaking } from "contracts/templegold/TempleGoldStaking.sol";

contract TempleGoldVestingTestBase is TempleGoldCommon {
    event Revoked(bytes32 _id, address indexed _recipient, uint256 _unreleased, uint256 _totalVested);
    event Released(bytes32 _id, address indexed _recipient, uint256 _amount);
    event ScheduleCreated(
        bytes32 _id, address indexed _recipient, uint32 _start,
        uint32 _cliff, uint32 _duration, uint128 _amount
    );
    event RecipientChanged(bytes32 _vestingId, address _oldRecipient, address indexed _recipient);
    event FundsOwnerSet(address indexed _fundsOwner);

    FakeERC20 public fakeToken;
    FakeERC20 public templeToken;
    TempleGold public templeGold;
    TempleGoldVesting public vesting;
    DaiGoldAuction public daiGoldAuction;
    TempleGoldStaking public staking;

    uint256 public arbitrumOneForkId;


    function setUp() public {
        arbitrumOneForkId = fork("arbitrum_one");
        ITempleGold.InitArgs memory initArgs = _getTempleGoldInitArgs();
        templeGold = new TempleGold(initArgs);
        fakeToken = new FakeERC20("Fake Token", "FAKE", executor, 1000 ether);
        templeToken = new FakeERC20("Temple Token", "TEMPLE", executor, 1000 ether);
        staking = new TempleGoldStaking(rescuer, executor, address(templeToken), address(templeGold));
        daiGoldAuction = new DaiGoldAuction(
            address(templeGold),
            daiToken,
            treasury,
            rescuer,
            executor,
            executor
        );
        // teamGnosis is funds owner
        vesting = new TempleGoldVesting(rescuer, executor, teamGnosis, address(templeGold));

        // configure TGLD
        vm.startPrank(executor);
        templeGold.setDaiGoldAuction(address(daiGoldAuction));
        ITempleGold.DistributionParams memory params;
        params.daiGoldAuction = 60 ether;
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
        templeGold.authorizeContract(address(daiGoldAuction), true);
        templeGold.authorizeContract(address(staking), true);
        templeGold.authorizeContract(teamGnosis, true);
    }

    function test_initialization() public {
        assertEq(vesting.executor(), executor);
        assertEq(vesting.rescuer(), rescuer);
        assertEq(vesting.fundsOwner(), teamGnosis);
        assertEq(address(vesting.paymentToken()), address(templeGold));
    }

    function _getScheduleOne() internal view returns (ITempleGoldVesting.VestingSchedule memory schedule) {
        uint32 start = uint32(block.timestamp);
        uint32 cliff = uint32(start + 12 weeks);
        uint32 duration = uint32(48 weeks);
        schedule = ITempleGoldVesting.VestingSchedule(
            cliff,
            start,
            duration,
            10_000 ether,
            0,
            alice,
            false
        );
    }

    function _getScheduleTwo() internal view returns (ITempleGoldVesting.VestingSchedule memory schedule) {
        uint32 start = uint32(block.timestamp) + 1 weeks;
        uint32 cliff = uint32(start + 16 weeks);
        uint32 duration = 56 weeks;
        schedule = ITempleGoldVesting.VestingSchedule(
            cliff,
            start,
            duration,
            20_000 ether,
            0,
            bob,
            false
        );
    }

    function _getScheduleThree() internal view returns (ITempleGoldVesting.VestingSchedule memory schedule) {
        uint32 start = uint32(block.timestamp) + 4 weeks;
        uint32 cliff = uint32(start + 12 weeks);
        uint32 duration = 56 weeks;
        schedule = ITempleGoldVesting.VestingSchedule(
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

    function _createSchedule(ITempleGoldVesting.VestingSchedule memory _schedule, address _account) private returns (bytes32 _id) {
        vm.startPrank(executor);
        ITempleGoldVesting.VestingSchedule[] memory schedules = new ITempleGoldVesting.VestingSchedule[](1);
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

contract TempleGoldVestingAccessTest is TempleGoldVestingTestBase {
    function test_access_fail_setFundsOwner() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        vesting.setFundsOwner(alice);
    }

    function test_access_fail_createSchedules() public {
        ITempleGoldVesting.VestingSchedule[] memory schedules = new ITempleGoldVesting.VestingSchedule[](1);
        schedules[0] = _getScheduleOne();
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        vesting.createSchedules(schedules);
    }

    function test_access_fail_revokeVesting() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        vesting.revokeVesting(bytes32(bytes("")));
    }

    function test_access_fail_recoverToken() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        vesting.recoverToken(address(fakeToken), alice, 1);
    }
}

contract TempleGoldVestingTest is TempleGoldVestingTestBase {
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
        ITempleGoldVesting.VestingSchedule[] memory schedules = new ITempleGoldVesting.VestingSchedule[](0);
        // error length
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        vesting.createSchedules(schedules);

        schedules = new ITempleGoldVesting.VestingSchedule[](1);
        ITempleGoldVesting.VestingSchedule memory _schedule = _getScheduleOne();
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
        assertEq(vesting.vestingIdExists(_id), true);
        assertEq(vesting.holdersVestingCount(_schedule.recipient), 1);
        ITempleGoldVesting.VestingSchedule memory _storedVest = vesting.getVestingScheduleByAddressAndIndex(_schedule.recipient, 0);
        assertEq(_storedVest.amount, _schedule.amount);
        assertEq(_storedVest.cliff, _schedule.cliff);
        assertEq(_storedVest.distributed, 0);
        assertEq(_storedVest.duration, _schedule.duration);
        assertEq(_storedVest.recipient, _schedule.recipient);
        assertEq(_storedVest.revoked, false);
        assertEq(_storedVest.start, _schedule.start);

        schedules = new ITempleGoldVesting.VestingSchedule[](2);
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
        assertEq(vesting.vestingIdExists(_id2), true);
        assertEq(vesting.vestingIdExists(_id3), true);
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
        {
            _fundsOwnerApprove();
            _mint();
            vm.startPrank(executor);
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
            vesting.revokeVesting(bytes32(bytes("")));
        }
        bytes32 _id;
        ITempleGoldVesting.VestingSchedule[] memory schedules = new ITempleGoldVesting.VestingSchedule[](1);
        ITempleGoldVesting.VestingSchedule memory _schedule = _getScheduleOne();
        {
            // create vesting
            _id = vesting.computeNextVestingScheduleIdForHolder(alice);
            schedules[0] = _schedule;
            vesting.createSchedules(schedules);
        }
        
        {
            // no time passed, immediate revoke
            vm.expectEmit(address(vesting));
            emit Revoked(_id, _schedule.recipient, _schedule.amount, 0);
            vesting.revokeVesting(_id);
            ITempleGoldVesting.VestingSchedule memory _storedVest = vesting.getVestingScheduleByAddressAndIndex(alice, 0);
            assertEq(_storedVest.revoked, true);
            bytes32[] memory activeIds = vesting.getVestingIds();
            assertEq(activeIds.length, 0);
            assertEq(vesting.totalVestedAndUnclaimed(), 0);
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
            vesting.revokeVesting(_id);
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
        releasable = releasable - _schedule.distributed;
        uint256 unreleased = _schedule.amount - releasable;
        uint256 releasableAmount = vesting.getReleasableAmount(_id);
        
        vm.expectEmit(address(vesting));
        emit Revoked(_id, _schedule.recipient, unreleased, 0);
        vesting.revokeVesting(_id);
        assertEq(releasableAmount, releasable);
        assertEq(templeGold.balanceOf(bob), bobBalanceBefore + releasable);

        {
            // revoke for future time
            _id = vesting.computeNextVestingScheduleIdForHolder(mike);
            _schedule = _getScheduleThree();
            schedules[0] = _schedule;
            vesting.createSchedules(schedules);
        }

        {
            // try to revoke after end of vesting
            vm.warp(_schedule.start + 500 days);
            vm.expectRevert(abi.encodeWithSelector(ITempleGoldVesting.FullyVested.selector));
            vesting.revokeVesting(_id);
        }
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

    function test_vestingIdExists() public {
        assertEq(vesting.isVestingRevoked(bytes32(bytes(""))), true);
        bytes32 _id = _createFirstSchedule();
        assertEq(vesting.vestingIdExists(_id), true);
        bytes32[] memory _ids = vesting.getVestingIds();
        assertEq(_ids.length, 1);
        assertEq(_ids[0], _id);
        // revoke immediately
        vesting.revokeVesting(_id);
        bytes32 empty = bytes32("");
        assertEq(vesting.getVestingIdAtIndex(0), empty);
        assertEq(vesting.getVestingIdAtIndex(5), empty);
        assertEq(vesting.isVestingRevoked(_id), true);
    }

    function test_getSchedule() public {
        vm.startPrank(executor);
        ITempleGoldVesting.VestingSchedule[] memory schedules = new ITempleGoldVesting.VestingSchedule[](1);
        ITempleGoldVesting.VestingSchedule memory _schedule = _getScheduleOne();
        bytes32 _id;
        {
            // create vesting
            _id = vesting.computeNextVestingScheduleIdForHolder(alice);
            schedules[0] = _schedule;
            vesting.createSchedules(schedules);
        }
        ITempleGoldVesting.VestingSchedule memory schedule = vesting.getSchedule(_id);
        assertEq(schedule.cliff, _schedule.cliff);
        assertEq(schedule.duration, _schedule.duration);
        assertEq(schedule.amount, _schedule.amount);
        assertEq(schedule.revoked, _schedule.revoked);
        assertEq(schedule.distributed, _schedule.distributed);
    }

    function test_release_no_amount() public {
        _fundsOwnerApprove();
        _mint();
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        vesting.release(bytes32(bytes("")));

        bytes32 _id = _createFirstSchedule();
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        vesting.release(_id);

        vm.startPrank(alice);
        ITempleGoldVesting.VestingSchedule memory _schedule = vesting.getSchedule(_id);
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
        vesting.revokeVesting(_id);
        uint256 _distributed = _schedule.distributed;
        _schedule = vesting.getSchedule(_id);
        uint256 unreleased = _schedule.amount - _schedule.distributed;
        assertEq(templeGold.balanceOf(alice), balance+releasable);
        assertEq(vesting.totalVestedAndUnclaimed(), totalVestedAndUnclaimed-unreleased-releasable);
        assertEq(_schedule.distributed, _distributed+releasable);
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        vesting.release(_id);
        // error after trying again
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        vesting.release(_id);
    }

    function test_release_amount() public {
        _fundsOwnerApprove();
        _mint();
        vm.startPrank(executor);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        vesting.releaseAmount(bytes32(bytes("")), 1);

        bytes32 _id = _createFirstSchedule();
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        vesting.releaseAmount(_id, 1);

        vm.startPrank(alice);
        ITempleGoldVesting.VestingSchedule memory _schedule = vesting.getSchedule(_id);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        vesting.releaseAmount(_id, _schedule.amount+1);
        vm.warp(_schedule.cliff + 1 weeks);
        uint256 releasable = vesting.getReleasableAmount(_id);
        vm.expectRevert(abi.encodeWithSelector(ITempleGoldVesting.CannotRelease.selector));
        vesting.releaseAmount(_id, releasable+1);

        uint256 balance = templeGold.balanceOf(alice);
        uint256 totalVestedAndUnclaimed = vesting.totalVestedAndUnclaimed();
        vm.expectEmit(address(vesting));
        emit Released(_id, alice, releasable);
        vesting.releaseAmount(_id, releasable);
        assertEq(templeGold.balanceOf(alice), balance+releasable);
        _schedule = vesting.getSchedule(_id);
        assertEq(_schedule.distributed, releasable);
        assertEq(vesting.totalVestedAndUnclaimed(), totalVestedAndUnclaimed-releasable);

        // revoke and release. revoke same time
        vm.startPrank(executor);
        vesting.revokeVesting(_id);
        // alice received funds
        assertEq(releasable, templeGold.balanceOf(alice) - balance);
        vm.startPrank(alice);
        // id removed after revoke
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        vesting.releaseAmount(_id, 1);

        balance = templeGold.balanceOf(bob);
        _id = _createSecondSchedule();
        _schedule = vesting.getSchedule(_id);
        vm.warp(_schedule.cliff + 1 weeks);
        releasable = vesting.getReleasableAmount(_id);
        totalVestedAndUnclaimed = vesting.totalVestedAndUnclaimed();
        vm.startPrank(executor);
        vesting.revokeVesting(_id);
        assertEq(templeGold.balanceOf(bob), balance+releasable);
        _schedule = vesting.getSchedule(_id);
        assertEq(_schedule.distributed, releasable);

        vm.startPrank(bob);
        // release at block.timestamp
        releasable = vesting.getReleasableAmount(_id);
        // revoke calls release
        assertEq(releasable, 0);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        vesting.releaseAmount(_id, 1);
        totalVestedAndUnclaimed = vesting.getTotalVestedAt(_id, uint32(block.timestamp));
        skip(1 weeks);
        uint256 revokedVestedMax = vesting.getTotalVestedAt(_id, uint32(block.timestamp));
        balance = templeGold.balanceOf(bob);
        releasable = revokedVestedMax - totalVestedAndUnclaimed;
        _schedule = vesting.getSchedule(_id);
        uint256 _distributed = _schedule.distributed;
        // revoked
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        vesting.releaseAmount(_id, 100);

        _schedule = vesting.getSchedule(_id);
        assertEq(vesting.totalVestedAndUnclaimed(), totalVestedAndUnclaimed-_distributed);
        // error after trying again
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        vesting.releaseAmount(_id, 1);
    }

    function test_getVestingSummary() public {
        _fundsOwnerApprove();
        _mint();
        bytes32 _id1 = _createFirstSchedule();
        bytes32 _id2 = _createSecondSchedule();
        ITempleGoldVesting.VestingSchedule memory _schedule1 = vesting.getSchedule(_id1);
        ITempleGoldVesting.VestingSchedule memory _schedule2 = vesting.getSchedule(_id2);
        vm.warp(_schedule1.cliff);
        bytes32[] memory _ids = new bytes32[](2);
        _ids[0] = _id1;
        _ids[1] = _id2;
        ITempleGoldVesting.VestingSummary[] memory summary = vesting.getVestingSummary(_ids, _schedule1.start, uint32(block.timestamp));
        assertEq(summary[0].recipient, address(0));
        assertEq(summary[0].distributed, 0);
        assertEq(summary[0].vested, 0);
        assertEq(summary[0].vestedAtEnd, 0);
        assertEq(summary[1].distributed, 0);
        assertEq(summary[1].vested, 0);
        assertEq(summary[1].vestedAtEnd, 0);
        assertEq(summary[1].recipient, address(0));
        skip(1 seconds);
        vm.startPrank(alice);
        uint256 releasable = vesting.getReleasableAmount(_id1);
        vesting.release(_id1);
        uint32 endTime = uint32(block.timestamp + 90 weeks);
        summary = vesting.getVestingSummary(_ids, _schedule1.start, endTime);
        assertEq(summary[0].distributed, releasable);
        assertEq(summary[0].vested, vesting.getTotalVestedAt(_id1, uint32(block.timestamp)));
        assertEq(summary[0].vestedAtEnd, vesting.getTotalVestedAt(_id1, endTime));
        assertEq(summary[1].distributed, 0);
        assertEq(summary[1].vested, vesting.getTotalVestedAt(_id2, uint32(block.timestamp)));
        assertEq(summary[1].vestedAtEnd, vesting.getTotalVestedAt(_id2, endTime));
        vm.warp(_schedule2.cliff + 4 weeks);
        vm.startPrank(bob);
        uint256 bobReleasable = vesting.getReleasableAmount(_id2);
        vesting.release(_id2);
        summary = vesting.getVestingSummary(_ids, _schedule1.start, endTime);
        assertEq(summary[0].distributed, releasable); // same
        assertEq(summary[0].vested, vesting.getTotalVestedAt(_id1, uint32(block.timestamp)));
        assertEq(summary[0].vestedAtEnd, vesting.getTotalVestedAt(_id1, endTime));
        assertEq(summary[1].distributed, bobReleasable);
        assertEq(summary[1].vested, vesting.getTotalVestedAt(_id2, uint32(block.timestamp)));
        assertEq(summary[1].vestedAtEnd, vesting.getTotalVestedAt(_id2, endTime));
    }
}