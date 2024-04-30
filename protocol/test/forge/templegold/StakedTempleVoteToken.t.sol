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
import { IStakedTempleVoteToken } from "contracts/interfaces/templegold/IStakedTempleVoteToken.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";

contract StakedTempleVoteTokenTestBase is TempleGoldCommon {
    event StakingSet(address _staking);
    event Paused(address account);
    event Unpaused(address account);
    event AuthoritySet(address indexed authority, bool authorized);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

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
        vm.stopPrank();
        
    }

    function test_initialization() public {
        assertEq(voteToken.rescuer(), rescuer);
        assertEq(voteToken.executor(), executor);
        assertEq(voteToken.staking(), address(staking));
        assertEq(voteToken.name(), NAME);
        assertEq(voteToken.symbol(), SYMBOL);
    }
}

contract StakedTempleVoteTokenAccessTest is StakedTempleVoteTokenTestBase {
    function test_setStaking_voteToken() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        voteToken.setStaking(address(staking));
    }

     function test_setAuthorized_voteToken() public {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        voteToken.setAuthorized(alice, true);
    }
}

contract StakedTempleVoteTokenTest is StakedTempleVoteTokenTestBase {
    function test_setStaking() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        voteToken.setStaking(address(0));

        vm.expectEmit(address(voteToken));
        emit StakingSet(address(staking));
        voteToken.setStaking(address(staking));
        assertEq(voteToken.staking(), address(staking));
    }

    function test_setAuthorized() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        voteToken.setAuthorized(address(0), false);

        vm.expectEmit(address(voteToken));
        emit AuthoritySet(alice, true);
        voteToken.setAuthorized(alice, true);
        assertEq(voteToken.authorized(alice), true);
        vm.expectEmit(address(voteToken));
        emit AuthoritySet(alice, false);
        voteToken.setAuthorized(alice, false);
        assertEq(voteToken.authorized(alice), false);

    }

     function test_mint_voteToken() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        voteToken.mint(address(0), 100 ether);

        voteToken.setAuthorized(executor, true);
        voteToken.pause();
        vm.expectRevert(abi.encodeWithSelector(Pausable.EnforcedPause.selector));
        voteToken.mint(address(0), 100 ether);

        voteToken.unpause();
        vm.expectEmit(address(voteToken));
        emit Transfer(address(0), alice, 1 ether);
        voteToken.mint(alice, 1 ether);
        assertEq(voteToken.balanceOf(alice), 1 ether);

        vm.expectEmit(address(voteToken));
        emit Transfer(address(0), bob, 1 ether);
        voteToken.mint(bob, 1 ether);
        assertEq(voteToken.balanceOf(bob), 1 ether);

        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(IStakedTempleVoteToken.NonTransferrable.selector));
        voteToken.transfer(bob, 1 ether);

        vm.startPrank(bob);
        vm.expectRevert(abi.encodeWithSelector(IStakedTempleVoteToken.NonTransferrable.selector));
        voteToken.transfer(alice, 1 ether);
    }

    function test_burn_voteToken() public {
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(IStakedTempleVoteToken.NotImplemented.selector));
        voteToken.burn(1 ether);
    }

    function test_burnFrom_voteToken() public {
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        voteToken.burnFrom(alice, 1 ether);

        vm.startPrank(executor);
        voteToken.pause();
        voteToken.setAuthorized(executor, true);
        vm.expectRevert(abi.encodeWithSelector(Pausable.EnforcedPause.selector));
        voteToken.burnFrom(alice, 1 ether);
        voteToken.unpause();
        voteToken.mint(alice, 1 ether);

        vm.expectEmit(address(voteToken));
        emit Transfer(alice, address(0), 1 ether);
        voteToken.burnFrom(alice, 1 ether);
        assertEq(voteToken.balanceOf(alice), 0);
    }

    function test_transfer_voteToken() public {
        /// @dev tested in mint.
        // testing not when paused
        vm.startPrank(executor);
        voteToken.pause();
        voteToken.setAuthorized(executor, true);
        vm.expectRevert(abi.encodeWithSelector(Pausable.EnforcedPause.selector));
        voteToken.transfer(alice, 1 ether);
        vm.expectRevert(abi.encodeWithSelector(Pausable.EnforcedPause.selector));
        voteToken.transferFrom(alice, bob, 1 ether);
    }

    function test_approve_voteToken() public {
        /// @dev testing approve when not paused
        // testing not when paused
        vm.startPrank(executor);
        voteToken.pause();
        voteToken.setAuthorized(executor, true);
        vm.expectRevert(abi.encodeWithSelector(Pausable.EnforcedPause.selector));
        voteToken.approve(alice, 1 ether);
    }

    function test_pauseUnpause_voteToken() public {
        /// @dev testing approve when not paused
        // testing not when paused
        vm.startPrank(executor);
        vm.expectEmit(address(voteToken));
        emit Paused(executor);
        voteToken.pause();
        vm.expectEmit(address(voteToken));
        emit Unpaused(executor);
        voteToken.unpause();
    }

    function test_getVoteweight_voteToken() public {
        /// @dev see TempleGoldStaking.t.sol
    }
}
