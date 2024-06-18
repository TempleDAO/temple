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
    event Staked(address indexed staker, uint256 amount);
    event MigratorSet(address migrator);
    event Withdrawn(address indexed staker, address to, uint256 stakeIndex, uint256 amount);
    event RewardDistributionCoolDownSet(uint160 cooldown);
    event DistributionStarterSet(address indexed starter);
    event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate);
    event DelegateVotesChanged(address indexed delegate, uint256 previousBalance, uint256 newBalance);
    event VestingPeriodSet(uint32 _period);
    event RewardPaid(address indexed staker, address toAddress, uint256 index, uint256 reward);
    event RewardDurationSet(uint256 duration);

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

    function _setVestingPeriod(uint32 _vestingPeriod) internal {
        vm.startPrank(executor);
        staking.setVestingPeriod(_vestingPeriod);
        vm.stopPrank();
    }

    function _setRewardDuration(uint256 _duration) internal {
        vm.startPrank(executor);
        staking.setRewardDuration(_duration);
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

    function test_access_setVestingPeriod() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        staking.setVestingPeriod(1);
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

    function test_stake_when_paused() public  {
        vm.startPrank(executor);
        vm.expectEmit(address(staking));
        emit Paused(executor);
        staking.pause();

        vm.expectRevert(abi.encodeWithSelector(Pausable.EnforcedPause.selector));
        staking.stakeFor(alice, 1 ether);

        staking.unpause();
        deal(address(templeToken), executor, 1000 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stakeFor(alice, 1 ether);
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

    function test_setRewardDuration() public {
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
        skip(3 days);
        _setVestingPeriod(uint32(duration));
        deal(address(templeToken), bob, 1000 ether, true);
        vm.startPrank(bob);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(100 ether);
        staking.distributeRewards();
        vm.expectRevert(abi.encodeWithSelector(ITempleGoldStaking.InvalidOperation.selector));
        vm.startPrank(executor);
        staking.setRewardDuration(duration);
    }

    function test_setVestingPeriod() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        staking.setVestingPeriod(0);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        staking.setVestingPeriod(uint32(WEEK_LENGTH-1));

        uint32 period = 16 weeks;
        vm.expectEmit(address(staking));
        emit VestingPeriodSet(period);
        staking.setVestingPeriod(period);
        assertEq(staking.vestingPeriod(), period);

        staking.setVestingPeriod(period+1);
        assertEq(staking.vestingPeriod(), period+1);

        // distribute and test change
        skip(3 days);
        _setVestingPeriod(period);
        _setRewardDuration(uint256(period));
        _setVestingFactor(templeGold);
        deal(address(templeToken), bob, 1000 ether, true);
        vm.startPrank(bob);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(100 ether);
        staking.distributeRewards();
        vm.expectRevert(abi.encodeWithSelector(ITempleGoldStaking.InvalidOperation.selector));
        vm.startPrank(executor);
        staking.setVestingPeriod(period);
    }

    function test_migrateWithdraw_tgldStaking() public {
        vm.startPrank(executor);
        staking.setMigrator(alice);
        uint256 _rewardDuration = 16 weeks;
        uint32 _vestingPeriod = uint32(_rewardDuration);
        _setVestingFactor(templeGold);
        _setVestingPeriod(_vestingPeriod);
        _setRewardDuration(_rewardDuration); 
   
        // bob stakes
        vm.startPrank(bob);
        deal(address(templeToken), bob, 1000 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(100 ether);

        // invalid access
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        staking.migrateWithdraw(bob, 1);
        uint256 aliceTempleBalance = templeToken.balanceOf(alice);
        uint256 bobGoldBalance = templeGold.balanceOf(bob);
        // distribute rewards to earn
        skip(2 days);
        staking.distributeRewards();
        uint256 bobEarned = staking.earned(bob, 1);
        vm.startPrank(alice);
        // invalid staker
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        staking.migrateWithdraw(address(0), 1);
        // zero stake
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        staking.migrateWithdraw(unauthorizedUser, 1);

        vm.expectEmit(address(staking));
        emit Withdrawn(bob, alice, 1, 100 ether);
        staking.migrateWithdraw(bob, 1);
        assertEq(templeToken.balanceOf(alice), aliceTempleBalance + 100 ether);
        assertEq(templeGold.balanceOf(bob), bobGoldBalance + bobEarned);
    }

    function test_migrateWithdraw_end_to_end() public {
        uint256 _rewardDuration = 16 weeks;
        uint32 _vestingPeriod = uint32(_rewardDuration);
        _setVestingFactor(templeGold);
        _setVestingPeriod(_vestingPeriod);
        _setRewardDuration(_rewardDuration); 
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
        staking.distributeRewards();
        skip(2 days);
        uint256 bobEarned = staking.earned(bob, 1);
        uint256 aliceEarned = staking.earned(alice, 1);

        // migrate withdraw
        mockStaking.migrateFromPreviousStaking(1);
        assertEq(staking.balanceOf(alice), 0);
        assertEq(staking.stakeBalanceOf(alice, 1), 0);
        staking.earned(alice, 1);
        assertEq(staking.earned(alice, 1), 0);
        assertEq(mockStaking.balanceOf(alice), stakeAmount);
        assertEq(templeGold.balanceOf(alice), aliceEarned);

        vm.startPrank(bob);
        mockStaking.migrateFromPreviousStaking(1);
        assertEq(staking.balanceOf(bob), 0);
        assertEq(staking.earned(bob, 1), 0);
        assertEq(mockStaking.balanceOf(bob), stakeAmount);
        assertEq(templeGold.balanceOf(bob), bobEarned);
    }

    function test_distributeRewards() public {
        uint256 _period = 16 weeks;
        {
            _setRewardDuration(_period);
            _setVestingPeriod(uint32(_period));
            _setVestingFactor(templeGold);
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
            // anyone can call
            staking.setDistributionStarter(address(0));
            vm.expectRevert(abi.encodeWithSelector(ITempleGoldStaking.CannotDistribute.selector));
            staking.distributeRewards();

            vm.warp(block.timestamp + cooldown + 1);
            staking.setRewardDistributionCoolDown(0);
        }

        {
            // mint so there's nothing for next transaction
            ITempleGold.VestingFactor memory _factor = _getVestingFactor();
            _factor.numerator = 99 ether;
            _factor.denominator = 100 ether;
            templeGold.setVestingFactor(_factor);

            skip(10 days);
            staking.distributeRewards();
            skip(1 days);
            // zero rewards minted, so no reward notification from TGLD. this is also for TempleGold max supply case.
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
            staking.distributeRewards();
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

    function test_withdraw_single_account_multiple_stakes() public {
        uint256 _rewardDuration = 16 weeks;
        {
            _setRewardDuration(_rewardDuration);
            _setVestingFactor(templeGold);
            _setVestingPeriod(uint32(_rewardDuration));
        }

        {
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
            staking.withdraw(0, 0, true);
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InsufficientBalance.selector, address(templeToken), 1, 0));
            staking.withdraw(1, 0, true);
        }  
        uint256 stakeAmount = 100 ether;
        {
            vm.startPrank(alice);
            deal(address(templeToken), alice, 1000 ether, true);
            _approve(address(templeToken), address(staking), type(uint).max);
            staking.stake(stakeAmount);

            vm.expectEmit(address(staking));
            emit Withdrawn(alice, alice, 1, 40 ether);
            staking.withdraw(40 ether, 1, false);
            ITempleGoldStaking.StakeInfo memory _stakeInfo = staking.getAccountStakeInfo(alice, 1);
            assertEq(_stakeInfo.amount, stakeAmount - 40 ether);

            assertEq(templeToken.balanceOf(alice), 940 ether);
            assertEq(staking.totalSupply(), 60 ether);
            vm.expectEmit(address(staking));
            emit Withdrawn(alice, alice, 1, 60 ether);
            staking.withdrawAll(1, false);
            _stakeInfo = staking.getAccountStakeInfo(alice, 1);
            assertEq(_stakeInfo.amount, 0);
            assertEq(templeToken.balanceOf(alice), 1000 ether);
            assertEq(staking.totalSupply(), 0);
        }

        {
            // withdraw and claim rewards
            staking.stake(stakeAmount);
            skip(3 days);
            uint256 earned = staking.earned(alice, 2);
            vm.expectEmit(address(staking));
            emit Withdrawn(alice, alice, 2, stakeAmount);
            staking.withdrawAll(2, true);
            assertEq(templeGold.balanceOf(alice), earned);
        }
    }

    // function test_earned_getReward_tgldStaking() public {
    function test_reward_params_tgldStaking() public {
        uint256 _period = 16 weeks;
        _setRewardDuration(_period);
        _setVestingPeriod(uint32(_period));
        _setVestingFactor(templeGold);

        skip(1 days);
        vm.startPrank(alice);
        deal(address(templeToken), alice, 1000 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(100 ether);
        uint256 goldBalanceBefore = templeGold.balanceOf(address(staking));
        uint256 ts = block.timestamp;
        staking.distributeRewards();
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
        staking.distributeRewards();
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
        uint32 _vestingPeriod = 16 weeks;
        _setVestingPeriod(_vestingPeriod);
        vm.startPrank(alice);
        staking.delegate(mike);
        uint256 stakeAmount = 1 ether;
        deal(address(templeToken), alice, 100 ether, true);
        deal(address(templeToken), bob, 100 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        staking.stake(0);
        assertEq(staking.getAccountLastStakeIndex(alice), 0);
        uint256 blockNumber = block.number;
        uint256 ts = block.timestamp;
        vm.expectEmit(address(staking));
        emit Staked(alice, stakeAmount);
        staking.stake(stakeAmount);
        TempleGoldStaking.StakeInfo memory _stakeInfo = staking.getAccountStakeInfo(alice, 1);
        assertEq(_stakeInfo.stakeTime, ts);
        assertEq(_stakeInfo.fullyVestedAt, ts + _vestingPeriod);
        assertEq(_stakeInfo.amount, stakeAmount);
        assertEq(staking.getAccountLastStakeIndex(alice), 1);
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

    function test_stake_tgldStaking_stakeinfo_multiple_stakes() public {
        uint32 _vestingPeriod = 16 weeks;
        _setVestingPeriod(_vestingPeriod);
        vm.startPrank(alice);
        staking.delegate(mike);
        uint256 stakeAmount = 1 ether;
        deal(address(templeToken), alice, 100 ether, true);
        deal(address(templeToken), bob, 100 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);

        uint256 blockNumber = block.number;
        uint256 ts = block.timestamp;
        vm.expectEmit(address(staking));
        emit Staked(alice, stakeAmount);
        staking.stake(stakeAmount);
        TempleGoldStaking.StakeInfo memory _stakeInfo = staking.getAccountStakeInfo(alice, 1);
        assertEq(_stakeInfo.stakeTime, ts);
        assertEq(_stakeInfo.fullyVestedAt, ts + _vestingPeriod);
        assertEq(_stakeInfo.amount, stakeAmount);
        assertEq(staking.balanceOf(alice), stakeAmount);

        // another stake
        ts += 1 days;
        vm.warp(ts);
        staking.stake(2 * stakeAmount);
        _stakeInfo = staking.getAccountStakeInfo(alice, 2);
        assertEq(_stakeInfo.stakeTime, ts);
        assertEq(_stakeInfo.fullyVestedAt, ts + _vestingPeriod);
        assertEq(_stakeInfo.amount, 2 * stakeAmount);
        assertEq(staking.balanceOf(alice), 3 * stakeAmount);

        // another stake
        staking.stake(stakeAmount);
        _stakeInfo = staking.getAccountStakeInfo(alice, 3);
        assertEq(_stakeInfo.stakeTime, ts);
        assertEq(_stakeInfo.fullyVestedAt, ts + _vestingPeriod);
        assertEq(_stakeInfo.amount, stakeAmount);
        assertEq(staking.balanceOf(alice), 4 * stakeAmount);
    }

    function test_stake_tgldStaking_earned_multiple_stakes_single_account() public {
        uint32 _vestingPeriod = 16 weeks;
        _setVestingPeriod(_vestingPeriod);
        _setRewardDuration(_vestingPeriod);
        _setVestingFactor(templeGold);
        vm.startPrank(alice);
        deal(address(templeToken), alice, 1000 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(100 ether);
        uint64 stakeTime = uint64(block.timestamp);
        skip(1 days);
        staking.distributeRewards();
        uint256 stakingGoldBalance = templeGold.balanceOf(address(staking));
        assertEq(staking.earned(alice, 1), 0);

        skip(1 days);
        uint256 rewardPerToken = staking.rewardPerToken();
        uint256 _vestingRate = _getVestingRate(alice, 1);
        uint256 aliceEarned = _getEarned(100 ether, rewardPerToken, 0, _vestingRate);
        assertApproxEqAbs(staking.earned(alice, 1), aliceEarned, 1);

        skip(5 days);
        rewardPerToken = staking.rewardPerToken();
        _vestingRate = _getVestingRate(alice, 1);
        aliceEarned = _getEarned(100 ether, rewardPerToken, 0, _vestingRate);
        assertEq(staking.earned(alice, 1), aliceEarned);
        
        // fast forward to 1 month
        uint256 aliceStakeTime = staking.getAccountStakeInfo(alice, 1).stakeTime;
        uint256 aliceFullyVestedAt = staking.getAccountStakeInfo(alice, 1).fullyVestedAt;
        skip(3 weeks);
        ITempleGoldStaking.Reward memory rewardData = staking.getRewardData();
        rewardPerToken = staking.rewardPerToken();
        _vestingRate = _getVestingRate(alice, 1);
        aliceEarned = _getEarned(100 ether, rewardPerToken, 0, _vestingRate);
        assertEq(staking.earned(alice, 1), aliceEarned);
        rewardPerToken = staking.rewardPerToken();
        uint256 rewardsAtCurrentTs = 
            100 ether * (rewardPerToken * _vestingRate / 1e18 ) / 1e18;
        assertEq(aliceEarned, rewardsAtCurrentTs);

        staking.distributeRewards();
        staking.stake(50 ether);
        uint64 stakeTimeTwo = uint64(block.timestamp);
        skip(2 weeks);
        rewardPerToken = staking.rewardPerToken();
        uint256 userRewardPerTokenPaid = staking.userRewardPerTokenPaid(alice, 2);
        _vestingRate = _getVestingRate(alice, 2);
        aliceEarned = _getEarned(50 ether, rewardPerToken, userRewardPerTokenPaid, _vestingRate);
        assertEq(staking.earned(alice, 2), aliceEarned);

        // end of stake 1 vesting
        skip(10 weeks);
        rewardPerToken = staking.rewardPerToken();
        userRewardPerTokenPaid = staking.userRewardPerTokenPaid(alice, 1);
        _vestingRate = _getVestingRate(alice, 1);
        aliceEarned = _getEarned(100 ether, rewardPerToken, userRewardPerTokenPaid, _vestingRate);
        assertEq(staking.earned(alice, 1), aliceEarned);

        // end of stake 2 vesting
        skip(4 weeks);
        rewardPerToken = staking.rewardPerToken();
        userRewardPerTokenPaid = staking.userRewardPerTokenPaid(alice, 2);
        _vestingRate = _getVestingRate(alice, 2);
        aliceEarned = _getEarned(50 ether, rewardPerToken, userRewardPerTokenPaid, _vestingRate);
        assertEq(staking.earned(alice, 2), aliceEarned);
    }

    function test_stake_tgldStaking_earned_multiple_stakes_multiple_accounts() public {
        skip(3 days);
        uint32 _vestingPeriod = 16 weeks;
        _setVestingPeriod(_vestingPeriod);
        _setRewardDuration(_vestingPeriod);
        vm.startPrank(executor);
        ITempleGold.VestingFactor memory factor;
        factor.numerator = 1 seconds;
        factor.denominator = 300 days;
        templeGold.setVestingFactor(factor);

        vm.startPrank(alice);
        deal(address(templeToken), alice, 1000 ether, true);
        deal(address(templeToken), bob, 1000 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(300 ether);
        staking.distributeRewards();
        uint256 goldRewardsAmount = templeGold.balanceOf(address(staking));
        vm.startPrank(bob);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(200 ether);
        uint256 stakeTime = block.timestamp;

        skip(1 days);
        uint256 rewardPerToken = staking.rewardPerToken();
        uint256 bobUserPerTokenPaid = staking.userRewardPerTokenPaid(bob, 1);
        uint256 aliceUserPerTokenPaid = staking.userRewardPerTokenPaid(alice, 1);
        uint256 _vestingRate = (block.timestamp - stakeTime) * 1e18 / _vestingPeriod;
        uint256 aliceEarned = _getEarned(300 ether, rewardPerToken, aliceUserPerTokenPaid, _getVestingRate(alice, 1));
        uint256 bobEarned = _getEarned(200 ether, rewardPerToken, bobUserPerTokenPaid, _getVestingRate(bob, 1));
        assertEq(staking.earned(alice, 1), aliceEarned);
        assertEq(staking.earned(bob, 1), bobEarned);

        skip(6 days);
        rewardPerToken = staking.rewardPerToken();
        bobUserPerTokenPaid = staking.userRewardPerTokenPaid(bob, 1);
        aliceUserPerTokenPaid = staking.userRewardPerTokenPaid(alice, 1);
        aliceEarned = _getEarned(300 ether, rewardPerToken, aliceUserPerTokenPaid, _getVestingRate(alice, 1));
        bobEarned = _getEarned(200 ether, rewardPerToken, bobUserPerTokenPaid, _getVestingRate(bob, 1));
        assertEq(staking.earned(alice, 1), aliceEarned);
        assertEq(staking.earned(bob, 1), bobEarned);

        skip(7 weeks);
        rewardPerToken = staking.rewardPerToken();
        bobUserPerTokenPaid = staking.userRewardPerTokenPaid(bob, 1);
        aliceEarned = _getEarned(300 ether, rewardPerToken, aliceUserPerTokenPaid, _getVestingRate(alice, 1));
        bobEarned = _getEarned(200 ether, rewardPerToken, bobUserPerTokenPaid, _getVestingRate(bob, 1));
        assertEq(staking.earned(alice, 1), aliceEarned);
        assertEq(staking.earned(bob, 1), bobEarned);

        skip(8 weeks);
        rewardPerToken = staking.rewardPerToken();
        bobUserPerTokenPaid = staking.userRewardPerTokenPaid(bob, 1);
        aliceEarned = _getEarned(300 ether, rewardPerToken, aliceUserPerTokenPaid, _getVestingRate(alice, 1));
        bobEarned = _getEarned(200 ether, rewardPerToken, bobUserPerTokenPaid, _getVestingRate(bob, 1));
        assertEq(staking.earned(alice, 1), aliceEarned);
        assertEq(staking.earned(bob, 1), bobEarned);

        // stake more, multiple reward distributions
        // bob
        vm.warp(block.timestamp / WEEK_LENGTH * WEEK_LENGTH);
        staking.distributeRewards();
        staking.stake(100 ether);
        stakeTime = block.timestamp;
        assertEq(staking.earned(bob, 2), 0);

        skip(1 weeks);
        rewardPerToken = staking.rewardPerToken();
        bobUserPerTokenPaid = staking.userRewardPerTokenPaid(bob, 2);
        bobEarned = _getEarned(100 ether, rewardPerToken, bobUserPerTokenPaid, _getVestingRate(bob, 2));
        assertEq(staking.earned(bob, 2), bobEarned);

        // distribute
        goldRewardsAmount = templeGold.balanceOf(address(staking));
        goldRewardsAmount = templeGold.balanceOf(address(staking)) - goldRewardsAmount;
        templeGold.totalSupply();

        skip(1 weeks);
        rewardPerToken = staking.rewardPerToken();
        bobUserPerTokenPaid = staking.userRewardPerTokenPaid(bob, 2);
        bobEarned = _getEarned(100 ether, rewardPerToken, bobUserPerTokenPaid, _getVestingRate(bob, 2));
        assertEq(staking.earned(bob, 2), bobEarned);

        skip(14 weeks);
        rewardPerToken = staking.rewardPerToken();
        bobUserPerTokenPaid = staking.userRewardPerTokenPaid(bob, 2);
        _vestingRate = (block.timestamp - stakeTime) * 1e18 / _vestingPeriod;
        bobEarned = _getEarned(100 ether, rewardPerToken, bobUserPerTokenPaid, _getVestingRate(bob, 2));
        assertEq(staking.earned(bob, 2), bobEarned);
    }

    function _getEarned(
        uint256 _amount,
        uint256 _rewardPerToken,
        uint256 _rewardPerTokenPaid,
        uint256 _vestingRate
    ) private view returns (uint256 earned) {
        earned = (_amount * ((_rewardPerToken * _vestingRate / 1e18) - _rewardPerTokenPaid) / 1e18);
    }

    function _getVestingRate(
        address _account,
        uint256 _index
    ) private view returns (uint256 vestingRate) {
       uint256 vestingPeriod = 16 weeks;
        ITempleGoldStaking.StakeInfo memory _stakeInfo = staking.getAccountStakeInfo(_account, _index);
        if (block.timestamp > _stakeInfo.fullyVestedAt) {
            vestingRate = 1e18;
        } else {
            vestingRate = (block.timestamp - _stakeInfo.stakeTime) * 1e18 / vestingPeriod;
        }
    }

    function test_getReward_tgldStaking_single_stake_single_account() public {
        // for distribution
        skip(3 days);
        uint32 _rewardDuration = 16 weeks;
        _setVestingPeriod(_rewardDuration);
        _setRewardDuration(_rewardDuration);
        _setVestingFactor(templeGold);

        vm.startPrank(alice);
        deal(address(templeToken), alice, 1000 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        uint256 stakeAmount = 100 ether;
        staking.stake(stakeAmount);
        uint256 stakeTime = block.timestamp;
        uint256 goldBalanceBefore = templeGold.balanceOf(address(staking));
        staking.distributeRewards();
        uint256 goldRewardsAmount = templeGold.balanceOf(address(staking)) - goldBalanceBefore;
        
        skip(1 weeks);
        ITempleGoldStaking.Reward memory rewardData = staking.getRewardData();
        uint256 earned = staking.earned(alice, 1);
        uint256 aliceBalanceBefore = templeGold.balanceOf(alice);
        staking.getReward(alice, 1);
        uint256 aliceBalanceAfter = templeGold.balanceOf(alice);
        assertEq(aliceBalanceAfter - aliceBalanceBefore, earned);
        assertEq(staking.claimableRewards(alice, 1), 0);

        skip(1 weeks);
        earned = staking.earned(alice, 1);
        aliceBalanceBefore = templeGold.balanceOf(alice);
        staking.getReward(alice, 1);
        aliceBalanceAfter = templeGold.balanceOf(alice);
        assertEq(aliceBalanceAfter - aliceBalanceBefore, earned);

        skip(6 weeks);
        earned = staking.earned(alice, 1);
        aliceBalanceBefore = templeGold.balanceOf(alice);
        staking.getReward(alice, 1);
        aliceBalanceAfter = templeGold.balanceOf(alice);
        assertEq(aliceBalanceAfter - aliceBalanceBefore, earned);

        skip(8 weeks);
        earned = staking.earned(alice, 1);
        aliceBalanceBefore = templeGold.balanceOf(alice);
        staking.getReward(alice, 1);
        aliceBalanceAfter = templeGold.balanceOf(alice);
        assertEq(aliceBalanceAfter - aliceBalanceBefore, earned);
        skip(8 weeks);
        staking.earned(alice, 1);
        staking.getReward(alice, 1);
        templeGold.balanceOf(address(staking));
        staking.rewardPerToken();
        // dust amount + alice staking before reward distribution
        assertApproxEqAbs(goldRewardsAmount, aliceBalanceAfter, 6e6);
    }

    function test_getReward_tgldStaking_multiple_stakes_single_account() public {
        // for distribution
        skip(3 days);
        uint32 _vestingPeriod = 16 weeks;
        _setVestingPeriod(_vestingPeriod);
        _setRewardDuration(_vestingPeriod);
        _setVestingFactor(templeGold);

        vm.startPrank(alice);
        deal(address(templeToken), alice, 1000 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        uint256 stakeAmount = 100 ether;
        staking.stake(stakeAmount);
        assertEq(staking.earned(alice, 1), 0);
        uint256 stakeTime = block.timestamp;
        templeGold.balanceOf(address(staking));
        staking.distributeRewards();
        uint256 goldRewardsAmount = templeGold.balanceOf(address(staking));
        assertEq(staking.earned(alice, 1), 0);
        ITempleGoldStaking.Reward memory rewardData = staking.getRewardData();

        skip(1 weeks);
        uint256 userRewardPerTokenPaid = staking.userRewardPerTokenPaid(alice, 1);
        uint256 rewardPerToken = staking.rewardPerToken();
        uint256 _vestingRate = (block.timestamp - stakeTime) * 1e18 / _vestingPeriod;
        uint256 earned = _getEarned(stakeAmount, rewardPerToken, userRewardPerTokenPaid, _vestingRate);
        assertEq(earned, staking.earned(alice, 1));
        uint256 aliceBalanceBefore = templeGold.balanceOf(alice);
        vm.expectEmit(address(staking));
        emit RewardPaid(alice, alice, 1, earned);
        staking.getReward(alice, 1);
        uint256 aliceBalanceAfter = templeGold.balanceOf(alice);
        assertEq(aliceBalanceAfter - aliceBalanceBefore, earned);
        assertEq(staking.claimableRewards(alice, 1), 0);
        assertEq(aliceBalanceAfter, aliceBalanceBefore+earned);

        skip(1 weeks);
        staking.distributeRewards();
        staking.stake(stakeAmount);
        stakeTime = block.timestamp;
        assertEq(staking.earned(alice, 2), 0);

        skip(1 weeks);
        staking.earned(alice, 2);
        userRewardPerTokenPaid = staking.userRewardPerTokenPaid(alice, 2);
        rewardPerToken = staking.rewardPerToken();
        _vestingRate = (block.timestamp - stakeTime) * 1e18 / _vestingPeriod;
        earned = _getEarned(stakeAmount, rewardPerToken, userRewardPerTokenPaid, _vestingRate);
        assertEq(staking.earned(alice, 2), earned);
        staking.getReward(alice, 2);
        assertEq(staking.earned(alice, 2), 0);
        aliceBalanceAfter = templeGold.balanceOf(alice);

        skip(1 weeks);
        userRewardPerTokenPaid = staking.userRewardPerTokenPaid(alice, 2);
        rewardPerToken = staking.rewardPerToken();
        earned = _getEarned(stakeAmount, rewardPerToken, userRewardPerTokenPaid, _getVestingRate(alice, 2));
        assertEq(staking.earned(alice, 2), earned);
        aliceBalanceBefore = templeGold.balanceOf(alice);
        staking.getReward(alice, 2);
        staking.earned(alice, 2);
        aliceBalanceAfter = templeGold.balanceOf(alice);
        assertEq(earned, aliceBalanceAfter-aliceBalanceBefore);

        // get reward for first stake
        userRewardPerTokenPaid = staking.userRewardPerTokenPaid(alice, 1);
        rewardPerToken = staking.rewardPerToken();
        earned = _getEarned(stakeAmount, rewardPerToken, userRewardPerTokenPaid, _getVestingRate(alice, 1));
        assertEq(staking.earned(alice, 1), earned);
        aliceBalanceBefore = templeGold.balanceOf(alice);
        staking.getReward(alice, 1);
        aliceBalanceAfter = templeGold.balanceOf(alice);
        assertEq(earned, aliceBalanceAfter-aliceBalanceBefore);
        
        skip(9 weeks);
        staking.getReward(alice, 1);
        staking.getReward(alice, 2);
        templeGold.balanceOf(address(staking));

        skip(3 weeks);
        staking.getReward(alice, 1);
        staking.getReward(alice, 2);
        aliceBalanceAfter = templeGold.balanceOf(alice);
        ITempleGoldStaking.StakeInfo memory _stakeInfo = staking.getAccountStakeInfo(alice, 1);
        rewardData = staking.getRewardData();
        vm.warp(rewardData.periodFinish);
        staking.getReward(alice, 1);
        // no more rewards for stake index 1
        assertEq(staking.earned(alice, 1), 0);
        staking.distributeRewards();
        rewardData = staking.getRewardData();
        vm.warp(rewardData.periodFinish);
        staking.getReward(alice, 2);
        // no more rewards for stake index 2
        assertEq(staking.earned(alice, 2), 0);
    }

    function test_getReward_tgldStaking_multiple_stakes_multiple_rewards_distribution() public {
        uint32 _vestingPeriod = 16 weeks;
        {
            // for distribution
            skip(3 days);
            _setVestingPeriod(_vestingPeriod);
            _setRewardDuration(_vestingPeriod);
            _setVestingFactor(templeGold);
        }
        uint256 stakeAmount = 100 ether;
        uint256 goldRewardsAmount;
        ITempleGoldStaking.Reward memory rewardDataOne;
        {
            vm.startPrank(alice);
            deal(address(templeToken), alice, 1000 ether, true);
            deal(address(templeToken), bob, 1000 ether, true);
            _approve(address(templeToken), address(staking), type(uint).max);
            staking.stake(stakeAmount);
            assertEq(staking.earned(alice, 1), 0);
            templeGold.balanceOf(address(staking));
            staking.distributeRewards();
            goldRewardsAmount = templeGold.balanceOf(address(staking));
            assertEq(staking.earned(alice, 1), 0);
            rewardDataOne = staking.getRewardData();
        }
        uint256 userRewardPerTokenPaid;
        uint256 rewardPerToken;
        uint256 earned;
        uint256 aliceBalanceBefore; 
        uint256 aliceBalanceAfter;
        uint256 vestingRate;
        {
            skip(1 weeks);
            userRewardPerTokenPaid = staking.userRewardPerTokenPaid(alice, 1);
            rewardPerToken = staking.rewardPerToken();
            vestingRate = _getVestingRate(alice, 1);
            earned = _getEarned(stakeAmount, rewardPerToken, userRewardPerTokenPaid, vestingRate);
            assertEq(earned, staking.earned(alice, 1));
            aliceBalanceBefore = templeGold.balanceOf(alice);
            vm.expectEmit(address(staking));
            emit RewardPaid(alice, alice, 1, earned);
            staking.getReward(alice, 1);
            aliceBalanceAfter = templeGold.balanceOf(alice);
            assertEq(aliceBalanceAfter - aliceBalanceBefore, earned);
            assertEq(staking.claimableRewards(alice, 1), 0);
        }
        uint256 goldRewardsAmountTwo;
        ITempleGoldStaking.Reward memory rewardDataTwo;
        {
            skip(7 weeks);
            uint256 goldBalanceBefore = templeGold.balanceOf(address(staking));
            staking.distributeRewards();
            goldRewardsAmountTwo = templeGold.balanceOf(address(staking)) - goldBalanceBefore;
            rewardDataTwo = staking.getRewardData();
            uint256 remaining = uint256(rewardDataOne.periodFinish) - block.timestamp;
            uint256 leftover = remaining * rewardDataOne.rewardRate;
            uint256 rewardRate = uint216((goldRewardsAmountTwo + leftover) / _vestingPeriod);
            assertApproxEqAbs(rewardDataTwo.rewardRate, rewardRate, 1);
        }
        
        {
            vm.startPrank(bob);
            _approve(address(templeToken), address(staking), type(uint).max);
            staking.stake(stakeAmount);
            rewardPerToken = staking.rewardPerToken();
            assertEq(0, staking.userRewardPerTokenPaid(bob, 1));
            userRewardPerTokenPaid = staking.userRewardPerTokenPaid(bob, 1);
            vestingRate = _getVestingRate(bob, 1);
            earned = _getEarned(stakeAmount, rewardPerToken, userRewardPerTokenPaid, vestingRate);
            assertEq(earned, staking.earned(bob, 1));

            skip(8 weeks);
            staking.getReward(bob, 1);
            staking.getReward(alice, 1);
            assertEq(staking.earned(alice,1), 0);
            assertEq(staking.earned(bob, 1), 0);
        }
    }

    function test_stake_checkpoints() public {
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
        staking.stakeFor(bob, stakeAmount);
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
        uint32 _vestingPeriod = 16 weeks;
        {
            // for distribution
            skip(3 days);
            _setVestingPeriod(_vestingPeriod);
            _setRewardDuration(_vestingPeriod);
            _setVestingFactor(templeGold);
        }

        vm.startPrank(alice);
        staking.delegate(mike);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        staking.withdraw(0, 1, true);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InsufficientBalance.selector, address(templeToken), 1, 0));
        staking.withdraw(1, 1, true);

        uint256 stakeAmount = 100 ether;
        deal(address(templeToken), alice, 1000 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        uint256 blockNumber = block.number;
        staking.stakeFor(alice, stakeAmount);
        ITempleGoldStaking.Checkpoint memory _checkpoint = staking.getCheckpoint(mike, 0);
        assertEq(_checkpoint.fromBlock, blockNumber);
        assertEq(_checkpoint.votes, stakeAmount);
        assertEq(staking.numCheckpoints(mike), 1);
        
        vm.expectEmit(address(staking));
        emit Withdrawn(alice, alice, 1, 40 ether);
        staking.withdraw(40 ether, 1, false);
        assertEq(templeToken.balanceOf(alice), 940 ether);
        assertEq(staking.totalSupply(), 60 ether);
        // same block number
        _checkpoint = staking.getCheckpoint(mike, 0);
        assertEq(_checkpoint.fromBlock, blockNumber);
        assertEq(staking.numCheckpoints(mike), 1);
        assertEq(_checkpoint.votes, stakeAmount - 40 ether);
        assertEq(staking.numCheckpoints(mike), 1);

        // new block number
        blockNumber += 1;
        vm.roll(blockNumber);
        vm.expectEmit(address(staking));
        emit Withdrawn(alice, alice, 1, 60 ether);
        staking.withdrawAll(1, false);
        assertEq(templeToken.balanceOf(alice), 1000 ether);
        assertEq(staking.totalSupply(), 0);
        assertEq(staking.numCheckpoints(mike), 2);
        _checkpoint = staking.getCheckpoint(mike, 1);
        assertEq(_checkpoint.fromBlock, blockNumber);
        assertEq(_checkpoint.votes, 0);
        assertEq(staking.numCheckpoints(mike), 2);
    }

}