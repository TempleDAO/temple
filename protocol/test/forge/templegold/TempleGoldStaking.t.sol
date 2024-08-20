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
import { ITempleElevatedAccess } from "contracts/interfaces/v2/access/ITempleElevatedAccess.sol";

contract TempleGoldStakingTestBase is TempleGoldCommon {

    event Paused(address account);
    event Unpaused(address account);
    event GoldDistributionNotified(uint256 amount, uint256 timestamp);
    event Staked(address indexed staker, uint256 amount);
    event MigratorSet(address migrator);
    event Withdrawn(address indexed staker, address to, uint256 amount);
    event RewardDistributionCoolDownSet(uint160 cooldown);
    event DistributionStarterSet(address indexed starter);
    event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate);
    event DelegateVotesChanged(address indexed delegate, uint256 previousBalance, uint256 newBalance);
    event RewardPaid(address indexed staker, address toAddress, uint256 reward);
    event RewardDurationSet(uint256 duration);
    event UnstakeCooldownSet(uint32 period);

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
            executor,
            executor
        );
        _configureTempleGold();
        staking.setDistributionStarter(executor);
        vm.stopPrank();
    }

    function test_initialization() public {
        assertEq(staking.rescuer(), rescuer);
        assertEq(staking.executor(), executor);
        assertEq(address(staking.stakingToken()), address(templeToken));
        assertEq(address(staking.rewardToken()), address(templeGold));
    }

    function _configureTempleGold() private {
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
        templeGold.setTeamGnosis(teamGnosis);
        // whitelist
        templeGold.authorizeContract(address(daiGoldAuction), true);
        templeGold.authorizeContract(address(staking), true);
        templeGold.authorizeContract(teamGnosis, true);
    }

    function _setRewardDuration(uint256 _duration) internal {
        vm.startPrank(executor);
        staking.setRewardDuration(_duration);
        vm.stopPrank();
    }

    function _setVestingFactor() internal {
        uint32 _rewardDuration = 1 weeks;
        _setRewardDuration(_rewardDuration);
        ITempleGold.VestingFactor memory _factor = _getVestingFactor();
        _factor.value = 35;
        _factor.weekMultiplier = 1 weeks;
        vm.startPrank(executor);
        templeGold.setVestingFactor(_factor);
    }

    function _distributeRewards(address _nextPrank) internal {
        vm.startPrank(executor);
        staking.distributeRewards();
        if (_nextPrank != address(0)) {
            vm.startPrank(_nextPrank);
        }
    }

    function _setUnstakeCooldown() internal {
        vm.startPrank(executor);
        uint32 cooldown = 1 weeks;
        staking.setUnstakeCooldown(cooldown);
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

    function test_access_pause() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        staking.pause();
    }

    function test_access_setRewardDuration() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        staking.setRewardDuration(1);
    }

    function test_access_unpause() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        staking.unpause();
    }
    
    function test_access_setUnstakeCooldown() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        staking.setUnstakeCooldown(1 weeks);
    }
}

