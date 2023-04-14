pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { Test, StdChains } from "forge-std/Test.sol";
import { GovernableBase } from "contracts/common/access/Governable.sol";

/// @notice A forge test base class which can setup to use a fork, deploy UUPS proxies, etc
abstract contract TempleTest is Test {
    uint256 internal forkId;
    uint256 internal blockNumber;
    StdChains.Chain internal chain;

    address public unauthorizedUser = makeAddr("unauthorizedUser");
    address public alice = makeAddr("alice");
    address public operator = makeAddr("operator");
    address public gov = makeAddr("gov");

    // Fork using .env $<CHAIN_ALIAS>_RPC_URL (or the default RPC URL), and a specified blockNumber.
    function fork(string memory chainAlias, uint256 _blockNumber) internal {
        blockNumber = _blockNumber;
        chain = getChain(chainAlias);
        forkId = vm.createSelectFork(chain.rpcUrl, _blockNumber);
    }

    /// @dev Deploy a new UUPS Proxy, given an implementation.
    /// There is no checking that the implmentation is a valid proxy here
    /// so until foundry has better utilities for this, best to deploy & test upgrades
    /// using hardhat/upgrades (which has really good sanity checks)
    function deployUUPSProxy(address _implementation) internal returns (address) {
        return address(new ERC1967Proxy(_implementation, ""));
    }

    function expectOnlyOwner() internal {
        vm.prank(unauthorizedUser);
        vm.expectRevert("Ownable: caller is not the owner");
    }

    function expectOnlyGov() internal {
        vm.prank(unauthorizedUser);
        vm.expectRevert(abi.encodeWithSelector(GovernableBase.NotGovernor.selector));
    }
}
