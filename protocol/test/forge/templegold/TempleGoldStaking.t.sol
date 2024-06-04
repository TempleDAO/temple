pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// (tests/forge/templegold/TempleGoldStaking.t.sol)


import { TempleGoldCommon } from "./TempleGoldCommon.t.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";
import { TempleGold } from "contracts/templegold/TempleGold.sol";
import { TempleGoldStaking } from "contracts/templegold/TempleGoldStaking.sol";
import { ITempleGold } from "contracts/interfaces/templegold/ITempleGold.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { DaiGoldAuction } from "contracts/templegold/DaiGoldAuction.sol";
import { ITempleGoldStaking } from "contracts/interfaces/templegold/ITempleGoldStaking.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { TempleGoldStakingMock } from "contracts/fakes/templegold/TempleGoldStakingMock.sol";

contract TempleGoldStakingTestBase is TempleGoldCommon {
    event Paused(address account);
    event GoldDistributionNotified(uint256 amount, uint256 timestamp);
    event Unpaused(address account);
    event StakingProxySet(address stakingProxy);
    event Staked(address indexed staker, uint256 amount);
    event RewardPaid(address indexed staker, address toAddress, uint256 reward);
    event MigratorSet(address migrator);
    event Withdrawn(address indexed staker, address to, uint256 amount);
    event RewardDistributionCoolDownSet(uint160 cooldown);
    event DistributionStarterSet(address indexed starter);
    event HalfTimeSet(uint256 halfTime);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event VoteDelegateSet(address _delegate, bool _approved);
    event UserDelegateSet(address indexed user, address _delegate);
    event MinimumDelegationPeriodSet(uint32 _minimumPeriod);

    IERC20 public bidToken;
    IERC20 public bidToken2;
    DaiGoldAuction public daiGoldAuction;
    FakeERC20 public templeToken;
    TempleGoldStaking public staking;
    TempleGoldStakingMock public mockStaking;
    TempleGold public templeGold;

    function setUp() public {
        fork("arbitrum_one", forkBlockNumber);

        ITempleGold.InitArgs memory initArgs = _getTempleGoldInitArgs();

        templeGold = new TempleGold(initArgs);
        templeToken = new FakeERC20("Temple Token", "TEMPLE", executor, 1000 ether);
        staking = new TempleGoldStaking(rescuer, executor, address(templeToken), address(templeGold));
        mockStaking = new TempleGoldStakingMock(rescuer, executor, address(templeToken), address(templeGold), address(staking));
        vm.startPrank(executor);
        templeGold.authorizeContract(address(staking), true);
        bidToken = IERC20(daiToken);
        bidToken2 = IERC20(usdcToken);
        daiGoldAuction = new DaiGoldAuction(
            address(templeGold),
            address(bidToken),
            treasury,
            rescuer,
            executor
        );
        templeGold.setEscrow(address(daiGoldAuction));
        _configureTempleGold();
        vm.stopPrank();
    }

    function test_initialization() public {
        assertEq(staking.rescuer(), rescuer);
        assertEq(staking.executor(), executor);
        assertEq(address(staking.stakingToken()), address(templeToken));
        assertEq(address(staking.rewardToken()), address(templeGold));
    }

    function _configureTempleGold() private {
        ITempleGold.DistributionParams memory params;
        params.escrow = 60 ether;
        params.gnosis = 10 ether;
        params.staking = 30 ether;
        templeGold.setDistributionParams(params);
        ITempleGold.VestingFactor memory factor;
        factor.numerator = 2 ether;
        factor.denominator = 1000 ether;
        templeGold.setVestingFactor(factor);
        templeGold.setStaking(address(staking));
        // whitelist
        templeGold.authorizeContract(address(daiGoldAuction), true);
        templeGold.authorizeContract(address(staking), true);
        templeGold.authorizeContract(teamGnosis, true);
    }

    function _setHalftime(uint64 _halfTime) internal {
        vm.startPrank(executor);
        staking.setHalfTime(_halfTime);
        vm.stopPrank();
    }
    
    function _setMinimumDelegationPeriod(uint32 _period) internal {
        vm.startPrank(executor);
        staking.setDelegationMinimumPeriod(_period);
        vm.stopPrank();
    }
}

contract TempleGoldStakingAccessTest is TempleGoldStakingTestBase {
    function test_access_setDistributionStarter() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        staking.setDistributionStarter(alice);
    }

    function test_access_setMigrator() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        staking.setMigrator(alice);
    }

    function test_access_setRewardDistributionCoolDown() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        staking.setRewardDistributionCoolDown(10);
    }

    function test_access_setHalfTime() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        staking.setHalfTime(10);
    }

    function test_access_pause() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        staking.pause();
    }

    function test_access_unpause() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        staking.unpause();
    }

    function test_access_setDelegationMinimumPeriod() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        staking.setDelegationMinimumPeriod(10 seconds);
    }
}

