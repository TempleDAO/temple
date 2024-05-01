pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// (tests/forge/templegold/StakedTempleVoteToken.t.sol)


import { TempleGoldCommon } from "./TempleGoldCommon.t.sol";
import { StakedTempleVoteToken } from "contracts/templegold/StakedTempleVoteToken.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";
import { TempleGold } from "contracts/templegold/TempleGold.sol";
import { TempleGoldStaking } from "contracts/templegold/TempleGoldStaking.sol";
import { ITempleGold } from "contracts/interfaces/templegold/ITempleGold.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { DaiGoldAuction } from "contracts/templegold/DaiGoldAuction.sol";
import { ITempleGoldStaking } from "contracts/interfaces/templegold/ITempleGoldStaking.sol";

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

    IERC20 public bidToken;
    IERC20 public bidToken2;
    DaiGoldAuction public daiGoldAuction;
    FakeERC20 public templeToken;
    StakedTempleVoteToken public voteToken;
    TempleGoldStaking public staking;
    TempleGold public templeGold;

    string public constant NAME = "Staked Temple Vote Token";
    string public constant SYMBOL = "stTemple";
    function setUp() public {
        fork("arbitrum_one", forkBlockNumber);

        ITempleGold.InitArgs memory initArgs;
        initArgs.executor = executor;
        initArgs.staking = address(0);
        initArgs.escrow = address(0);
        initArgs.gnosis = teamGnosis;
        initArgs.layerZeroEndpoint = layerZeroEndpointArbitrumOne;
        initArgs.mintChainId = arbitrumOneChainId;
        initArgs.name = TEMPLE_GOLD_NAME;
        initArgs.symbol = TEMPLE_GOLD_SYMBOL;

        templeGold = new TempleGold(initArgs);
        templeToken = new FakeERC20("Temple Token", "TEMPLE", executor, 1000 ether);
        voteToken = new StakedTempleVoteToken(rescuer, executor,address(0), NAME, SYMBOL);
        staking = new TempleGoldStaking(rescuer, executor, address(templeToken), address(templeGold), address(voteToken));
        vm.startPrank(executor);
        voteToken.setStaking(address(staking));
        templeGold.authorizeContract(address(staking), true);
        voteToken.setAuthorized(address(staking), true);
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
        staking.migrateWithdraw(bob, 100 ether);
        uint256 aliceTempleBalance = templeToken.balanceOf(alice);
        uint256 bobGoldBalance = templeGold.balanceOf(bob);
        // distribute rewards to earn
        vm.warp(block.timestamp + 2 days);
        staking.distributeRewards();
        uint256 bobEarned = staking.earned(bob);
        vm.startPrank(alice);
        vm.expectEmit(address(staking));
        emit Withdrawn(bob, alice, 100 ether);
        staking.migrateWithdraw(bob, 100 ether);
        assertEq(templeToken.balanceOf(alice), aliceTempleBalance + 100 ether);
        assertEq(templeGold.balanceOf(bob), bobGoldBalance + bobEarned);
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
        staking.setRewardDistributionCoolDown(1 days);
        assertEq(staking.rewardDistributionCoolDown(), 1 days);
        // anyone can call
        staking.setDistributionStarter(address(0));
        // zero minted, so no reward notification from TGLD
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        staking.distributeRewards();

        // forward to mint something
        // vm.warp(block.timestamp + 1000 seconds);
        // // not enough cooldown
        // vm.expectRevert(abi.encodeWithSelector(ITempleGoldStaking.CannotDistribute.selector));
        // staking.distributeRewards();
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
        vm.expectEmit(address(voteToken));
        emit Transfer(address(0), alice, 1 ether);
        staking.stake(1 ether);
        assertEq(staking.balanceOf(alice), 1 ether);
        assertEq(voteToken.balanceOf(alice), 1 ether);

        uint256 ts = block.timestamp ;
        uint256 t = ts / 7 days * 7 days;
        uint256 weight = 1 ether * t / (t + 1 days);
        /// @dev Vote weights are always evaluated at the end of last week
        assertLt(staking.getVoteweight(alice), 1 ether);
        assertEq(staking.getVoteweight(alice), weight);
        /// @dev see test_getVoteWeight_tgldStaking for more tests on vote weight

        // can stake for others
        vm.startPrank(bob);
        deal(address(templeToken), bob, 100 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        vm.expectEmit(address(staking));
        emit Staked(alice, 10 ether);
        vm.expectEmit(address(voteToken));
        emit Transfer(address(0), alice, 10 ether);
        staking.stakeFor(alice, 10 ether);
        assertEq(staking.balanceOf(alice), 11 ether);
        assertEq(voteToken.balanceOf(alice), 11 ether);
        t += block.timestamp / 7 days * 7 days;
        weight = 11 ether * t / (t + 1 days);
        assertGt(staking.getVoteweight(alice), 1 ether);
        assertApproxEqAbs(staking.getVoteweight(alice), weight, 3e15);
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
        assertEq(voteToken.balanceOf(alice), 60 ether);
        assertEq(staking.totalSupply(), 60 ether);
        vm.expectEmit(address(staking));
        emit Withdrawn(alice, alice, 60 ether);
        staking.withdrawAll(false);
        assertEq(templeToken.balanceOf(alice), 1000 ether);
        assertEq(voteToken.balanceOf(alice), 0);
        assertEq(staking.totalSupply(), 0);
        assertEq(staking.getVoteweight(alice), 0);
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
        // uint256 rewardPerTokenPaid = staking.userRewardPerTokenPaid(alice);
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
    }

    function test_getVoteWeight_tgldStaking() public {
        uint64 _halftime = 60 days;
        _setHalftime(_halftime);
        vm.startPrank(alice);

        deal(address(templeToken), alice, 100 ether, true);
        _approve(address(templeToken), address(staking), type(uint).max);
        staking.stake(1 ether);

        uint256 ts = block.timestamp;
        uint256 t = ts / 7 days * 7 days;
        uint256 weight = 1 ether * t / (t + _halftime);
        /// @dev Vote weights are always evaluated at the end of last week
        assertLt(staking.getVoteweight(alice), 1 ether);
        assertEq(staking.getVoteweight(alice), weight);

        staking.stake(1 ether);
        t += block.timestamp / 7 days * 7 days;
        weight = 2 ether * t / (t + _halftime);
        assertLt(staking.getVoteweight(alice), 2 ether);
        assertApproxEqAbs(staking.getVoteweight(alice), weight, 1e14);

        vm.warp(block.timestamp + 1 days);
        t += block.timestamp / 7 days * 7 days;
        weight = 2 ether * t / (t + _halftime);
        assertLt(staking.getVoteweight(alice), 2 ether);
        assertApproxEqAbs(staking.getVoteweight(alice), weight, 1e14);

        // t = _prevBalance * t * _halfTime / (_newBalance * (t + _halfTime) - _prevBalance * t);
        uint256 prevWeightUpdateTime = block.timestamp;
        uint256 prevWeightStakeTime = 1 ether * t * _halftime / (2 ether * (t + _halftime) - 1 ether * t);
        uint256 prevWeightWeekTime = block.timestamp / 7 days;

        ITempleGoldStaking.AccountWeightParams memory accountWeight = staking.getAccountWeights(alice);
        vm.warp(block.timestamp + 7 days);
        staking.stake(10 ether);
        uint256 prevWeightUpdateTime2 = block.timestamp;
        uint256 prevWeightStakeTime2 = 2 ether * t * _halftime / (2 ether * (t + _halftime) - 2 ether * t);
        uint256 prevWeightWeekTime2 = block.timestamp / 7 days;
        // vm.warp(block.timestamp + 1 days);\
        /// @dev Vote weights are always evaluated at the end of last week
        // vote weight should be significantly less than previous
        // alice has 12 ether staked. but vote weight less than 7 ether
        // ts = block.timestamp;
        uint256 currentWeek = block.timestamp / 7 days - 1;
        ITempleGoldStaking.AccountWeightParams memory accountWeight2 = staking.getAccountWeights(alice);
        uint256 week = accountWeight.weekNumber;
        if (accountWeight2.weekNumber > currentWeek) {
            accountWeight2.weekNumber = uint64(accountWeight.weekNumber);
            accountWeight2.stakeTime = uint64(accountWeight.stakeTime);
            accountWeight2.updateTime = uint64(accountWeight.updateTime);
        }
        t = accountWeight2.stakeTime;
        if (week > 0) {
            t = t + (block.timestamp / 7 days * 7 days) - accountWeight2.updateTime;
        }
        
        weight = (12 ether * t) / (t + _halftime);
        // t = block.timestamp;
        // t += block.timestamp / 7 days * 7 days;
        // weight = 12 ether * t / (t + 1 days);
        // assertLt(staking.getVoteweight(alice), 7 ether);
        // assertApproxEqAbs(staking.getVoteweight(alice), weight, 1e14);
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
        assertEq(staking.getVoteweight(alice), amount / 2);

        // voting power doesnt change during the week
        ts += half_time;
        vm.warp(ts);
        assertEq(staking.getVoteweight(alice), amount / 2);

        // but is increased the week after, `t = half_time+week = 5*half_time`
        ts += WEEK_LENGTH;
        vm.warp(ts);
        assertEq(staking.getVoteweight(alice), amount * 5 / 6);
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
        uint256 lowVoteWeight = staking.getVoteweight(alice);

        // vm.warp(ts + WEEK_LENGTH);
        uint256 highVoteWeight = staking.getVoteweight(bob);

        // unauthorizedUser stakes second time middle of the week
        vm.warp(ts + WEEK_LENGTH / 2);
        vm.startPrank(unauthorizedUser);
        staking.stake(amount);

        vm.warp(ts + WEEK_LENGTH);
        uint256 midVoteWeight = staking.getVoteweight(unauthorizedUser);
        assertLt(lowVoteWeight, midVoteWeight);
        assertLt(lowVoteWeight, highVoteWeight);
    }
}