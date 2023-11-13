pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (tests/forge/nexus/PartnerZeroSacrifice.t.sol)


import { TempleTest } from "../TempleTest.sol";
import { Relic } from "../../../contracts/nexus/Relic.sol";
import { Shard } from "../../../contracts/nexus/Shard.sol";
import { NexusCommon } from "../../../contracts/nexus/NexusCommon.sol";
import { TempleERC20Token } from "../../../contracts/core/TempleERC20Token.sol";
import { CommonEventsAndErrors } from "../../../contracts/common/CommonEventsAndErrors.sol";
import { PartnerZeroSacrifice } from "../../../contracts/nexus/PartnerZeroSacrifice.sol";
import { IRelic } from "../../../contracts/interfaces/nexus/IRelic.sol";
import { IBaseSacrifice } from "../../../contracts/interfaces/nexus/IBaseSacrifice.sol";
import { IElevatedAccess } from "../../../contracts/interfaces/nexus/access/IElevatedAccess.sol";

contract MockPartnerProxy {
    IBaseSacrifice public partnerSacrifice;

    uint256 internal constant NON_ENCLAVE_ID = 10;
    constructor(address _partnerSacrifice) {
        partnerSacrifice = IBaseSacrifice(_partnerSacrifice);
    }

    function execute(address to) external {
        partnerSacrifice.sacrifice(NON_ENCLAVE_ID, to);
    }
}

contract PartnerZeroSacrificeTestBase is TempleTest {
    Relic public relic;
    NexusCommon public nexusCommon;
    PartnerZeroSacrifice public partnerSacrifice;
    MockPartnerProxy public mockPartnerProxy;

    string private constant NAME = "RELIC";
    string private constant SYMBOL = "REL";
    string internal constant BASE_URI = "http://example.com/";

    uint256 internal constant NON_ENCLAVE_ID = 10;

    event PartnerSacrifice(address to);

    function setUp() public {
        nexusCommon = new NexusCommon(executor);
        relic = new Relic(NAME, SYMBOL, address(nexusCommon), executor);
        partnerSacrifice = new PartnerZeroSacrifice(address(relic), executor);
        mockPartnerProxy = new MockPartnerProxy(address(partnerSacrifice));
        vm.startPrank(executor);
        nexusCommon.setEnclaveName(NON_ENCLAVE_ID, "NON_ENCLAVE");
        uint256[] memory enclaveIds = new uint256[](1);
        bool[] memory allow = new bool[](1);
        enclaveIds[0] = NON_ENCLAVE_ID;
        allow[0] = true;
        relic.setRelicMinterEnclaveIds(address(partnerSacrifice), enclaveIds, allow);
        // allow proxy sacrifice access
        IElevatedAccess.ExplicitAccess[] memory accessArray = new IElevatedAccess.ExplicitAccess[](1);
        IElevatedAccess.ExplicitAccess memory access;
        access.fnSelector =  bytes4(keccak256("sacrifice(uint256,address)"));
        access.allowed = true;
        accessArray[0] = access;
        partnerSacrifice.setExplicitAccess(address(mockPartnerProxy), accessArray);
        vm.stopPrank();
    }

    function test_initialization() public {
        assertEq(address(partnerSacrifice.relic()), address(relic));
        assertEq(partnerSacrifice.executor(), executor);
        assertEq(relic.isRelicMinter(address(partnerSacrifice), NON_ENCLAVE_ID), true);
    }
}

contract PartnerSacrificeAccessTest is PartnerZeroSacrificeTestBase {
    function test_access_sacrificeFail(address caller) public {
        vm.assume(caller != executor);
        vm.startPrank(caller);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        partnerSacrifice.sacrifice(NON_ENCLAVE_ID, alice);
    }

    function test_access_sacrificeSuccess() public {
        vm.startPrank(executor);
        partnerSacrifice.sacrifice(NON_ENCLAVE_ID, alice);
    }
}

contract PartnerSacrificeTest is PartnerZeroSacrificeTestBase {
    function test_getPrice() public {
        assertEq(partnerSacrifice.getPrice(), 0);
    }

    function test_sacrifice() public {
        vm.startPrank(executor);
        uint64 originTime = uint64(block.timestamp + 100);
        partnerSacrifice.setOriginTime(originTime);
        vm.expectRevert(abi.encodeWithSelector(IBaseSacrifice.FutureOriginTime.selector, originTime));
        partnerSacrifice.sacrifice(NON_ENCLAVE_ID, alice);

        // executor but not contract
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        vm.warp(originTime);
        partnerSacrifice.sacrifice(NON_ENCLAVE_ID, alice);

        vm.expectEmit(address(partnerSacrifice));
        emit PartnerSacrifice(alice);
        mockPartnerProxy.execute(alice);
    }
}