contract TempleGoldStakingTest is TempleGoldStakingTestBase {
    function test_pauseUnpause_staking() public {
        /// @dev testing approve when not paused
        // testing not when paused
        vm.startPrank(executor);
        vm.expectEmit(address(staking));
        emit Paused(executor);
        staking.pause();
        vm.expectEmit(address(staking));
        emit Unpaused(executor);
        staking.unpause();
    }
    function test_setDistributionStarter() public {
        vm.startPrank(executor);
        /// @dev address(0) is valid, for anyone to call distribute
        vm.expectEmit(address(staking));
        emit DistributionStarterSet(alice);
        staking.setDistributionStarter(alice);

        assertEq(staking.distributionStarter(), alice);
        vm.expectEmit(address(staking));
        emit DistributionStarterSet(address(0));
        staking.setDistributionStarter(address(0));

        assertEq(staking.distributionStarter(), address(0));
    }

    function test_setMigrator() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        staking.setMigrator(address(0));

        vm.expectEmit(address(staking));
        emit MigratorSet(alice);
        staking.setMigrator(alice);
        assertEq(staking.migrator(), alice);
    }

    function test_setRewardsDistributionCooldown() public {
        vm.startPrank(executor);
        vm.expectEmit(address(staking));
        emit RewardDistributionCoolDownSet(10 seconds);
        staking.setRewardDistributionCoolDown(10 seconds);
        assertEq(staking.rewardDistributionCoolDown(), 10 seconds);

        vm.expectEmit(address(staking));
        emit RewardDistributionCoolDownSet(1 minutes);
        staking.setRewardDistributionCoolDown(1 minutes);
        assertEq(staking.rewardDistributionCoolDown(), 1 minutes);
    }

    function test_setHalftime() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        staking.setHalfTime(0);

        vm.expectEmit(address(staking));
        emit HalfTimeSet(2 days);
        staking.setHalfTime(2 days);
        assertEq(staking.halfTime(), 2 days);

        vm.expectEmit(address(staking));
        emit HalfTimeSet(4 days);
        staking.setHalfTime(4 days);
        assertEq(staking.halfTime(), 4 days);
    }

    function test_setDelegationMinimumPeriod() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        staking.setDelegationMinimumPeriod(0);

        uint32 _minimumPeriod = 90 days;
        vm.expectEmit(address(staking));
        emit MinimumDelegationPeriodSet(_minimumPeriod); 
        staking.setDelegationMinimumPeriod(_minimumPeriod);
        assertEq(staking.minimumDelegationPeriod(), _minimumPeriod);
    }

    function test_migrateWithdraw_tgldStaking() public {
        vm.startPrank(executor);
        staking.setMigrator(alice);
   
        // bob stakes
        vm.startPrank(bob);
        deal(address(templeToken), bob, 1000 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(100 ether);

        // invalid access
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        staking.migrateWithdraw(bob);
        uint256 aliceTempleBalance = templeToken.balanceOf(alice);
        uint256 bobGoldBalance = templeGold.balanceOf(bob);
        // distribute rewards to earn
        vm.warp(block.timestamp + 2 days);
        staking.distributeRewards();
        uint256 bobEarned = staking.earned(bob);
        vm.startPrank(alice);
        // invalid staker
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        staking.migrateWithdraw(address(0));
        // zero stake
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        staking.migrateWithdraw(unauthorizedUser);

        vm.expectEmit(address(staking));
        emit Withdrawn(bob, alice, 100 ether);
        staking.migrateWithdraw(bob);
        assertEq(templeToken.balanceOf(alice), aliceTempleBalance + 100 ether);
        assertEq(templeGold.balanceOf(bob), bobGoldBalance + bobEarned);
    }

    function test_migrateWithdraw_end_to_end() public {
        vm.startPrank(executor);
        staking.setMigrator(address(mockStaking));

        // some stakes
        uint256 stakeAmount = 100 ether;
        deal(address(templeToken), bob, 1000 ether, true);
        deal(address(templeToken), alice, 1000 ether, true);
        vm.startPrank(bob);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(stakeAmount);
        vm.startPrank(alice);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(stakeAmount);
        assertEq(staking.balanceOf(alice), stakeAmount);
        assertEq(staking.balanceOf(bob), stakeAmount);
        assertEq(templeToken.balanceOf(address(staking)), 2*stakeAmount);

        // distribute rewards
        vm.warp(block.timestamp + 2 days);
        staking.distributeRewards();
        vm.warp(block.timestamp + 2 days);
        uint256 bobEarned = staking.earned(bob);
        uint256 aliceEarned = staking.earned(alice);

        // migrate withdraw
        mockStaking.migrateFromPreviousStaking();
        assertEq(staking.balanceOf(alice), 0);
        assertEq(staking.earned(alice), 0);
        assertEq(mockStaking.balanceOf(alice), stakeAmount);
        assertEq(templeGold.balanceOf(alice), aliceEarned);

        vm.startPrank(bob);
        mockStaking.migrateFromPreviousStaking();
        assertEq(staking.balanceOf(bob), 0);
        assertEq(staking.earned(bob), 0);
        assertEq(mockStaking.balanceOf(bob), stakeAmount);
        assertEq(templeGold.balanceOf(bob), bobEarned);
    }

    function test_distributeRewards() public {
        _setVestingFactor(templeGold);
        skip(1 days);
        vm.startPrank(executor);
        staking.setDistributionStarter(alice);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        staking.distributeRewards();
        
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(ITempleGoldStaking.NoStaker.selector));
        staking.distributeRewards();

        deal(address(templeToken), bob, 1000 ether, true);
        vm.startPrank(bob);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(1 ether);

        vm.startPrank(alice);
        uint256 rewardAmount = staking.nextRewardAmount();
        ITempleGoldStaking.Reward memory rewardDataBefore = staking.getRewardData();
        assertEq(rewardDataBefore.rewardRate, 0);
        assertEq(rewardDataBefore.lastUpdateTime, 0);
        assertEq(rewardDataBefore.periodFinish, 0);
        assertEq(staking.rewardPeriodFinish(), 0);
        ITempleGold.DistributionParams memory params = templeGold.getDistributionParameters();
        uint256 mintAmount = templeGold.getMintAmount();
        // amount for staking 
        mintAmount = mintAmount * params.staking / 100 ether;
        vm.expectEmit(address(staking));
        emit GoldDistributionNotified(mintAmount, block.timestamp);
        staking.distributeRewards();
        uint256 rewardBalance = templeGold.balanceOf(address(staking));
        assertGt(rewardBalance, rewardAmount);
        assertEq(staking.lastRewardNotificationTimestamp(), block.timestamp);
        // reward params were set
        uint256 rewardRate = rewardBalance / 7 days;
        ITempleGoldStaking.Reward memory rewardData = staking.getRewardData();
        assertEq(rewardData.rewardRate, rewardRate);
        assertEq(rewardData.lastUpdateTime, block.timestamp);
        assertEq(rewardData.periodFinish, block.timestamp + 7 days);

        // reward distribution cooldown is not zero
        vm.startPrank(executor);
        uint160 cooldown = 1 days;
        staking.setRewardDistributionCoolDown(cooldown);
        assertEq(staking.rewardDistributionCoolDown(), cooldown);
        // anyone can call
        staking.setDistributionStarter(address(0));
        vm.expectRevert(abi.encodeWithSelector(ITempleGoldStaking.CannotDistribute.selector));
        staking.distributeRewards();

        vm.warp(block.timestamp + cooldown + 1);
        staking.setRewardDistributionCoolDown(0);

        // mint so there's nothing for next transaction
        ITempleGold.VestingFactor memory _factor = _getVestingFactor();
        _factor.numerator = 99 ether;
        _factor.denominator = 100 ether;
        templeGold.setVestingFactor(_factor);
        vm.warp(block.timestamp + 10 days);
        templeGold.mint();
        // there is still old rewards to distribute
        assertGt(staking.nextRewardAmount(), 0);
        staking.distributeRewards();
        assertEq(staking.nextRewardAmount(), 0);
        // zero rewards minted, so no reward notification from TGLD. this is also for TempleGold max supply case.
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        staking.distributeRewards();
    }

    function test_distributeGold_staking() public {
        _setVestingFactor(templeGold);
        skip(1 days);
        uint256 mintAmount = templeGold.getMintAmount();
        uint256 stakingAmount = 30 * mintAmount / 100;
        staking.distributeGold();
        assertEq(templeGold.balanceOf(address(staking)), stakingAmount);
        vm.warp(block.timestamp + 103 days);
        mintAmount = templeGold.getMintAmount();
        uint256 stakingAmount2 = 30 * mintAmount / 100;
        staking.distributeGold();
        assertGt(stakingAmount2, stakingAmount);
        assertEq(templeGold.balanceOf(address(staking)), stakingAmount2+stakingAmount);
    }

    function test_notifyDistribution_revert() public {
        vm.startPrank(alice);
        uint256 amount = 1000 ether;
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        staking.notifyDistribution(amount);
    }

    function test_getDelegateUsers() public {
        vm.startPrank(mike);
        staking.setSelfAsDelegate(true);
        vm.startPrank(alice);
        staking.setUserVoteDelegate(mike);
        address[] memory users = staking.getDelegateUsers(mike);
        assertEq(users[0], alice);
        vm.startPrank(bob);
        staking.setUserVoteDelegate(mike);
        users = staking.getDelegateUsers(mike);
        assertEq(users[0], alice);
        assertEq(users[1], bob);
    }

    function test_recoverToken_tgld_staking() public {
        uint256 amount = 100 ether;
        deal(daiToken, address(staking), amount, true);

        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        staking.recoverToken(address(templeGold), alice, amount);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        staking.recoverToken(address(templeToken), alice, amount);

        vm.expectEmit();
        emit CommonEventsAndErrors.TokenRecovered(alice, daiToken, amount);

        staking.recoverToken(daiToken, alice, amount);
        assertEq(IERC20(daiToken).balanceOf(alice), amount);
        assertEq(IERC20(daiToken).balanceOf(address(staking)), 0);
    }

    function test_stake_tgldStaking() public {
        uint64 halfTime = 4 weeks;
        _setHalftime(halfTime);
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        staking.stake(0);

        uint256 ts = block.timestamp;
        // beginning of week
        uint256 t = ts / WEEK_LENGTH * WEEK_LENGTH;
        vm.warp(t);
        uint256 stakeAmount = 1 ether;
        deal(address(templeToken), alice, 100 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        vm.expectEmit(address(staking));
        emit Staked(alice, stakeAmount);
        staking.stake(stakeAmount);

        assertEq(staking.balanceOf(alice), stakeAmount);
        // uint256 weight = stakeAmount * t / (t + halfTime);
        /// @dev Vote weights are always evaluated at the end of last week
        assertEq(staking.getVoteWeight(alice), 0);
        // middle of the week. still 0 vote weight. 
        // reuse variable
        ts = t + WEEK_LENGTH /2;
        vm.warp(t);
        assertEq(staking.getVoteWeight(alice), 0);
        // beginning of next week
        t += WEEK_LENGTH;
        vm.warp(t);
        assertEq(staking.getVoteWeight(alice), stakeAmount / 5);
        t += WEEK_LENGTH;
        vm.warp(t);
        assertEq(staking.getVoteWeight(alice), stakeAmount / 3);
        t += WEEK_LENGTH;
        vm.warp(t);
        t += WEEK_LENGTH;
        vm.warp(t);
        // after 4 weeks (halfTime), vote weight is half of initial stake amount
        assertEq(staking.getVoteWeight(alice), stakeAmount / 2);
        /// @dev see test_vote_weight for more tests on vote weight

        // can stake for others
        vm.startPrank(bob);
        deal(address(templeToken), bob, 100 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        uint256 newStakeAmount = 10 ether;
        vm.startPrank(executor);
        staking.pause();
        vm.expectRevert(abi.encodeWithSelector(Pausable.EnforcedPause.selector));
        staking.stakeFor(alice, newStakeAmount);
        staking.unpause();
        vm.startPrank(bob);
        vm.expectEmit(address(staking));
        emit Staked(alice, newStakeAmount);
        staking.stakeFor(alice, newStakeAmount);
        assertEq(staking.balanceOf(alice), newStakeAmount+stakeAmount);
    }

    function test_getReward_tgldStaking() public {
        vm.warp(block.timestamp + 3 days);
        templeGold.mint();
        
        vm.startPrank(alice);
        uint256 amount = 10 ether;
        deal(address(templeToken), alice, 100 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(amount);

        vm.warp(staking.lastRewardNotificationTimestamp() + staking.rewardDistributionCoolDown() + 1);
        staking.distributeRewards();

        uint256 aliceTempleGoldBalance = templeGold.balanceOf(alice);
        uint256 claimable = staking.earned(alice);
        staking.getReward(alice);
        assertEq(templeGold.balanceOf(alice), aliceTempleGoldBalance + claimable);
    }

    function test_withdraw_tgldStaking() public {
        uint64 halfTime = 4 weeks;
        _setHalftime(halfTime);
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        staking.withdraw(0, true);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InsufficientBalance.selector, address(templeToken), 1, 0));
        staking.withdraw(1, true);

        deal(address(templeToken), alice, 1000 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(100 ether);
        vm.expectEmit(address(staking));
        emit Withdrawn(alice, alice, 40 ether);
        staking.withdraw(40 ether, false);
        assertEq(templeToken.balanceOf(alice), 940 ether);
        assertEq(staking.totalSupply(), 60 ether);
        vm.expectEmit(address(staking));
        emit Withdrawn(alice, alice, 60 ether);
        staking.withdrawAll(false);
        assertEq(templeToken.balanceOf(alice), 1000 ether);
        assertEq(staking.totalSupply(), 0);
        assertEq(staking.getVoteWeight(alice), 0);
        ITempleGoldStaking.AccountWeightParams memory _weight = staking.getAccountWeights(alice);
        assertEq(_weight.updateTime, block.timestamp);
        assertEq(_weight.stakeTime, 0);
    }

    function test_earned_getReward_tgldStaking() public {
        _setVestingFactor(templeGold);
        skip(1 days);
        vm.startPrank(alice);
        deal(address(templeToken), alice, 1000 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(100 ether);

        skip(1 days);
        staking.distributeRewards();
        uint256 stakingGoldBalance = templeGold.balanceOf(address(staking));
        assertEq(staking.earned(alice), 0);

        skip(1 days);
        uint256 rewardPerToken = staking.rewardPerToken();
        uint256 aliceEarned = (100 ether * rewardPerToken) / 1 ether;
        assertEq(staking.earned(alice), aliceEarned);

        skip(1 days);
        uint256 rewardPerToken2 = staking.rewardPerToken();
        aliceEarned = (100 ether * (rewardPerToken2 - rewardPerToken)) / 1 ether + aliceEarned;
        assertEq(staking.earned(alice), aliceEarned);

        vm.startPrank(bob);
        deal(address(templeToken), bob, 1000 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(100 ether);

        skip(1 days);
        uint256 rewardPerToken3 = staking.rewardPerToken();
        uint256 bobEarned = (100 ether * (rewardPerToken3-rewardPerToken2)) / 1 ether;
        assertEq(staking.earned(bob), bobEarned);

        // after 7 days all rewards should be distributed to stakers
        skip(4 days);
        uint256 rewardPerToken4 = staking.rewardPerToken();
        bobEarned = (100 ether * (rewardPerToken4-rewardPerToken3)) / 1 ether + bobEarned;
        aliceEarned = (100 ether * (rewardPerToken4-rewardPerToken2)) / 1 ether + aliceEarned;
        assertEq(staking.earned(bob), bobEarned);
        assertEq(staking.earned(alice), aliceEarned);
        assertApproxEqAbs(stakingGoldBalance, bobEarned+aliceEarned, 1e6);

        staking.getReward(alice);
        staking.getReward(bob);
        assertEq(templeGold.balanceOf(alice), aliceEarned);
        assertEq(templeGold.balanceOf(bob), bobEarned);

        vm.startPrank(executor);
        staking.setRewardDistributionCoolDown(1 hours);

        ITempleGoldStaking.Reward memory rdata = staking.getRewardData();
        uint256 balanceBefore = templeGold.balanceOf(address(staking));
        rdata = staking.getRewardData();
        staking.distributeRewards();
        uint256 remaining = uint256(rdata.periodFinish) - block.timestamp;
        uint256 leftover = remaining * rdata.rewardRate;
        // 0 leftover
        uint256 balanceAfter = templeGold.balanceOf(address(staking));
        uint256 rewardRate = uint216((balanceAfter - balanceBefore) / 7 days);
        rdata = staking.getRewardData();
        assertEq(rdata.rewardRate, rewardRate);

        // there's some leftover rewards. periodFinish not reached yet
        skip(1 days);
        remaining = uint256(rdata.periodFinish) - block.timestamp;
        leftover = remaining * rdata.rewardRate;
        balanceBefore = templeGold.balanceOf(address(staking));
        staking.distributeRewards();
        balanceAfter = templeGold.balanceOf(address(staking));
        rewardRate = uint216((balanceAfter - balanceBefore + leftover) / 7 days);
        rdata = staking.getRewardData();
        assertEq(rdata.rewardRate, rewardRate);
    }

    function test_vote_weight() public {
        uint256 half_time = WEEK_LENGTH / 4;
        vm.startPrank(executor);
        staking.setHalfTime(half_time);
        uint256 amount = 3 ether;
        // set time to `half_time` before end of a week
        uint256 ts = (block.timestamp / WEEK_LENGTH + 2) * WEEK_LENGTH - half_time;
        vm.warp(ts);

        // stake
        vm.startPrank(alice);
        deal(address(templeToken), alice, 100 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(amount);
        ts += 2 * half_time;
        vm.warp(ts);
        assertEq(staking.getVoteWeight(alice), amount / 2);

        // voting power doesnt change during the week
        ts += half_time;
        vm.warp(ts);
        assertEq(staking.getVoteWeight(alice), amount / 2);

        // but is increased the week after, `t = half_time+week = 5*half_time`
        ts += WEEK_LENGTH;
        vm.warp(ts);
        assertEq(staking.getVoteWeight(alice), amount * 5 / 6);
    }

    function test_vote_weight_multistake() public {
        uint256 half_time = WEEK_LENGTH / 4;
        vm.startPrank(executor);
        staking.setHalfTime(half_time);
        uint256 amount = 2 ether;

        deal(address(templeToken), alice, 100 ether, true);
        deal(address(templeToken), unauthorizedUser, 100 ether, true);
        deal(address(templeToken), bob, 100 ether, true);

        // set time to beginning of a week
        uint256 ts = (block.timestamp / WEEK_LENGTH + 1) * WEEK_LENGTH;
        vm.warp(ts);
        // stake ata the beginning of the week
        vm.startPrank(alice);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(amount);
        vm.startPrank(unauthorizedUser);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(amount);
        // bob stakes double at beginning of the week
        vm.startPrank(bob);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(2 * amount);
        vm.warp(ts + WEEK_LENGTH);
        uint256 lowVoteWeight = staking.getVoteWeight(alice);

        uint256 highVoteWeight = staking.getVoteWeight(bob);

        // unauthorizedUser stakes second time middle of the week
        vm.warp(ts + WEEK_LENGTH / 2);
        vm.startPrank(unauthorizedUser);
        staking.stake(amount);

        vm.warp(ts + WEEK_LENGTH);
        uint256 midVoteWeight = staking.getVoteWeight(unauthorizedUser);
        assertLt(lowVoteWeight, midVoteWeight);
        assertLt(lowVoteWeight, highVoteWeight);
    }

    function test_setSelfAsDelegate() public {
        vm.startPrank(executor);
        uint256 halfTime = 1 weeks;
        staking.setHalfTime(halfTime);
        uint256 ts = (block.timestamp / WEEK_LENGTH + 1) * WEEK_LENGTH - halfTime; 

        vm.startPrank(alice);
        vm.expectEmit(address(staking));
        emit VoteDelegateSet(alice, true);
        staking.setSelfAsDelegate(true);
        assertEq(staking.delegates(alice), true);

        // bob assigns alice as delegate
        vm.startPrank(bob);
        staking.setUserVoteDelegate(alice);
        // stake
        uint256 stakeAmount = 1 ether;
        deal(address(templeToken), bob, 100 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(stakeAmount);
        // warp to get some vote weight
        ts += halfTime;
        vm.warp(ts);
        uint256 aliceDelegatedVoteWeight = staking.getDelegatedVoteWeight(alice);
        assertEq(aliceDelegatedVoteWeight, staking.getVoteWeight(bob));

        vm.startPrank(alice);
        vm.expectEmit(address(staking));
        emit VoteDelegateSet(alice, false);
        staking.setSelfAsDelegate(false);
        assertEq(staking.delegates(alice), false);
        /// @dev vote weights are calculated from previous week
        assertEq(staking.getDelegatedVoteWeight(alice), aliceDelegatedVoteWeight);
        ts += WEEK_LENGTH; // following week
        vm.warp(ts);
        assertEq(staking.getDelegatedVoteWeight(alice), 0);

        // bob can assign to another delegate
        vm.startPrank(mike);
        staking.setSelfAsDelegate(true);
        vm.startPrank(bob);
        staking.setUserVoteDelegate(mike);
        assertEq(staking.userDelegates(bob), mike);

        // bob can assign to another delegate where previous delegate is still valid
        vm.startPrank(executor);
        staking.setUserVoteDelegate(mike);
        assertEq(staking.userDelegates(executor), mike);
        staking.setSelfAsDelegate(true);
        assertEq(staking.userDelegates(executor), executor);
        vm.startPrank(bob);
        staking.setUserVoteDelegate(executor);
        assertEq(staking.userDelegates(bob), executor);
        assertEq(staking.getDelegatedVoteWeight(executor), 0);
        // bob can stake. old delegate not affected
        staking.stake(stakeAmount);
        // has not started accumulating
        assertEq(staking.getDelegatedVoteWeight(executor), 0);
        skip(1 weeks);
        uint256 bobVoteWeight = staking.getVoteWeight(bob);
        assertEq(staking.getDelegatedVoteWeight(mike), 0);
        // bob own vote weight greater (started accumulating already)
        assertGt(bobVoteWeight, staking.getDelegatedVoteWeight(executor));
        // bob total stake is 2 * stakeAmount = 2 ether. After 1 week, executor vote weight is half
        assertEq(staking.getDelegatedVoteWeight(executor), stakeAmount);
        // bob can withdraw
        staking.withdrawAll(false);
        assertEq(staking.getDelegatedVoteWeight(mike), 0);
        // bob vote weight the same. same week
        assertEq(staking.getVoteWeight(bob), bobVoteWeight);
        assertEq(staking.getDelegatedVoteWeight(executor), stakeAmount);
        skip(1 weeks);
        assertEq(staking.getDelegatedVoteWeight(executor), 0);
        assertEq(staking.getVoteWeight(bob), 0);
    }

    function test_setSelfAsDelegate_user_weight_same_after_resetDelegation() public {
        uint64 _halfTime = 4 weeks;
        _setHalftime(_halfTime);
        uint256 ts = block.timestamp / WEEK_LENGTH * WEEK_LENGTH;
        vm.warp(ts);
        vm.startPrank(alice);
        deal(address(templeToken), alice, 100 ether, true);
        deal(address(templeToken), mike, 100 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        uint256 stakeAmount = 1 ether;
        staking.stake(stakeAmount);
        staking.setSelfAsDelegate(true);
        vm.startPrank(mike);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.setUserVoteDelegate(alice);
        staking.stake(stakeAmount);
        ts += 4 weeks;
        vm.warp(ts);
        uint256 aliceVoteWeight = staking.getVoteWeight(alice);
        assertEq(aliceVoteWeight, staking.getDelegatedVoteWeight(alice));
        // reset delegation but own vote weight is not affected
        vm.startPrank(alice);
        staking.setSelfAsDelegate(false);
        assertEq(staking.getVoteWeight(alice), aliceVoteWeight);
        assertEq(staking.getDelegatedVoteWeight(alice), 0);
    }

    function test_unsetUserVoteDelegate_remove_delegate_after_self_set_false() public {
        vm.startPrank(executor);
        uint256 halfTime = WEEK_LENGTH / 4;
        staking.setHalfTime(halfTime);

        vm.startPrank(alice);
        staking.setSelfAsDelegate(true);

        // bob assigns alice as delegate
        vm.startPrank(bob);
        staking.setUserVoteDelegate(alice);
        // stake
        uint256 stakeAmount = 1 ether;
        deal(address(templeToken), bob, 100 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(stakeAmount);
        // warp to get some vote weight
        skip(1 weeks);
        uint256 ownVoteWeight = staking.getVoteWeight(bob);
        assertEq(staking.getVoteWeight(bob), ownVoteWeight);
        assertEq(staking.getDelegatedVoteWeight(bob), 0);
        // reset self as delegate
        vm.startPrank(alice);
        staking.setSelfAsDelegate(false);
        assertEq(staking.getVoteWeight(bob), ownVoteWeight);
        assertEq(staking.getDelegatedVoteWeight(bob), 0);

        // bob unsets delegate
        vm.startPrank(bob);
        staking.unsetUserVoteDelegate();
        assertEq(staking.userDelegated(bob, alice), false);
        assertEq(staking.userDelegates(bob), address(0));
        // can withdraw
        staking.withdrawAll(true);
    }

    function test_getDelegatedVoteWeight() public {
        /// @dev see test_stake_delegate_vote_weight and test_withdraw_delegate_vote_weight
    }

    function test_setUserVoteDelegate() public {
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        staking.setUserVoteDelegate(address(0));

        vm.expectRevert(abi.encodeWithSelector(ITempleGoldStaking.InvalidDelegate.selector));
        staking.setUserVoteDelegate(bob);

        vm.startPrank(bob);
        staking.setSelfAsDelegate(true);
        vm.startPrank(alice);
        staking.setSelfAsDelegate(true);
        // todo check CannotDelegate() error
        vm.expectEmit(address(staking));
        emit UserDelegateSet(alice, bob);
        staking.setUserVoteDelegate(bob);

        assertEq(staking.userDelegated(alice, bob), true);
        assertEq(staking.userDelegates(alice), bob);

        // nothing happens. same delegate
        staking.setUserVoteDelegate(bob);
        assertEq(staking.userDelegates(alice), bob);

        /// @dev see test_stake_delegate_vote_weight for more

        // set to another delegate
        vm.startPrank(mike);
        staking.setSelfAsDelegate(true);
        vm.startPrank(alice);
        vm.expectEmit(address(staking));
        emit UserDelegateSet(alice, mike);
        staking.setUserVoteDelegate(mike);
        assertEq(staking.userDelegated(alice, bob), false);
        assertEq(staking.userDelegated(alice, mike), true);
        assertEq(staking.userDelegates(alice), mike);
        
        // check user withdraw time
        uint32 _delegationPeriod = 8 weeks;
        _setMinimumDelegationPeriod(_delegationPeriod);
        staking.setUserVoteDelegate(bob);
        vm.expectRevert(abi.encodeWithSelector(ITempleGoldStaking.CannotDelegate.selector));
        staking.setUserVoteDelegate(mike);
        vm.warp(block.timestamp + _delegationPeriod);
        staking.setUserVoteDelegate(mike);
        assertEq(staking.userDelegates(alice), mike);
        // same with unsetUserVoteDelegate
        staking.setUserVoteDelegate(bob);
        vm.expectRevert(abi.encodeWithSelector(ITempleGoldStaking.CannotDelegate.selector));
        staking.setUserVoteDelegate(mike);
        vm.warp(block.timestamp + _delegationPeriod);
        staking.unsetUserVoteDelegate();
        assertEq(staking.userDelegates(alice), address(0));
    }

    function test_setUserVoteDelegate_unsetUserVoteDelegate_delegationPeriod() public {
        uint64 _halfTime = 4 weeks;
        _setHalftime(_halfTime);
        uint32 _delegationPeriod = 8 weeks;
        _setMinimumDelegationPeriod(_delegationPeriod);
        vm.startPrank(bob);
        staking.setSelfAsDelegate(true);
        vm.startPrank(executor);
        staking.setSelfAsDelegate(true);
        vm.startPrank(mike);
        staking.setUserVoteDelegate(bob);
        vm.startPrank(alice);
        staking.setUserVoteDelegate(bob);

        uint256 ts = block.timestamp / WEEK_LENGTH * WEEK_LENGTH;
        uint256 t = ts;
        vm.warp(t);

        deal(address(templeToken), alice, 500 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(200 ether);
        uint32 withdrawTime = uint32(block.timestamp + _delegationPeriod);
        assertEq(staking.userWithdrawTimes(alice), withdrawTime);

        // change delegate after stake
        vm.expectRevert(abi.encodeWithSelector(ITempleGoldStaking.CannotDelegate.selector));
        staking.setUserVoteDelegate(executor);
        // withdraw after stake
        vm.expectRevert(abi.encodeWithSelector(ITempleGoldStaking.MinimumStakePeriod.selector));
        staking.withdrawAll(false);
        t += 5 weeks;
        vm.warp(t);
        uint256 nextWithdrawTime = withdrawTime + (_delegationPeriod / 3);
        staking.stake(100 ether);
        assertGt(staking.userWithdrawTimes(alice), withdrawTime);
        assertEq(staking.userWithdrawTimes(alice), nextWithdrawTime);
        // set to first withdraw time 
        t = withdrawTime;
        vm.warp(t);
        // can't withdraw at old withdraw time
        vm.expectRevert(abi.encodeWithSelector(ITempleGoldStaking.MinimumStakePeriod.selector));
        staking.withdrawAll(false);
        t = nextWithdrawTime;
        vm.warp(t);
        uint256 balanceBefore = templeToken.balanceOf(alice);
        staking.withdrawAll(false);
        assertEq(templeToken.balanceOf(alice), balanceBefore+300 ether);
        assertEq(staking.userWithdrawTimes(alice), 0);
        staking.unsetUserVoteDelegate();
        
        // no delegate before stake
        staking.stake(100 ether);
        assertEq(staking.userWithdrawTimes(alice), 0);
        staking.withdrawAll(false);
        
        // set delegate before stake
        staking.setUserVoteDelegate(executor);
        staking.stake(100 ether);
        withdrawTime = uint32(block.timestamp + _delegationPeriod);
        assertEq(staking.userWithdrawTimes(alice), withdrawTime);
        t = withdrawTime - 1;
        vm.warp(t);
        vm.expectRevert(abi.encodeWithSelector(ITempleGoldStaking.MinimumStakePeriod.selector));
        staking.withdrawAll(false);
        // set to withdraw time but don't withdraw and set another delegate
        t += 1;
        vm.warp(t);
        staking.setUserVoteDelegate(bob);
        assertEq(staking.userWithdrawTimes(alice), withdrawTime+_delegationPeriod);
        t = withdrawTime + _delegationPeriod;
        vm.warp(t);
        staking.withdrawAll(false);
        staking.unsetUserVoteDelegate();

        // stake a few times
        staking.stake(100 ether);
        staking.stake(100 ether);
        // set and unset
        staking.setUserVoteDelegate(executor);
        vm.expectRevert(abi.encodeWithSelector(ITempleGoldStaking.InvalidOperation.selector));
        staking.unsetUserVoteDelegate();
        vm.expectRevert(abi.encodeWithSelector(ITempleGoldStaking.MinimumStakePeriod.selector));
        staking.withdrawAll(false);
        t = staking.userWithdrawTimes(alice);
        vm.warp(t);
        staking.withdrawAll(false);
    }

    function test_setUserVoteDelegate_unsetUserVoteDelegate_delegationPeriod() public {
        uint64 _halfTime = 4 weeks;
        _setHalftime(_halfTime);
        uint32 _delegationPeriod = 8 weeks;
        _setMinimumDelegationPeriod(_delegationPeriod);
        vm.startPrank(bob);
        staking.setSelfAsDelegate(true);
        vm.startPrank(executor);
        staking.setSelfAsDelegate(true);
        vm.startPrank(mike);
        staking.setUserVoteDelegate(bob);
        vm.startPrank(alice);
        staking.setUserVoteDelegate(bob);

        uint256 ts = block.timestamp / WEEK_LENGTH * WEEK_LENGTH;
        uint256 t = ts;
        vm.warp(t);

        deal(address(templeToken), alice, 500 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(200 ether);
        uint32 withdrawTime = uint32(block.timestamp + _delegationPeriod);
        assertEq(staking.userWithdrawTimes(alice), withdrawTime);

        // change delegate after stake
        vm.expectRevert(abi.encodeWithSelector(ITempleGoldStaking.CannotDelegate.selector));
        staking.setUserVoteDelegate(executor);
        // withdraw after stake
        vm.expectRevert(abi.encodeWithSelector(ITempleGoldStaking.MinimumStakePeriod.selector));
        staking.withdrawAll(false);
        t += 5 weeks;
        vm.warp(t);
        uint256 nextWithdrawTime = withdrawTime + (_delegationPeriod / 3);
        staking.stake(100 ether);
        assertGt(staking.userWithdrawTimes(alice), withdrawTime);
        assertEq(staking.userWithdrawTimes(alice), nextWithdrawTime);
        // set to first withdraw time 
        t = withdrawTime;
        vm.warp(t);
        // can't withdraw at old withdraw time
        vm.expectRevert(abi.encodeWithSelector(ITempleGoldStaking.MinimumStakePeriod.selector));
        staking.withdrawAll(false);
        t = nextWithdrawTime;
        vm.warp(t);
        uint256 balanceBefore = templeToken.balanceOf(alice);
        staking.withdrawAll(false);
        assertEq(templeToken.balanceOf(alice), balanceBefore+300 ether);
        assertEq(staking.userWithdrawTimes(alice), 0);
        staking.unsetUserVoteDelegate();
        
        // no delegate before stake
        staking.stake(100 ether);
        assertEq(staking.userWithdrawTimes(alice), 0);
        staking.withdrawAll(false);
        
        // set delegate before stake
        staking.setUserVoteDelegate(executor);
        staking.stake(100 ether);
        withdrawTime = uint32(block.timestamp + _delegationPeriod);
        assertEq(staking.userWithdrawTimes(alice), withdrawTime);
        t = withdrawTime - 1;
        vm.warp(t);
        vm.expectRevert(abi.encodeWithSelector(ITempleGoldStaking.MinimumStakePeriod.selector));
        staking.withdrawAll(false);
        // set to withdraw time but don't withdraw and set another delegate
        t += 1;
        vm.warp(t);
        staking.setUserVoteDelegate(bob);
        assertEq(staking.userWithdrawTimes(alice), withdrawTime+_delegationPeriod);
        t = withdrawTime + _delegationPeriod;
        vm.warp(t);
        staking.withdrawAll(false);
        staking.unsetUserVoteDelegate();

        // stake a few times
        staking.stake(100 ether);
        staking.stake(100 ether);
        // set and unset
        staking.setUserVoteDelegate(executor);
        vm.expectRevert(abi.encodeWithSelector(ITempleGoldStaking.InvalidOperation.selector));
        staking.unsetUserVoteDelegate();
        vm.expectRevert(abi.encodeWithSelector(ITempleGoldStaking.MinimumStakePeriod.selector));
        staking.withdrawAll(false);
        t = staking.userWithdrawTimes(alice);
        vm.warp(t);
        staking.withdrawAll(false);
    }

    function test_check_finding_15() public {
        uint64 _halfTime = 7 days;
        _setHalftime(_halfTime);
        vm.startPrank(bob);
        staking.setSelfAsDelegate(true);
        // vm.startPrank(mike);
        // staking.setUserVoteDelegate(bob);
        vm.startPrank(alice);
        staking.setUserVoteDelegate(bob);
        uint256 ts = block.timestamp / WEEK_LENGTH * WEEK_LENGTH;
        uint256 t = ts;
        vm.warp(t);
        deal(address(templeToken), alice, 200 ether, true);
        deal(address(templeToken), mike, 200 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(200 ether);

        t += 2 * WEEK_LENGTH;
        vm.warp(t);
        assertEq(staking.getDelegatedVoteWeight(bob), 133333333333333333333);
        vm.startPrank(mike);
        _approve(address(templeToken), address(staking), type(uint).max);
        ITempleGoldStaking.AccountWeightParams memory _weight = staking.getAccountWeights(bob);
        assertEq(_weight.stakeTime, 0);
        staking.stake(100 ether);
        // stake time is 0 after stake
        _weight = staking.getAccountWeights(bob);
        assertEq(_weight.stakeTime, 0);
        // delegate to bob after stake
        staking.setUserVoteDelegate(bob);
        // stake time incrases after delegation
        _weight = staking.getAccountWeights(bob);
        assertEq(_weight.stakeTime, 483840);
        assertEq(staking.getDelegatedVoteWeight(bob), 133333333333333333333);
        staking.unsetUserVoteDelegate();
        // bob stake time remains the same after reset delegation from mike
        _weight = staking.getAccountWeights(bob);
        assertEq(_weight.stakeTime, 483840);
        // same week
        assertEq(staking.getDelegatedVoteWeight(bob), 133333333333333333333);
        t += WEEK_LENGTH;
        vm.warp(t);
        _weight = staking.getAccountWeights(bob);
        assertEq(_weight.stakeTime, 483840);
        // vote power reduces by 4761904761904761905 (4.7619e18) which is 3.57% of previous vote power
        // even after withdrawing 100 ether, which is 33% of total delegated votes
        assertEq(staking.getDelegatedVoteWeight(bob), 128571428571428571428);
        t += WEEK_LENGTH;
        vm.warp(t);
        // increases because it's following week
        assertEq(staking.getDelegatedVoteWeight(bob), 147368421052631578947);
        _weight = staking.getAccountWeights(bob);
        assertEq(_weight.stakeTime, 483840);
        // delegate and undelegate a couple of time to check if stakeTime reduces
        staking.setUserVoteDelegate(bob);
        // stake time for bob increases after delegation
        _weight = staking.getAccountWeights(bob);
        assertEq(_weight.stakeTime, 583944);
        staking.unsetUserVoteDelegate();
        _weight = staking.getAccountWeights(bob);
        assertEq(_weight.stakeTime, 583944);
        assertEq(staking.getDelegatedVoteWeight(bob), 147368421052631578947);

        staking.setUserVoteDelegate(bob);
        // stake time reduced after delegation
        _weight = staking.getAccountWeights(bob);
        assertEq(_weight.stakeTime, 294510);
        staking.unsetUserVoteDelegate();
        assertEq(staking.getDelegatedVoteWeight(bob), 147368421052631578947);
        _weight = staking.getAccountWeights(bob);
        assertEq(_weight.stakeTime, 294510);
        t += WEEK_LENGTH;
        vm.warp(t);
        assertEq(staking.getDelegatedVoteWeight(bob), 119580349841434469553);
        _weight = staking.getAccountWeights(bob);
        assertEq(_weight.stakeTime, 294510);
    }

    function test_setUserVoteDelegate_unsetUserVoteDelegate_delegationPeriod() public {
        uint64 _halfTime = 4 weeks;
        _setHalftime(_halfTime);
        uint32 _delegationPeriod = 8 weeks;
        _setMinimumDelegationPeriod(_delegationPeriod);
        vm.startPrank(bob);
        staking.setSelfAsDelegate(true);
        vm.startPrank(executor);
        staking.setSelfAsDelegate(true);
        vm.startPrank(mike);
        staking.setUserVoteDelegate(bob);
        vm.startPrank(alice);
        staking.setUserVoteDelegate(bob);

        uint256 ts = block.timestamp / WEEK_LENGTH * WEEK_LENGTH;
        uint256 t = ts;
        vm.warp(t);

        deal(address(templeToken), alice, 500 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(200 ether);
        uint32 withdrawTime = uint32(block.timestamp + _delegationPeriod);
        assertEq(staking.userWithdrawTimes(alice), withdrawTime);

        // change delegate after stake
        vm.expectRevert(abi.encodeWithSelector(ITempleGoldStaking.CannotDelegate.selector));
        staking.setUserVoteDelegate(executor);
        // withdraw after stake
        vm.expectRevert(abi.encodeWithSelector(ITempleGoldStaking.MinimumStakePeriod.selector));
        staking.withdrawAll(false);
        t += 5 weeks;
        vm.warp(t);
        uint256 nextWithdrawTime = withdrawTime + (_delegationPeriod / 3);
        staking.stake(100 ether);
        assertGt(staking.userWithdrawTimes(alice), withdrawTime);
        assertEq(staking.userWithdrawTimes(alice), nextWithdrawTime);
        // set to first withdraw time 
        t = withdrawTime;
        vm.warp(t);
        // can't withdraw at old withdraw time
        vm.expectRevert(abi.encodeWithSelector(ITempleGoldStaking.MinimumStakePeriod.selector));
        staking.withdrawAll(false);
        t = nextWithdrawTime;
        vm.warp(t);
        uint256 balanceBefore = templeToken.balanceOf(alice);
        staking.withdrawAll(false);
        assertEq(templeToken.balanceOf(alice), balanceBefore+300 ether);
        assertEq(staking.userWithdrawTimes(alice), 0);
        staking.unsetUserVoteDelegate();
        
        // no delegate before stake
        staking.stake(100 ether);
        assertEq(staking.userWithdrawTimes(alice), 0);
        staking.withdrawAll(false);
        
        // set delegate before stake
        staking.setUserVoteDelegate(executor);
        staking.stake(100 ether);
        withdrawTime = uint32(block.timestamp + _delegationPeriod);
        assertEq(staking.userWithdrawTimes(alice), withdrawTime);
        t = withdrawTime - 1;
        vm.warp(t);
        vm.expectRevert(abi.encodeWithSelector(ITempleGoldStaking.MinimumStakePeriod.selector));
        staking.withdrawAll(false);
        // set to withdraw time but don't withdraw and set another delegate
        t += 1;
        vm.warp(t);
        staking.setUserVoteDelegate(bob);
        assertEq(staking.userWithdrawTimes(alice), withdrawTime+_delegationPeriod);
        t = withdrawTime + _delegationPeriod;
        vm.warp(t);
        staking.withdrawAll(false);
        staking.unsetUserVoteDelegate();

        // stake a few times
        staking.stake(100 ether);
        staking.stake(100 ether);
        // set and unset
        staking.setUserVoteDelegate(executor);
        vm.expectRevert(abi.encodeWithSelector(ITempleGoldStaking.InvalidOperation.selector));
        staking.unsetUserVoteDelegate();
        vm.expectRevert(abi.encodeWithSelector(ITempleGoldStaking.MinimumStakePeriod.selector));
        staking.withdrawAll(false);
        t = staking.userWithdrawTimes(alice);
        vm.warp(t);
        staking.withdrawAll(false);
    }

    function test_check_finding_15() public {
        uint64 _halfTime = 7 days;
        _setHalftime(_halfTime);
        vm.startPrank(bob);
        staking.setSelfAsDelegate(true);
        // vm.startPrank(mike);
        // staking.setUserVoteDelegate(bob);
        vm.startPrank(alice);
        staking.setUserVoteDelegate(bob);
        uint256 ts = block.timestamp / WEEK_LENGTH * WEEK_LENGTH;
        uint256 t = ts;
        vm.warp(t);
        deal(address(templeToken), alice, 200 ether, true);
        deal(address(templeToken), mike, 200 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(200 ether);

        t += 2 * WEEK_LENGTH;
        vm.warp(t);
        assertEq(staking.getDelegatedVoteWeight(bob), 133333333333333333333);
        vm.startPrank(mike);
        _approve(address(templeToken), address(staking), type(uint).max);
        ITempleGoldStaking.AccountWeightParams memory _weight = staking.getAccountWeights(bob);
        assertEq(_weight.stakeTime, 0);
        staking.stake(100 ether);
        // stake time is 0 after stake
        _weight = staking.getAccountWeights(bob);
        assertEq(_weight.stakeTime, 0);
        // delegate to bob after stake
        staking.setUserVoteDelegate(bob);
        // stake time incrases after delegation
        _weight = staking.getAccountWeights(bob);
        assertEq(_weight.stakeTime, 483840);
        assertEq(staking.getDelegatedVoteWeight(bob), 133333333333333333333);
        staking.unsetUserVoteDelegate();
        // bob stake time remains the same after reset delegation from mike
        _weight = staking.getAccountWeights(bob);
        assertEq(_weight.stakeTime, 483840);
        // same week
        assertEq(staking.getDelegatedVoteWeight(bob), 133333333333333333333);
        t += WEEK_LENGTH;
        vm.warp(t);
        _weight = staking.getAccountWeights(bob);
        assertEq(_weight.stakeTime, 483840);
        // vote power reduces by 4761904761904761905 (4.7619e18) which is 3.57% of previous vote power
        // even after withdrawing 100 ether, which is 33% of total delegated votes
        assertEq(staking.getDelegatedVoteWeight(bob), 128571428571428571428);
        t += WEEK_LENGTH;
        vm.warp(t);
        // increases because it's following week
        assertEq(staking.getDelegatedVoteWeight(bob), 147368421052631578947);
        _weight = staking.getAccountWeights(bob);
        assertEq(_weight.stakeTime, 483840);
        // delegate and undelegate a couple of time to check if stakeTime reduces
        staking.setUserVoteDelegate(bob);
        // stake time for bob increases after delegation
        _weight = staking.getAccountWeights(bob);
        assertEq(_weight.stakeTime, 583944);
        staking.unsetUserVoteDelegate();
        _weight = staking.getAccountWeights(bob);
        assertEq(_weight.stakeTime, 583944);
        assertEq(staking.getDelegatedVoteWeight(bob), 147368421052631578947);

        staking.setUserVoteDelegate(bob);
        // stake time reduced after delegation
        _weight = staking.getAccountWeights(bob);
        assertEq(_weight.stakeTime, 294510);
        staking.unsetUserVoteDelegate();
        assertEq(staking.getDelegatedVoteWeight(bob), 147368421052631578947);
        _weight = staking.getAccountWeights(bob);
        assertEq(_weight.stakeTime, 294510);
        t += WEEK_LENGTH;
        vm.warp(t);
        assertEq(staking.getDelegatedVoteWeight(bob), 119580349841434469553);
        _weight = staking.getAccountWeights(bob);
        assertEq(_weight.stakeTime, 294510);
    }

    function test_stake_delegate_vote_weight() public {
        vm.startPrank(bob);
        staking.setSelfAsDelegate(true);
        vm.startPrank(executor);
        staking.setSelfAsDelegate(true);
        uint256 halfTime = WEEK_LENGTH / 4;
        staking.setHalfTime(halfTime);
        // set time to `half_time` before end of a week
        uint256 ts = (block.timestamp / WEEK_LENGTH + 2) * WEEK_LENGTH - halfTime;
        vm.warp(ts);

        vm.startPrank(alice);
        // set delegate
        staking.setUserVoteDelegate(bob);
        vm.startPrank(mike);
        staking.setUserVoteDelegate(bob);
        uint256 stakeAmount = 3 ether;
        // stake
        deal(address(templeToken), alice, 100 ether, true);
        deal(address(templeToken), mike, 100 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(stakeAmount);
        vm.startPrank(alice);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(stakeAmount);

        ts += 2 * halfTime;
        vm.warp(ts);
        assertEq(staking.getVoteWeight(alice), stakeAmount / 2);
        // delegate weight is 2x (alice + mike)
        assertEq(staking.getDelegatedVoteWeight(bob), stakeAmount);
        assertEq(staking.getVoteWeight(bob), 0);

        // voting power doesnt change during the week
        ts += halfTime;
        vm.warp(ts);
        assertEq(staking.getVoteWeight(alice), stakeAmount / 2);
        assertEq(staking.getDelegatedVoteWeight(bob), stakeAmount);
        assertEq(staking.getVoteWeight(bob), 0);

        // but is increased the week after, `t = half_time+week = 5*half_time`
        ts += WEEK_LENGTH;
        vm.warp(ts);
        assertEq(staking.getVoteWeight(alice), stakeAmount * 5 / 6);
        assertEq(staking.getDelegatedVoteWeight(bob), stakeAmount * 5 / 3);
        assertEq(staking.getVoteWeight(bob), 0);

        // alice change delegate and check vote weight of old delegate
        staking.setUserVoteDelegate(executor);
        // vote weight now of delegate is just from mike
        ts += WEEK_LENGTH;
        vm.warp(ts);
        assertEq(staking.getDelegatedVoteWeight(bob), stakeAmount * 9 / 10);
        assertEq(staking.getVoteWeight(mike), stakeAmount * 9 / 10);

        // set delegate to false
        vm.startPrank(bob);
        staking.setSelfAsDelegate(false);
        // same week. using previous week vote weight
        assertEq(staking.getDelegatedVoteWeight(bob), stakeAmount * 9 / 10);
        // alice vote weight same increase with increased time
        assertEq(staking.getVoteWeight(alice), stakeAmount * 9 / 10);

        // alice self delegates and vote weight is not double
        vm.startPrank(alice);
        staking.setSelfAsDelegate(true);
        staking.setUserVoteDelegate(alice);
        assertEq(staking.userDelegates(alice), alice);
        // no delegatees 
        assertEq(staking.getDelegatedVoteWeight(alice), 0);
        assertEq(staking.getVoteWeight(alice), stakeAmount * 9 / 10);
    }

    function test_withdraw_delegate_vote_weight() public {
        uint64 halfTime = 4 weeks;
        _setHalftime(halfTime);
        uint256 ts = block.timestamp / WEEK_LENGTH * WEEK_LENGTH;
        vm.startPrank(bob);
        staking.setSelfAsDelegate(true);
        vm.startPrank(executor);
        staking.setSelfAsDelegate(true);
        vm.warp(ts);

        vm.startPrank(alice);
        // set delegate
        staking.setUserVoteDelegate(bob);
        vm.startPrank(mike);
        staking.setUserVoteDelegate(bob);
        uint256 stakeAmount = 3 ether;

         // stake
        deal(address(templeToken), alice, 100 ether, true);
        deal(address(templeToken), mike, 100 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(stakeAmount);
        vm.startPrank(alice);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(stakeAmount);

        // warp to halftime
        ts += WEEK_LENGTH * 4;
        vm.warp(ts);
        assertEq(staking.getVoteWeight(alice), stakeAmount / 2);
        // 2 * stakeAmount is total
        assertEq(staking.getDelegatedVoteWeight(bob), stakeAmount);

        // alice withdraws
        staking.withdraw(stakeAmount, true);
        // still same week
        assertEq(staking.getDelegatedVoteWeight(bob), stakeAmount);
        ts += WEEK_LENGTH;
        vm.warp(ts);
        // minus withdraw amount plus 7 days extra vote weights
        assertEq(staking.getDelegatedVoteWeight(bob), stakeAmount * 5 / 9);
        assertEq(staking.getVoteWeight(alice), 0);

        // mike withdraws
        vm.startPrank(mike);
        staking.withdraw(stakeAmount, true);
        // same week
        assertEq(staking.getDelegatedVoteWeight(bob), stakeAmount * 5 / 9);
        assertEq(staking.getVoteWeight(mike), stakeAmount * 5 / 9);
        ts += WEEK_LENGTH;
        vm.warp(ts);
        assertEq(staking.getDelegatedVoteWeight(bob), 0);
        assertEq(staking.getVoteWeight(mike), 0);
    }

    function test_unsetUserVoteDelegate_staking() public {
        vm.startPrank(bob);
        staking.setSelfAsDelegate(true);
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(ITempleGoldStaking.InvalidDelegate.selector));
        staking.unsetUserVoteDelegate();

        staking.setUserVoteDelegate(bob);
        assertEq(staking.userDelegates(alice), bob);
        vm.expectEmit(address(staking));
        emit UserDelegateSet(alice, address(0));
        staking.unsetUserVoteDelegate();
        assertEq(staking.userDelegates(alice), address(0));

        vm.startPrank(executor);
        uint256 halfTime = WEEK_LENGTH / 4;
        staking.setHalfTime(halfTime);
        vm.startPrank(alice);
        // set time to `half_time` before end of a week
        uint256 ts = (block.timestamp / WEEK_LENGTH + 2) * WEEK_LENGTH - halfTime;
        vm.warp(ts);
        uint256 stakeAmount = 3 ether;
        // stake
        deal(address(templeToken), alice, 100 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(stakeAmount);
        staking.setUserVoteDelegate(bob);

        ts += 2 * halfTime;
        vm.warp(ts);
        assertEq(staking.getVoteWeight(alice), stakeAmount / 2);
        assertEq(staking.getDelegatedVoteWeight(bob), stakeAmount / 2);

        staking.unsetUserVoteDelegate();
        assertEq(staking.userDelegates(alice), address(0));
        // still same week
        assertEq(staking.getDelegatedVoteWeight(bob), stakeAmount / 2);
        ts += WEEK_LENGTH;
        vm.warp(ts);
        assertEq(staking.getDelegatedVoteWeight(bob), 0);
    }
}