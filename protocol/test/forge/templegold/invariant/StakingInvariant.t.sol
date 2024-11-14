pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// (tests/forge/templegold/invariant/StakingInvariant.t.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { BaseInvariantTest } from "./BaseInvariant.t.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";
import { StakingHandler } from "./handlers/StakingHandler.sol";
import { TempleGoldStaking } from "contracts/templegold/TempleGoldStaking.sol";
import { TempleGold } from "contracts/templegold/TempleGold.sol";
import { DaiGoldAuction } from "contracts/templegold/DaiGoldAuction.sol";
import { ITempleGold } from "contracts/interfaces/templegold/ITempleGold.sol";
import { ITempleGoldStaking } from "contracts/interfaces/templegold/ITempleGoldStaking.sol";
import { console } from "forge-std/console.sol";


contract StakingInvariantTest is BaseInvariantTest {
    StakingHandler internal stakingHandler;

    TempleGoldStaking public staking;
    TempleGold public templeGold;
    FakeERC20 public templeToken;
    DaiGoldAuction public daiGoldAuction;

    uint256 public arbitrumOneForkId;
    IERC20 public bidToken;

    function setUp() public override {
        BaseInvariantTest.setUp();
        arbitrumOneForkId = fork("arbitrum_one");
        
        templeToken = new FakeERC20("Temple Token", "TEMPLE", executor, 1000 ether);
        ITempleGold.InitArgs memory initArgs = _getTempleGoldInitArgs();
        templeGold = new TempleGold(initArgs);
        bidToken = IERC20(daiToken);
        daiGoldAuction = new DaiGoldAuction(
            address(templeGold),
            address(bidToken),
            treasury,
            rescuer,
            executor,
            executor
        );
        staking = new TempleGoldStaking(
            rescuer,
            executor,
            address(templeToken),
            address(templeGold)
        );
        vm.startPrank(executor);
        _configureTempleGold();
        _configureStaking();
        _skipAndMint(2 weeks);
        // stake so we can distribute rewards
        doMint(address(templeToken), executor, 1 ether);
        _approve(address(templeToken), address(staking), 1 ether);
        staking.stake(1);
        uint256 rewardAmount = _distributeRewards();
        stakingHandler = new StakingHandler(
            timestampStore, stateStore,
            address(staking), address(templeToken),
            staking.totalSupply(),
            rewardAmount
        );
        vm.label({ account: address(stakingHandler), newLabel: "StakingHandler" });

        bytes4[] memory fnSelectors = new bytes4[](2);
        fnSelectors[0] = StakingHandler.stake.selector;
        fnSelectors[1] = StakingHandler.withdraw.selector;
        targetSelectors(
            address(stakingHandler),
            fnSelectors
        );

        targetSender(alice);
    }

    function _distributeRewards() private returns (uint256 rewards) {
        staking.distributeRewards();
        ITempleGoldStaking.Reward memory rData = staking.getRewardData();
        rewards = rData.rewardRate * staking.rewardDuration();
    }

    function _configureStaking() private {
        staking.setDistributionStarter(executor);
        staking.setRewardDuration(7 days);
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

    function _skipAndMint(uint256 skipTime) private {
        skip(skipTime);
        templeGold.mint();
    }

    /// @dev total amount staked matches total supply and total balance
    function invariant_total_supply_balance() external {
        uint256 balance = templeToken.balanceOf(address(staking));
        uint256 totalSupply = staking.totalSupply();
        assertEq(
            balance,
            totalSupply,
            "Invariant violation: balance must be equal to total supply"
        );
    }

    /**
     @dev Dump out the number of function calls made
     */
    function invariant_logCalls() external view {
        console.log("totalCalls: stakingHandler:", stakingHandler.totalCalls());
        console.log("\tstakingcHandler.stake:", stakingHandler.calls(StakingHandler.stake.selector));
    }
}