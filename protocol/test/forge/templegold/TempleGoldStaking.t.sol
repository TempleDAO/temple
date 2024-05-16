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

    function test_access_setVoteDelegate() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        staking.setVoteDelegate(alice, true);
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
        uint256 aliceTempleBalance = templeToken.balanceOf(alice);
        uint256 bobGoldBalance = templeGold.balanceOf(bob);
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
        vm.startPrank(executor);
        staking.setDistributionStarter(alice);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        staking.distributeRewards();
        
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
        vm.warp(block.timestamp + 3 days);
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

    function test_stake_tgldStaking() public {
        _setHalftime(1 days);
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        staking.stake(0);

        deal(address(templeToken), alice, 100 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        vm.expectEmit(address(staking));
        emit Staked(alice, 1 ether);
        staking.stake(1 ether);
        assertEq(staking.balanceOf(alice), 1 ether);

        uint256 ts = block.timestamp ;
        uint256 t = ts / 7 days * 7 days;
        uint256 weight = 1 ether * t / (t + 1 days);
        /// @dev Vote weights are always evaluated at the end of last week
        assertLt(staking.getVoteWeight(alice), 1 ether);
        assertEq(staking.getVoteWeight(alice), weight);
        /// @dev see test_vote_weight for more tests on vote weight

        // can stake for others
        vm.startPrank(bob);
        deal(address(templeToken), bob, 100 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        vm.startPrank(executor);
        staking.pause();
        vm.expectRevert(abi.encodeWithSelector(Pausable.EnforcedPause.selector));
        staking.stakeFor(alice, 10 ether);
        staking.unpause();
        vm.startPrank(bob);
        vm.expectEmit(address(staking));
        emit Staked(alice, 10 ether);
        staking.stakeFor(alice, 10 ether);
        assertEq(staking.balanceOf(alice), 11 ether);
        t += block.timestamp / 7 days * 7 days;
        weight = 11 ether * t / (t + 1 days);
        assertGt(staking.getVoteWeight(alice), 1 ether);
        assertApproxEqAbs(staking.getVoteWeight(alice), weight, 3e15);
    }

    // mike's delegated weight === alice weight + bob weight
    function _checkDelegatedWeight(uint256 aliceExpectedWeight, uint256 bobExpectedWeight) private {
        assertEq(staking.getVoteWeight(alice), aliceExpectedWeight);
        assertEq(staking.getDelegatedVoteWeight(alice), aliceExpectedWeight);

        assertEq(staking.getVoteWeight(bob), bobExpectedWeight);
        assertEq(staking.getDelegatedVoteWeight(bob), bobExpectedWeight);

        assertEq(staking.getVoteWeight(mike), 0);
        assertApproxEqAbs(
            staking.getDelegatedVoteWeight(mike), 
            aliceExpectedWeight + bobExpectedWeight, 
            1 // Might be slight rounding (+-1)
        );
    }

    function test_voteWeight_overTime() public {
        // From https://docs.yearn.fi/getting-started/products/yeth/overview#st-yeth-user-vote-weight
        // > The voting half-time variable determines the time it takes until half the voting weight
        // > is reached for a staker... Thus the wait to get to half of your st-yETH voting power is X days.
        //
        // So if we set this to 8 weeks, it should have half the voting power at 8 weeks
        _setHalftime(8 weeks);

        // Set right on the week boundry to get exact 
        vm.warp(block.timestamp / WEEK_LENGTH * WEEK_LENGTH);

        // Alice stakes 100
        vm.startPrank(alice);
        deal(address(templeToken), alice, 100 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(100 ether);

        // Immediately, Alice's voting power is... 100?
        // @todo @princetonbishop This looks wrong - shouldn't have a 100% voting power
        assertEq(staking.getVoteWeight(alice), 99.718409010911650827e18);

        // At the end of the first week
        skip(1 weeks);
        assertEq(staking.getVoteWeight(alice), 11.111111111111111111e18);

        // At the exact half time, it should be about half the voting power
        skip(7 weeks);
        assertEq(staking.getVoteWeight(alice), 50e18);

        // After another 8 weeks it's another half-life amount
        skip(8 weeks);
        assertEq(staking.getVoteWeight(alice), 66.666666666666666666e18);

        // And again
        skip(8 weeks);
        assertEq(staking.getVoteWeight(alice), 75e18);
    }

    function test_multiDelegate() public {
        _setHalftime(8 weeks);

        // Set right on the week boundry to get exact 
        vm.warp(block.timestamp / WEEK_LENGTH * WEEK_LENGTH);

        vm.startPrank(executor);
        staking.setVoteDelegate(mike, true);

        // Alice stakes 100 and delegates to Mike
        {
            vm.startPrank(alice);
            deal(address(templeToken), alice, 100 ether, true);
            _approve(address(templeToken), address(staking), type(uint).max);
            staking.stake(100 ether);
            staking.setUserVoteDelegate(mike);
        }

        // Bob stakes 100 and delegates to Mike
        {
            vm.startPrank(bob);
            deal(address(templeToken), bob, 100 ether, true);
            _approve(address(templeToken), address(staking), type(uint).max);
            staking.stake(100 ether);
            staking.setUserVoteDelegate(mike);
        }

        // Mike's delegated weight = alice's weight + bob's weight
        // @todo @princetonbishop This looks wrong - shouldn't have a 100% voting power
        _checkDelegatedWeight(99.718409010911650827e18, 99.718409010911650827e18);

        skip(1 weeks);
        _checkDelegatedWeight(11.111111111111111111e18, 11.111111111111111111e18);

        skip(7 weeks);
        _checkDelegatedWeight(50e18, 50e18);

        skip(16 weeks);
        _checkDelegatedWeight(75e18, 75e18);

        // Bob stakes another 50 (so his voting power increases by 50%)
        {
            vm.startPrank(bob);
            deal(address(templeToken), bob, 50 ether, true);
            staking.stake(50 ether);
            _checkDelegatedWeight(75e18, 75e18 * 150/100);
        }

        // Alice withdraws 25 (so her voting power decreases by 25%)
        {
            vm.startPrank(alice);
            staking.withdraw(25e18, false);
            _checkDelegatedWeight(75e18 * 3/4, 75e18 * 150/100);
        }

        // Skip another half life
        // @todo @princetonbishop The invariant no longer holds
        skip(8 weeks);
        _checkDelegatedWeight(60e18, 100e18);
    }

    function test_getReward_tgldStaking() public {
        vm.warp(block.timestamp + 3 days);
        templeGold.mint();
        vm.warp(staking.lastRewardNotificationTimestamp() + staking.rewardDistributionCoolDown() + 1);
        staking.distributeRewards();
        
        vm.startPrank(alice);
        uint256 amount = 10 ether;
        deal(address(templeToken), alice, 100 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(amount);

        uint256 aliceTempleGoldBalance = templeGold.balanceOf(alice);
        uint256 claimable = staking.earned(alice);
        staking.getReward(alice);
        assertEq(templeGold.balanceOf(alice), aliceTempleGoldBalance + claimable);
    }

    function test_withdraw_tgldStaking() public {
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
    }

    function test_earned_getReward_tgldStaking() public {
        vm.startPrank(alice);
        deal(address(templeToken), alice, 1000 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(100 ether);

        vm.warp(block.timestamp + 1 days);
        staking.distributeRewards();
        uint256 stakingGoldBalance = templeGold.balanceOf(address(staking));
        assertEq(staking.earned(alice), 0);

        vm.warp(block.timestamp + 1 days);
        uint256 rewardPerToken = staking.rewardPerToken();
        uint256 aliceEarned = (100 ether * rewardPerToken) / 1 ether;
        assertEq(staking.earned(alice), aliceEarned);

        vm.warp(block.timestamp + 1 days);
        uint256 rewardPerToken2 = staking.rewardPerToken();
        aliceEarned = (100 ether * (rewardPerToken2 - rewardPerToken)) / 1 ether + aliceEarned;
        assertEq(staking.earned(alice), aliceEarned);

        vm.startPrank(bob);
        deal(address(templeToken), bob, 1000 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(100 ether);

        vm.warp(block.timestamp + 1 days);
        uint256 rewardPerToken3 = staking.rewardPerToken();
        uint256 bobEarned = (100 ether * (rewardPerToken3-rewardPerToken2)) / 1 ether;
        assertEq(staking.earned(bob), bobEarned);

        // after 7 days all rewards should be distributed to stakers
        vm.warp(block.timestamp + 4 days);
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

        vm.warp(block.timestamp + 3 days);
        staking.distributeGold();
        ITempleGoldStaking.Reward memory rdata = staking.getRewardData();

        vm.startPrank(executor);
        staking.setRewardDistributionCoolDown(1 hours);
        vm.warp(block.timestamp + 1 days);
        uint256 balanceBefore = templeGold.balanceOf(address(staking));
        staking.distributeRewards();
        uint256 balanceAfter = templeGold.balanceOf(address(staking));

        rdata = staking.getRewardData();
        uint256 remaining = uint256(rdata.periodFinish) - block.timestamp;
        uint256 leftover = remaining * rdata.rewardRate;
        uint256 rewardRate = uint216((balanceAfter - balanceBefore + leftover) / 7 days);
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

    function test_setVoteDelegate() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        staking.setVoteDelegate(address(0), true);

        vm.expectEmit(address(staking));
        emit VoteDelegateSet(alice, true);
        staking.setVoteDelegate(alice, true);
        assertEq(staking.delegates(alice), true);

        vm.expectEmit(address(staking));
        emit VoteDelegateSet(alice, false);
        staking.setVoteDelegate(alice, false);
        assertEq(staking.delegates(alice), false);

        /// @dev see test_stake_delegate_vote_weight for more 
    }

    function test_getDelegatedVoteWeight() public {

    }

    function test_setUserVoteDelegate() public {
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        staking.setUserVoteDelegate(address(0));

        vm.expectRevert(abi.encodeWithSelector(ITempleGoldStaking.InvalidDelegate.selector));
        staking.setUserVoteDelegate(bob);

        vm.startPrank(executor);
        staking.setVoteDelegate(bob, true);
        staking.setVoteDelegate(mike, true);

        vm.startPrank(alice);
        vm.expectEmit(address(staking));
        emit UserDelegateSet(alice, bob);
        staking.setUserVoteDelegate(bob);

        assertEq(staking.userDelegated(alice, bob), true);
        assertEq(staking.userDelegates(alice), bob);

        /// @dev see test_stake_delegate_vote_weight for more

        // set to another delegate
        vm.expectEmit(address(staking));
        emit UserDelegateSet(alice, mike);
        staking.setUserVoteDelegate(mike);
        assertEq(staking.userDelegated(alice, bob), false);
        assertEq(staking.userDelegated(alice, mike), true);
        assertEq(staking.userDelegates(alice), mike);
    }

    function test_stake_delegate_vote_weight() public {
        vm.startPrank(executor);
        staking.setVoteDelegate(bob, true);
        staking.setVoteDelegate(executor, true);
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
        assertEq(staking.getDelegatedVoteWeight(bob), stakeAmount * 5 / 6);

        // set delegate to false
        vm.startPrank(executor);
        staking.setVoteDelegate(bob, false);
        assertEq(staking.getDelegatedVoteWeight(bob), 0);
        assertEq(staking.getVoteWeight(alice), stakeAmount * 5 / 6);
    }

    function test_withdraw_delegate_vote_weight() public {
        vm.startPrank(executor);
        staking.setVoteDelegate(bob, true);
        staking.setVoteDelegate(executor, true);
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

        // alice withdraws
        staking.withdraw(stakeAmount, true);
        assertEq(staking.getDelegatedVoteWeight(bob), stakeAmount / 2);
        assertEq(staking.getVoteWeight(alice), 0);
        // mike withdraws
        vm.startPrank(mike);
        staking.withdraw(stakeAmount, true);
        assertEq(staking.getDelegatedVoteWeight(bob), 0);
        assertEq(staking.getVoteWeight(mike), 0);
    }

    function test_unsetUserVoteDelegate() public {
        vm.startPrank(executor);
        staking.setVoteDelegate(bob, true);
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(ITempleGoldStaking.InvalidDelegate.selector));
        staking.unsetUserVoteDelegate();

        staking.setUserVoteDelegate(bob);
        assertEq(staking.userDelegates(alice), bob);
        vm.expectEmit(address(staking));
        emit UserDelegateSet(alice, address(0));
        staking.unsetUserVoteDelegate();

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
        assertEq(staking.getDelegatedVoteWeight(bob), 0);
    }
}