contract TempleGoldStakingTest is TempleGoldStakingTestBase {
    function test_pauseUnpause_staking() public {
        // testing not when paused
        vm.startPrank(executor);
        vm.expectEmit(address(staking));
        emit Paused(executor);
        staking.pause();
        vm.expectEmit(address(staking));
        emit Unpaused(executor);
        staking.unpause();
    }

    function test_revert_withdraw_when_paused() public {
        _setVestingFactor();
        vm.startPrank(alice);
        deal(address(templeToken), alice, 1 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        vm.startPrank(executor);
        uint32 cooldown = 1 weeks;
        staking.setUnstakeCooldown(cooldown);
        vm.startPrank(alice);
        staking.stake(1 ether);
        
        vm.startPrank(executor);
        vm.expectEmit(address(staking));
        emit Paused(executor);
        staking.pause();
        skip(cooldown);
        vm.expectRevert(abi.encodeWithSelector(Pausable.EnforcedPause.selector));
        staking.withdraw(1, false);

        staking.unpause();
        vm.startPrank(alice);
        staking.withdraw(1, false);
    }

    function test_revert_distribute_when_paused() public {
        _setVestingFactor();
        _setUnstakeCooldown();
        vm.startPrank(alice);
        deal(address(templeToken), alice, 1 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(1 ether);

        vm.startPrank(executor);
        vm.expectEmit(address(staking));
        emit Paused(executor);
        staking.pause();

        skip(3 days);
        vm.expectRevert(abi.encodeWithSelector(Pausable.EnforcedPause.selector));
        _distributeRewards(address(0));
 
        vm.expectRevert(abi.encodeWithSelector(Pausable.EnforcedPause.selector));
        _distributeRewards(address(0));

        staking.unpause();
        staking.distributeGold();
        _distributeRewards(address(0));
    }

    function test_revert_get_reward_when_paused() public {
        _setVestingFactor();
        _setUnstakeCooldown();
        vm.startPrank(alice);
        deal(address(templeToken), alice, 1 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(1 ether);

        vm.startPrank(executor);
        vm.expectEmit(address(staking));
        emit Paused(executor);
        staking.pause();

        skip(3 days);
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(Pausable.EnforcedPause.selector));
        staking.getReward(alice);

        vm.startPrank(executor);
        staking.unpause();
        staking.getReward(alice);
    }

    function test_stake_when_paused() public  {
        _setVestingFactor();
        _setUnstakeCooldown();
        vm.startPrank(executor);
        vm.expectEmit(address(staking));
        emit Paused(executor);
        staking.pause();

        vm.expectRevert(abi.encodeWithSelector(Pausable.EnforcedPause.selector));
        staking.stake(1 ether);

        staking.unpause();
        deal(address(templeToken), executor, 1000 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(1 ether);
    }

    function test_setDistributionStarter() public {
        vm.startPrank(executor);
        vm.expectEmit(address(staking));
        emit DistributionStarterSet(alice);
        staking.setDistributionStarter(alice);

        assertEq(staking.distributionStarter(), alice);
        vm.expectEmit(address(staking));
        emit DistributionStarterSet(bob);
        staking.setDistributionStarter(bob);

        assertEq(staking.distributionStarter(), bob);
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

    function test_setRewardDuration() public {
        _setUnstakeCooldown();
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        staking.setRewardDuration(0);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        staking.setRewardDuration(WEEK_LENGTH-1);
        uint256 duration = 16 weeks;
        vm.expectEmit(address(staking));
        emit RewardDurationSet(duration);
        staking.setRewardDuration(duration);
        assertEq(staking.rewardDuration(), duration);
        duration += WEEK_LENGTH;
        staking.setRewardDuration(duration);
        assertEq(staking.rewardDuration(), duration);

        // distribute and test change
        ITempleGold.VestingFactor memory _factor = _getVestingFactor();
        _factor.value = 35;
        _factor.weekMultiplier = 1 weeks;
        vm.startPrank(executor);
        templeGold.setVestingFactor(_factor);

        skip(3 days);
        deal(address(templeToken), bob, 1000 ether, true);
        vm.startPrank(bob);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(100 ether);
        _distributeRewards(address(0)); // executor prank
        vm.expectRevert(abi.encodeWithSelector(ITempleGoldStaking.InvalidOperation.selector));
        staking.setRewardDuration(duration);
    }


    function test_migrateWithdraw_tgldStaking() public {
        vm.startPrank(executor);
        staking.setMigrator(alice);
        uint256 _rewardDuration = 16 weeks;
        uint32 _vestingPeriod = uint32(_rewardDuration);
        _setVestingFactor(templeGold);
        _setRewardDuration(_rewardDuration); 
        _setUnstakeCooldown();
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
        skip(2 days);
        _distributeRewards(bob);
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
        uint256 _rewardDuration = 16 weeks;
        uint32 _vestingPeriod = uint32(_rewardDuration);
        _setVestingFactor(templeGold);
        _setRewardDuration(_rewardDuration);
        _setUnstakeCooldown();
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
        skip(2 days);
        _distributeRewards(alice);
        skip(2 days);
        uint256 bobEarned = staking.earned(bob);
        uint256 aliceEarned = staking.earned(alice);
        emit log_string("alice earned");
        emit log_uint(aliceEarned);
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
        ITempleGold.VestingFactor memory _factor = _getVestingFactor();
        _factor.value = 35;
        _factor.weekMultiplier = 1 weeks;
        vm.startPrank(executor);
        templeGold.setVestingFactor(_factor);

        uint256 _period = 16 weeks;
        {
            _setRewardDuration(_period);
            _setVestingFactor(templeGold);
            _setUnstakeCooldown();
        }
        
        {
            skip(1 days);
            vm.startPrank(executor);
            staking.setDistributionStarter(alice);
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
            staking.distributeRewards();
        }
       
        {
            vm.startPrank(alice);
            vm.expectRevert(abi.encodeWithSelector(ITempleGoldStaking.NoStaker.selector));
            staking.distributeRewards();
        }

        {
            deal(address(templeToken), bob, 1000 ether, true);
            vm.startPrank(bob);
            _approve(address(templeToken), address(staking), type(uint).max);
            staking.stake(1 ether);
        }
        
        uint256 rewardAmount;
        uint256 mintAmount;
        {
            vm.startPrank(alice);
            rewardAmount = staking.nextRewardAmount();
            ITempleGoldStaking.Reward memory rewardDataBefore = staking.getRewardData();
            assertEq(rewardDataBefore.rewardRate, 0);
            assertEq(rewardDataBefore.lastUpdateTime, 0);
            assertEq(rewardDataBefore.periodFinish, 0);
            assertEq(staking.rewardPeriodFinish(), 0);
            ITempleGold.DistributionParams memory params = templeGold.getDistributionParameters();
            mintAmount = templeGold.getMintAmount();

            // amount for staking 
            mintAmount = mintAmount * params.staking / 100 ether;
            vm.expectEmit(address(staking));
            emit GoldDistributionNotified(mintAmount, block.timestamp);
            staking.distributeRewards();
        }

        uint256 rewardBalance;
        uint256 rewardRate;
        {
            rewardBalance = templeGold.balanceOf(address(staking));
            assertGt(rewardBalance, rewardAmount);
            assertEq(staking.lastRewardNotificationTimestamp(), block.timestamp);
            // reward params were set
            rewardRate = rewardBalance / _period;
            ITempleGoldStaking.Reward memory rewardData = staking.getRewardData();
            assertEq(rewardData.rewardRate, rewardRate);
            assertEq(rewardData.lastUpdateTime, block.timestamp);
            assertEq(rewardData.periodFinish, block.timestamp + _period);
        }
        
        uint160 cooldown;
        {
            // reward distribution cooldown is not zero
            vm.startPrank(executor);
            cooldown = 1 days;
            staking.setRewardDistributionCoolDown(cooldown);
            assertEq(staking.rewardDistributionCoolDown(), cooldown);
            staking.setDistributionStarter(executor);
            vm.expectRevert(abi.encodeWithSelector(ITempleGoldStaking.CannotDistribute.selector));
            staking.distributeRewards();

            vm.warp(block.timestamp + cooldown + 1);
            staking.setRewardDistributionCoolDown(0);
        }

        {
            // mint so there's nothing for next transaction
            _factor = _getVestingFactor();
            _factor.value = 99 ether;
            _factor.weekMultiplier = 100 ether;
            templeGold.setVestingFactor(_factor);

            // zero rewards minted, so no reward notification from TGLD. this is also for TempleGold max supply case.
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
            _distributeRewards(address(0));
        }
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

    function test_setUnstakeCooldown() public {
        vm.startPrank(executor);

        vm.expectEmit(address(staking));
        emit UnstakeCooldownSet(1 weeks);
        staking.setUnstakeCooldown(1 weeks);
        assertEq(staking.unstakeCooldown(), 1 weeks);

        vm.expectEmit(address(staking));
        emit UnstakeCooldownSet(2 weeks);
        staking.setUnstakeCooldown(2 weeks);
        assertEq(staking.unstakeCooldown(), 2 weeks);
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

    function test_notifyDistribution_explicit_access() public {
        skip(1 weeks);
        templeGold.mint();
        vm.startPrank(executor);
        ITempleElevatedAccess.ExplicitAccess[] memory _accesses = new ITempleElevatedAccess.ExplicitAccess[](1);
        ITempleElevatedAccess.ExplicitAccess memory _access;
        _access.fnSelector = staking.notifyDistribution.selector;
        _access.allowed = true;
        _accesses[0] = _access;
        staking.setExplicitAccess(teamGnosis, _accesses);

        // now team gnosis can send TGLD to staking contract and notify distribution
        vm.startPrank(teamGnosis);
        uint256 nextRewardAmount = staking.nextRewardAmount();
        uint256 amount = 1 ether;
        IERC20(templeGold).transfer(address(staking), amount);
        staking.notifyDistribution(amount);
        assertEq(staking.nextRewardAmount(), amount+nextRewardAmount);
    }

    function test_withdraw_single_account_single_stake() public {
        {
            _setUnstakeCooldown();
            _setVestingFactor();
        }
        skip(3 days);
        {
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
            staking.withdraw(0, false);
        }
        uint256 goldRewardAmount;
        uint256 dustAmount;
        uint256 stakeAmount = 100 ether;
        {
            vm.startPrank(alice);
            deal(address(templeToken), alice, 1000 ether, true);
            _approve(address(templeToken), address(staking), type(uint).max);
            staking.stake(stakeAmount);
            _distributeRewards(alice);
            dustAmount = staking.nextRewardAmount();
            goldRewardAmount = templeGold.balanceOf(address(staking)) - dustAmount;
        }

        {
            skip(1 weeks);
            vm.expectEmit(address(staking));
            emit Withdrawn(alice, alice, stakeAmount/2);
            staking.withdraw(stakeAmount/2, false);
            assertEq(staking.balanceOf(alice), stakeAmount/2);
            assertEq(templeToken.balanceOf(alice), 1000 ether - stakeAmount/2);
            assertEq(staking.totalSupply(), stakeAmount/2);
            assertEq(goldRewardAmount, staking.earned(alice));
        }

        {
            skip(1 weeks);
            vm.expectEmit(address(staking));
            emit Withdrawn(alice, alice, stakeAmount/2);
            staking.withdraw(stakeAmount/2, true);
            assertEq(staking.balanceOf(alice), 0);
            assertEq(templeToken.balanceOf(alice), 1000 ether);
            assertEq(staking.totalSupply(), 0);
            assertEq(0, staking.earned(alice));
        }
    }

    function _getEarned(address _account) internal view returns(uint256) {
        uint balance = staking.balanceOf(_account);
        uint rewardPerToken = staking.rewardPerToken();
        uint claimableRewards = staking.claimableRewards(_account);
        uint userRewardPerTokenPaid = staking.userRewardPerTokenPaid(_account);
        return balance * (rewardPerToken - userRewardPerTokenPaid) / 1e18 + claimableRewards;
    }

    function test_withdraw_multiple_accounts_multiple_stakes() public {
        {
            _setVestingFactor();
            _setUnstakeCooldown();
        }
        skip(3 days);
        uint256 goldRewardAmount;
        uint256 dustAmount;
        uint256 stakeAmount = 100 ether;
        {
            vm.startPrank(bob);
            deal(address(templeToken), alice, 1000 ether, true);
            deal(address(templeToken), bob, 1000 ether, true);
            _approve(address(templeToken), address(staking), type(uint).max);
            staking.stake(stakeAmount);
            vm.startPrank(alice);
            _approve(address(templeToken), address(staking), type(uint).max);
            staking.stake(stakeAmount);
            vm.startPrank(executor);
            staking.distributeRewards();
            dustAmount = staking.nextRewardAmount();
            goldRewardAmount = templeGold.balanceOf(address(staking)) - dustAmount;
        }

        {
            // unstake cooldown
            vm.startPrank(alice);
            vm.expectRevert(abi.encodeWithSelector(ITempleGoldStaking.UnstakeCooldown.selector, block.timestamp, block.timestamp+1 weeks));
            staking.withdraw(stakeAmount, false);
            skip(1 weeks);
            // insufficient balance
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InsufficientBalance.selector, address(templeToken), stakeAmount+1, stakeAmount));
            staking.withdraw(stakeAmount+1, true);
        }
        uint256 earned;
        uint256 balanceBefore;
        uint256 balanceAfter;
        {
            earned = staking.earned(alice);
            balanceBefore = templeGold.balanceOf(alice);
            vm.expectEmit(address(staking));
            emit Withdrawn(alice, alice, 100 ether);
            staking.withdraw(stakeAmount, true);
            balanceAfter = templeGold.balanceOf(alice);
            assertEq(templeToken.balanceOf(alice), 1000 ether);
            assertEq(staking.totalSupply(), 100 ether);
            assertEq(0, staking.earned(alice));
            assertEq(earned, balanceAfter-balanceBefore);
            vm.startPrank(bob);
            balanceBefore = templeGold.balanceOf(bob);
            vm.expectEmit(address(staking));
            emit Withdrawn(bob, bob, 100 ether);
            staking.withdraw(stakeAmount, true);
            balanceAfter = templeGold.balanceOf(bob);
            assertEq(templeToken.balanceOf(bob), 1000 ether);
            assertEq(staking.totalSupply(), 0);
            assertEq(0, staking.earned(bob));
            assertEq(earned, balanceAfter-balanceBefore);
        }
        uint256 oldDustAmount;
        uint256 goldBalanceBefore;
        {   
            skip(1 days);
            _setRewardDuration(10 days);
            vm.startPrank(alice);
            staking.stake(stakeAmount);
            vm.startPrank(bob);
            staking.stake(stakeAmount);
            vm.startPrank(executor);
            goldBalanceBefore = templeGold.balanceOf(address(staking));
            oldDustAmount = dustAmount;
            staking.distributeRewards();
            dustAmount = staking.nextRewardAmount();
            goldRewardAmount = templeGold.balanceOf(address(staking)) - goldBalanceBefore - dustAmount + oldDustAmount;
            skip(1 days);
            assertEq(staking.earned(alice)+staking.earned(bob), goldRewardAmount/10);
            skip(1 days);
            assertEq(staking.earned(alice)+staking.earned(bob), goldRewardAmount*2/10);
            skip(3 days);
            assertEq(staking.earned(alice)+staking.earned(bob), goldRewardAmount*5/10);
            skip(5 days);
            assertEq(staking.earned(alice)+staking.earned(bob), goldRewardAmount);

            balanceBefore = templeGold.balanceOf(bob);
            vm.startPrank(bob);
            vm.expectEmit(address(staking));
            emit Withdrawn(bob, bob, 100 ether);
            staking.withdraw(stakeAmount, true);
            assertEq(templeGold.balanceOf(bob), goldRewardAmount/2 + balanceBefore);

            balanceBefore = templeGold.balanceOf(alice);
            vm.startPrank(alice);
            vm.expectEmit(address(staking));
            emit Withdrawn(alice, alice, 100 ether);
            staking.withdraw(stakeAmount, true);
            assertEq(staking.earned(alice), 0);
            assertEq(staking.earned(bob), 0);
            assertEq(templeGold.balanceOf(alice), goldRewardAmount/2 + balanceBefore);
        }
        // partial withdraws
        {
            vm.startPrank(executor);
            staking.setUnstakeCooldown(4 days);
            vm.startPrank(alice);
            staking.stake(70 ether);
            vm.startPrank(bob);
            staking.stake(30 ether);
            vm.startPrank(executor);
            goldBalanceBefore = templeGold.balanceOf(address(staking));
            oldDustAmount = dustAmount;
            staking.distributeRewards();
            dustAmount = staking.nextRewardAmount();
            goldRewardAmount = templeGold.balanceOf(address(staking)) - goldBalanceBefore - dustAmount + oldDustAmount;
            skip(1 days);
            assertEq(staking.earned(alice), goldRewardAmount*7/100);
            assertEq(staking.earned(bob), goldRewardAmount*3/100);
            assertEq(staking.earned(alice)+staking.earned(bob), goldRewardAmount/10);
            skip(1 days);
            assertEq(staking.earned(alice), goldRewardAmount*14/100);
            assertEq(staking.earned(bob), goldRewardAmount*6/100);
            assertEq(staking.earned(alice)+staking.earned(bob), goldRewardAmount*2/10);
            skip(3 days);
            assertEq(staking.earned(alice), goldRewardAmount*35/100);
            assertEq(staking.earned(bob), goldRewardAmount*15/100);
            assertEq(staking.earned(alice)+staking.earned(bob), goldRewardAmount*5/10);
            // alice withdraws half
            vm.startPrank(alice);
            vm.expectEmit(address(staking));
            emit Withdrawn(alice, alice, 40 ether);
            staking.withdraw(40 ether, false);
            uint256 remainingRewards = goldRewardAmount/2;
            uint256 bobRewardsNow = goldRewardAmount*15/100;
            assertEq(staking.claimableRewards(alice), goldRewardAmount*35/100);
            skip(3 days);
            assertEq(staking.earned(alice), _getEarned(alice));
            skip(2 days);
            assertEq(staking.earned(alice)+staking.earned(bob), goldRewardAmount);
            balanceBefore = templeGold.balanceOf(alice);
            earned = staking.earned(alice);
            staking.getReward(alice);
            assertEq(templeGold.balanceOf(alice), earned+balanceBefore);
            vm.startPrank(bob);
            balanceBefore = templeGold.balanceOf(bob);
            earned = staking.earned(bob);
            staking.getReward(bob);
            assertEq(templeGold.balanceOf(bob), earned+balanceBefore);

        }
    }

    function test_reward_params_tgldStaking() public {
        uint256 _period = 4 weeks;
        _setVestingFactor();
        _setRewardDuration(_period);
        _setUnstakeCooldown();

        skip(1 days);
        vm.startPrank(alice);
        deal(address(templeToken), alice, 1000 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(100 ether);
        uint256 goldBalanceBefore = templeGold.balanceOf(address(staking));
        uint256 ts = block.timestamp;
        _distributeRewards(alice);
        uint256 goldBalanceAfter = templeGold.balanceOf(address(staking));
        uint256 rewardsAmount = goldBalanceAfter - goldBalanceBefore;

        skip(1 days);

        ITempleGoldStaking.Reward memory rdata = staking.getRewardData();
        assertEq(rdata.rewardRate, rewardsAmount / _period);
        assertEq(rdata.periodFinish, ts + _period);
        assertEq(rdata.lastUpdateTime, ts);
        uint256 dust = rewardsAmount - (rdata.rewardRate * _period);
        assertEq(dust, staking.nextRewardAmount());

        skip(2 weeks);
        goldBalanceBefore = templeGold.balanceOf(address(staking));
        ts = block.timestamp;
        _distributeRewards(alice);
        goldBalanceAfter = templeGold.balanceOf(address(staking));
        uint256 remaining = uint256(rdata.periodFinish) - block.timestamp;
        uint256 leftover = remaining * rdata.rewardRate + dust;
        rewardsAmount = goldBalanceAfter - goldBalanceBefore;
        uint256 rewardRate = uint216((rewardsAmount + leftover) / _period);
        rdata = staking.getRewardData();
        assertEq(rdata.rewardRate, rewardRate);
        assertEq(rdata.periodFinish, ts + _period);
        assertEq(rdata.lastUpdateTime, ts);
        // check dust amount
        dust = (rewardsAmount + leftover) - (rewardRate * _period);
        assertEq(dust, staking.nextRewardAmount());
    }

    function test_check_votes_tgld_staking() public {
        _setVestingFactor();
        _setUnstakeCooldown();
        vm.startPrank(alice);
        staking.delegate(alice);

        assertEq(staking.getCurrentVotes(alice), 0);
        vm.expectRevert(abi.encodeWithSelector(ITempleGoldStaking.InvalidBlockNumber.selector));
        assertEq(staking.getPriorVotes(alice, block.number), 0);
        assertEq(staking.getPriorVotes(alice, block.number - 1), 0);

        // stake
        uint256 stakeAmount = 1 ether;
        deal(address(templeToken), alice, 100 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(stakeAmount);

        uint256 blockNumber = block.number;
        assertEq(staking.getCurrentVotes(alice), stakeAmount);
        assertEq(staking.getPriorVotes(alice, blockNumber - 1), 0);
        blockNumber += 1;
        vm.roll(blockNumber);
        assertEq(staking.getCurrentVotes(alice), stakeAmount);
        assertEq(staking.getPriorVotes(alice, blockNumber - 1), stakeAmount);
        blockNumber += 1;
        vm.roll(blockNumber);
        assertEq(staking.getCurrentVotes(alice), stakeAmount);
        assertEq(staking.getPriorVotes(alice, blockNumber - 1), stakeAmount);

        staking.stake(stakeAmount);
        staking.delegate(mike);
        assertEq(staking.getCurrentVotes(alice), 0);
        assertEq(staking.getPriorVotes(alice, blockNumber - 1), stakeAmount);
        assertEq(staking.getCurrentVotes(mike), 2 * stakeAmount);
        assertEq(staking.getPriorVotes(mike, blockNumber - 1), 0);
        blockNumber += 1;
        vm.roll(blockNumber);
        assertEq(staking.getCurrentVotes(mike), 2 * stakeAmount);
        assertEq(staking.getPriorVotes(mike, blockNumber - 1), 2 * stakeAmount);

        staking.delegate(address(0));
        assertEq(staking.getCurrentVotes(alice), 0);
        assertEq(staking.getPriorVotes(alice, blockNumber - 1), 0);
        assertEq(staking.getCurrentVotes(mike), 0);
        assertEq(staking.getPriorVotes(mike, blockNumber - 1), 2 * stakeAmount);
        blockNumber += 1;
        vm.roll(blockNumber);
        assertEq(staking.getPriorVotes(mike, blockNumber - 1), 0);
    }

    function test_delegate_tgld_staking() public {
        _setVestingFactor();
        _setUnstakeCooldown();
        vm.startPrank(alice);
        assertEq(staking.delegates(alice), address(0));
        vm.expectEmit(address(staking));
        emit DelegateChanged(alice, address(0), mike);
        staking.delegate(mike);
        assertEq(staking.delegates(alice), mike);
        // amount is 0
        assertEq(staking.numCheckpoints(mike), 0);
        ITempleGoldStaking.Checkpoint memory _checkpoint = staking.getCheckpoint(mike, 0);
        assertEq(_checkpoint.fromBlock, 0);
        assertEq(_checkpoint.votes, 0);
        assertEq(staking.numCheckpoints(mike), 0);
        
        // stake
        uint256 stakeAmount = 1 ether;
        deal(address(templeToken), alice, 100 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(stakeAmount);
        uint256 blockNumber = block.number;
        vm.expectEmit(address(staking));
        emit DelegateChanged(alice, mike, bob);
        vm.expectEmit(address(staking));
        emit DelegateVotesChanged(bob, 0, stakeAmount);
        staking.delegate(bob);
        assertEq(staking.delegates(alice), bob);
        assertEq(staking.numCheckpoints(bob), 1);
        // checkpoints start from 0
        _checkpoint = staking.getCheckpoint(bob, 0);
        assertEq(_checkpoint.fromBlock, blockNumber);
        assertEq(_checkpoint.votes, stakeAmount);
        assertEq(staking.numCheckpoints(bob), 1);
        // move delegates again
        skip(1 days);
        blockNumber = block.number;
        staking.delegate(mike);
        assertEq(staking.delegates(alice), mike);
        assertEq(staking.numCheckpoints(mike), 1);
        _checkpoint = staking.getCheckpoint(mike, 0);
        assertEq(_checkpoint.fromBlock, blockNumber);
        assertEq(_checkpoint.votes, stakeAmount);
        assertEq(staking.numCheckpoints(mike), 1);
    }

    function test_stake_tgldStaking_stake_withdraw_checkpoints() public {
        vm.startPrank(executor);
        staking.setUnstakeCooldown(1 hours);
        vm.startPrank(alice);
        staking.delegate(mike);
        uint256 stakeAmount = 1 ether;
        deal(address(templeToken), alice, 100 ether, true);
        deal(address(templeToken), bob, 100 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        staking.stake(0);
        uint256 blockNumber = block.number;
        uint256 ts = block.timestamp;
        vm.expectEmit(address(staking));
        emit Staked(alice, stakeAmount);
        staking.stake(stakeAmount);

        assertEq(staking.balanceOf(alice), stakeAmount);
        assertEq(staking.numCheckpoints(mike), 1);
        ITempleGoldStaking.Checkpoint memory _checkpoint = staking.getCheckpoint(mike, 0);
        assertEq(_checkpoint.fromBlock, blockNumber);
        assertEq(_checkpoint.votes, stakeAmount);
        assertEq(staking.numCheckpoints(mike), 1);

        skip(1 days);
        vm.startPrank(bob);
        _approve(address(templeToken), address(staking), type(uint).max);
        blockNumber = block.number;
        staking.stake(stakeAmount);
        staking.delegate(mike);
        assertEq(staking.balanceOf(bob), stakeAmount);
        assertEq(staking.numCheckpoints(mike), 1);
        // same block number as previous checkpoint
        _checkpoint = staking.getCheckpoint(mike, 0);
        assertEq(_checkpoint.fromBlock, blockNumber);
        assertEq(_checkpoint.votes, 2 * stakeAmount);
        assertEq(staking.numCheckpoints(mike), 1);

        // different block number
        blockNumber += 1;
        vm.roll(blockNumber);
        staking.stake(stakeAmount);
        assertEq(staking.balanceOf(bob), 2 * stakeAmount);
        assertEq(staking.numCheckpoints(mike), 2);
        _checkpoint = staking.getCheckpoint(mike, 1);
        assertEq(_checkpoint.fromBlock, blockNumber);
        assertEq(_checkpoint.votes, 3 * stakeAmount);
        assertEq(staking.numCheckpoints(mike), 2);

        // unstake
        vm.startPrank(alice);
        staking.withdraw(stakeAmount, false);
        _checkpoint = staking.getCheckpoint(mike, 1);
        assertEq(_checkpoint.fromBlock, blockNumber);
        assertEq(_checkpoint.votes, 2 * stakeAmount);
        assertEq(staking.numCheckpoints(mike), 2);
        blockNumber += 1;
        vm.roll(blockNumber);
        vm.startPrank(bob);
        skip(1 hours);
        staking.withdraw(stakeAmount, false);
        assertEq(staking.numCheckpoints(mike), 3);
        _checkpoint = staking.getCheckpoint(mike, 2);
        assertEq(_checkpoint.fromBlock, blockNumber);
        assertEq(_checkpoint.votes, stakeAmount);
    }

    function test_stake_tgldStaking_earned_single_stake_single_account() public {
        _setRewardDuration(1 weeks);
        _setVestingFactor();
        _setUnstakeCooldown();

        uint256 unstakeCooldown = staking.unstakeCooldown();
        vm.startPrank(alice);
        deal(address(templeToken), alice, 1000 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        uint256 stakeAmount = 100 ether;
        staking.stake(stakeAmount);
        assertEq(staking.unstakeTimes(alice), block.timestamp+unstakeCooldown);
        skip(1 days);
        _distributeRewards(alice);
        uint256 tgldRewardAmount = templeGold.balanceOf(address(staking));
        uint256 tgldRewardsDistributed = tgldRewardAmount - staking.nextRewardAmount();
        assertEq(staking.earned(alice), 0);

        skip(1 days);
        uint256 rewardPerToken = staking.rewardPerToken();
        uint256 aliceEarned = _getEarned(alice);
        assertEq(staking.earned(alice), aliceEarned);
        assertEq(aliceEarned, tgldRewardsDistributed/7);

        skip(5 days);
        aliceEarned = _getEarned(alice);
        assertEq(staking.earned(alice), aliceEarned);
        assertEq(aliceEarned, tgldRewardsDistributed*6/7);

        skip(1 days);
        aliceEarned = _getEarned(alice);
        assertEq(staking.earned(alice), aliceEarned);
        assertEq(aliceEarned, tgldRewardsDistributed);
        staking.getReward(alice);
        assertEq(templeGold.balanceOf(address(staking)), staking.nextRewardAmount());
    }   

    function test_getReward_tgldStaking_multiple_stakes_multiple_rewards_distribution() public {
        {
            _setVestingFactor();
            _setUnstakeCooldown();
            _setRewardDuration(16 weeks);
        }
        uint256 stakeAmount = 100 ether;
        uint256 goldRewardsAmount;
        uint256 nextRewardAmount;
        ITempleGoldStaking.Reward memory rewardDataOne;
        {
            vm.startPrank(alice);
            deal(address(templeToken), alice, 1000 ether, true);
            deal(address(templeToken), bob, 1000 ether, true);
            _approve(address(templeToken), address(staking), type(uint).max);
            staking.stake(stakeAmount);
            skip(1 days);
            _distributeRewards(alice);
            nextRewardAmount = staking.nextRewardAmount();
            goldRewardsAmount = templeGold.balanceOf(address(staking)) - nextRewardAmount;
            assertEq(staking.earned(alice), 0);
            rewardDataOne = staking.getRewardData();
        }
        uint256 userRewardPerTokenPaid;
        uint256 rewardPerToken;
        uint256 earned;
        uint256 aliceBalanceBefore; 
        uint256 aliceBalanceAfter;
        uint256 vestingRate;
        {
            skip(6 days);
            earned = _getEarned(alice);
            aliceBalanceBefore = templeGold.balanceOf(alice);
            emit log_string("alice before get reward");
            emit log_uint(aliceBalanceBefore);
            vm.expectEmit(address(staking));
            emit RewardPaid(alice, alice, earned);
            staking.getReward(alice);
            aliceBalanceAfter = templeGold.balanceOf(alice);
            emit log_string("alice after get reward");
            emit log_uint(aliceBalanceAfter);
            assertEq(aliceBalanceAfter - aliceBalanceBefore, earned);
            assertEq(staking.claimableRewards(alice), 0);
            assertEq(templeGold.balanceOf(address(staking)), goldRewardsAmount + staking.nextRewardAmount() - earned);
        }

        uint256 goldRewardsAmountTwo;
        ITempleGoldStaking.Reward memory rewardDataTwo;
        {
            skip(7 weeks);
            uint256 goldBalanceBefore = templeGold.balanceOf(address(staking));
            _distributeRewards(alice);
            goldRewardsAmountTwo = templeGold.balanceOf(address(staking)) - goldBalanceBefore - staking.nextRewardAmount();
            rewardDataTwo = staking.getRewardData();
            uint256 remaining = uint256(rewardDataOne.periodFinish) - block.timestamp;
            uint256 leftover = remaining * rewardDataOne.rewardRate;
            uint256 rewardRate = uint216((goldRewardsAmountTwo + leftover) / 16 weeks);
            assertApproxEqAbs(rewardDataTwo.rewardRate, rewardRate, 1);
        }
        
        {
            vm.startPrank(bob);
            _approve(address(templeToken), address(staking), type(uint).max);
            // bob first stake
            staking.stake(stakeAmount);
            rewardPerToken = staking.rewardPerToken();
            assertEq(rewardPerToken, staking.userRewardPerTokenPaid(bob));
            earned = _getEarned(bob);
            uint256 bobBalanceBefore = templeGold.balanceOf(bob);
            uint256 stakingGoldBalance = templeGold.balanceOf(address(staking));
            staking.getReward(bob);
            assertEq(templeGold.balanceOf(bob), earned + bobBalanceBefore);
            assertEq(templeGold.balanceOf(address(staking)), stakingGoldBalance - earned);

            skip(8 weeks);
            emit log_string("goldbalancebefore");
            emit log_uint(templeGold.balanceOf(address(staking)));
            aliceBalanceBefore = templeGold.balanceOf(alice);
            bobBalanceBefore = templeGold.balanceOf(bob);
            earned = staking.earned(alice);
            staking.getReward(alice);
            assertEq(earned, templeGold.balanceOf(alice)-aliceBalanceBefore);
            assertEq(staking.earned(alice), 0);
            earned = staking.earned(bob);
            staking.getReward(bob);
            assertEq(templeGold.balanceOf(bob)-bobBalanceBefore, earned);
            

            // skip till end of reward distribution two
            skip(8 weeks);
            emit log_string("goldbalanceafter");
            emit log_uint(templeGold.balanceOf(address(staking)));
            earned = staking.earned(alice);
            aliceBalanceBefore = templeGold.balanceOf(alice);
            vm.expectEmit(address(staking));
            emit RewardPaid(alice, alice, earned);
            staking.getReward(alice);
            aliceBalanceAfter = templeGold.balanceOf(alice);
            assertEq(earned, aliceBalanceAfter - aliceBalanceBefore);

            earned = staking.earned(bob);
            bobBalanceBefore = templeGold.balanceOf(bob);
            vm.expectEmit(address(staking));
            emit RewardPaid(bob, bob, earned);
            staking.getReward(bob);
            assertEq(earned, templeGold.balanceOf(bob) - bobBalanceBefore);
            emit log_string("gold in staking");
            emit log_uint(templeGold.balanceOf(address(staking)));
            assertEq(staking.earned(alice), 0);
            assertEq(staking.earned(bob), 0);
            assertEq(templeGold.balanceOf(address(staking)), staking.nextRewardAmount());
            // still no rewards earned after reward distribution period finished
            skip(3 days);
            assertEq(staking.earned(alice), 0);
            assertEq(staking.earned(bob), 0);
        }
        assertEq(
            goldRewardsAmount + goldRewardsAmountTwo + nextRewardAmount,
            templeGold.balanceOf(alice) + templeGold.balanceOf(bob)
        );
    }

    function test_stake_checkpoints() public {
        _setVestingFactor();
        _setUnstakeCooldown();
        vm.startPrank(alice);
        staking.delegate(mike);
        uint256 stakeAmount = 1 ether;
        deal(address(templeToken), alice, 100 ether, true);
        deal(address(templeToken), bob, 100 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        staking.stake(0);

        uint256 blockNumber = block.number;
        vm.expectEmit(address(staking));
        emit Staked(alice, stakeAmount);
        staking.stake(stakeAmount);
        assertEq(staking.balanceOf(alice), stakeAmount);
        assertEq(staking.numCheckpoints(mike), 1);
        ITempleGoldStaking.Checkpoint memory _checkpoint = staking.getCheckpoint(mike, 0);
        assertEq(_checkpoint.fromBlock, blockNumber);
        assertEq(_checkpoint.votes, stakeAmount);
        assertEq(staking.numCheckpoints(mike), 1);

        skip(1 days);
        vm.startPrank(bob);
        _approve(address(templeToken), address(staking), type(uint).max);
        blockNumber = block.number;
        staking.stake(stakeAmount);
        staking.delegate(mike);
        assertEq(staking.balanceOf(bob), stakeAmount);
        assertEq(staking.numCheckpoints(mike), 1);
        // same block number as previous checkpoint
        _checkpoint = staking.getCheckpoint(mike, 0);
        assertEq(_checkpoint.fromBlock, blockNumber);
        assertEq(_checkpoint.votes, 2 * stakeAmount);
        assertEq(staking.numCheckpoints(mike), 1);

        // different block number
        blockNumber += 1;
        vm.roll(blockNumber);
        staking.stake(stakeAmount);
        assertEq(staking.balanceOf(bob), 2 * stakeAmount);
        assertEq(staking.numCheckpoints(mike), 2);
        _checkpoint = staking.getCheckpoint(mike, 1);
        assertEq(_checkpoint.fromBlock, blockNumber);
        assertEq(_checkpoint.votes, 3 * stakeAmount);
        assertEq(staking.numCheckpoints(mike), 2);
    }

    function test_withdraw_checkpoints_tgldStaking() public {
        {
            // for distribution
            skip(3 days);
            _setRewardDuration(1 weeks);
            _setVestingFactor(templeGold);
            vm.startPrank(executor);
            staking.setUnstakeCooldown(1 hours);
        }

        vm.startPrank(alice);
        staking.delegate(mike);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        staking.withdraw(0, false);

        uint256 stakeAmount = 100 ether;
        deal(address(templeToken), alice, 1000 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        uint256 blockNumber = block.number;
        staking.stake(stakeAmount);
        ITempleGoldStaking.Checkpoint memory _checkpoint = staking.getCheckpoint(mike, 0);
        assertEq(_checkpoint.fromBlock, blockNumber);
        assertEq(_checkpoint.votes, stakeAmount);
        assertEq(staking.numCheckpoints(mike), 1);
        skip(1 hours);
        vm.expectEmit(address(staking));
        emit Withdrawn(alice, alice, 100 ether);
        staking.withdraw(stakeAmount, false);
        assertEq(templeToken.balanceOf(alice), 1000 ether);
        assertEq(staking.totalSupply(), 0);
        // same block number
        _checkpoint = staking.getCheckpoint(mike, 0);
        assertEq(_checkpoint.fromBlock, blockNumber);
        assertEq(staking.numCheckpoints(mike), 1);
        assertEq(_checkpoint.votes, 0);
        assertEq(staking.numCheckpoints(mike), 1);

        staking.stake(60 ether);
        skip(1 hours);
        // new block number
        blockNumber += 1;
        vm.roll(blockNumber);
        vm.expectEmit(address(staking));
        emit Withdrawn(alice, alice, 60 ether);
        staking.withdraw(60 ether, false);
        assertEq(templeToken.balanceOf(alice), 1000 ether);
        assertEq(staking.totalSupply(), 0);
        assertEq(staking.numCheckpoints(mike), 2);
        _checkpoint = staking.getCheckpoint(mike, 1);
        assertEq(_checkpoint.fromBlock, blockNumber);
        assertEq(_checkpoint.votes, 0);
        assertEq(staking.numCheckpoints(mike), 2);
    }

}