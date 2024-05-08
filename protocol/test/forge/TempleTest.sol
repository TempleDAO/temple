pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Test, StdChains } from "forge-std/Test.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { ITempleElevatedAccess } from "contracts/interfaces/v2/access/ITempleElevatedAccess.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice A forge test base class which can setup to use a fork, deploy UUPS proxies, etc
abstract contract TempleTest is Test {
    uint256 internal forkId;
    uint256 internal blockNumber;
    StdChains.Chain internal chain;

    address public unauthorizedUser = makeAddr("unauthorizedUser");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public operator = makeAddr("operator");
    address public executor = makeAddr("executor");
    address public rescuer = makeAddr("rescuer");

    // Fork using .env $<CHAIN_ALIAS>_RPC_URL (or the default RPC URL), and a specified blockNumber.
    function fork(string memory chainAlias, uint256 _blockNumber) internal {
        blockNumber = _blockNumber;
        chain = getChain(chainAlias);
        forkId = vm.createSelectFork(chain.rpcUrl, _blockNumber);
    }

    // Fork using .env $<CHAIN_ALIAS>_RPC_URL (or the default RPC URL), at latest blockNumber. Returns fork id
    function fork(string memory chainAlias) internal returns (uint256) {
        chain = getChain(chainAlias);
        return vm.createSelectFork(chain.rpcUrl);
    }

    function dealAdditional(IERC20 token, address to, uint256 additionalAmount) internal {
        deal(address(token), to, token.balanceOf(to) + additionalAmount, true);
    }

    /// @dev Deploy a new UUPS Proxy, given an implementation.
    /// There is no checking that the implmentation is a valid proxy here
    /// so until foundry has better utilities for this, best to deploy & test upgrades
    /// using hardhat/upgrades (which has really good sanity checks)
    function deployUUPSProxy(address _implementation) internal returns (address) {
        return address(new ERC1967Proxy(_implementation, ""));
    }

    function expectElevatedAccess() internal {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        vm.stopPrank();
    }

    function expectOnlyOwner() internal {
        vm.startPrank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, unauthorizedUser));
    }

    function setExplicitAccess(
        ITempleElevatedAccess theContract, 
        address allowedCaller, 
        bytes4 fnSelector, 
        bool value
    ) internal {
        ITempleElevatedAccess.ExplicitAccess[] memory access = new ITempleElevatedAccess.ExplicitAccess[](1);
        access[0] = ITempleElevatedAccess.ExplicitAccess(fnSelector, value);
        theContract.setExplicitAccess(allowedCaller, access);
    }

    function setExplicitAccess(
        ITempleElevatedAccess theContract, 
        address allowedCaller, 
        bytes4 fnSelector1, 
        bytes4 fnSelector2, 
        bool value
    ) internal {
        ITempleElevatedAccess.ExplicitAccess[] memory access = new ITempleElevatedAccess.ExplicitAccess[](2);
        access[0] = ITempleElevatedAccess.ExplicitAccess(fnSelector1, value);
        access[1] = ITempleElevatedAccess.ExplicitAccess(fnSelector2, value);
        theContract.setExplicitAccess(allowedCaller, access);
    }

}
