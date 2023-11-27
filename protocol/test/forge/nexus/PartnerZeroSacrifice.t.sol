pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (tests/forge/nexus/PartnerZeroSacrifice.t.sol)


import { NexusTestBase } from "./Nexus.t.sol";
import { Relic } from "../../../contracts/nexus/Relic.sol";
import { NexusCommon } from "../../../contracts/nexus/NexusCommon.sol";
import { CommonEventsAndErrors } from "../../../contracts/common/CommonEventsAndErrors.sol";
import { PartnerZeroSacrifice } from "../../../contracts/nexus/PartnerZeroSacrifice.sol";
import { IPartnerSacrifice, ISacrifice } from "../../../contracts/interfaces/nexus/IBaseSacrifice.sol";
import { IElevatedAccess } from "../../../contracts/interfaces/nexus/access/IElevatedAccess.sol";

contract MockPartnerProxy {
    IPartnerSacrifice public partnerSacrifice;

    uint256 internal constant NON_ENCLAVE_ID = 10;
    constructor(address _partnerSacrifice) {
        partnerSacrifice = IPartnerSacrifice(_partnerSacrifice);
    }

    function execute(address to) external returns (uint256 relicId) {
        relicId = partnerSacrifice.sacrifice(NON_ENCLAVE_ID, to);
    }
}

contract PartnerZeroSacrificeTestBase is NexusTestBase {
    Relic public relic;
    NexusCommon public nexusCommon;
    PartnerZeroSacrifice public partnerSacrifice;
    MockPartnerProxy public mockPartnerProxy;

    uint256 internal constant NON_ENCLAVE_ID = 10;

    event PartnerZeroSacrificed(address indexed to, uint256 relicId, uint256 enclaveId);

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
}

contract PartnerSacrificeAccessTest is PartnerZeroSacrificeTestBase {
    function test_initialization() public {
        assertEq(address(partnerSacrifice.relic()), address(relic));
        assertEq(partnerSacrifice.executor(), executor);
        assertEq(relic.isRelicMinter(address(partnerSacrifice), NON_ENCLAVE_ID), true);
    }

    function test_access_sacrificeFail(address caller) public {
        vm.assume(caller != executor && caller != address(mockPartnerProxy));
        vm.startPrank(caller);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        partnerSacrifice.sacrifice(NON_ENCLAVE_ID, alice);
    }

    function test_access_sacrificeSuccess() public {
        vm.startPrank(address(mockPartnerProxy));
        mockPartnerProxy.execute(alice);
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
        vm.expectRevert(abi.encodeWithSelector(ISacrifice.FutureOriginTime.selector, originTime));
        partnerSacrifice.sacrifice(NON_ENCLAVE_ID, alice);

        vm.warp(originTime);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        partnerSacrifice.sacrifice(NON_ENCLAVE_ID, address(0));

        // mint cap is 0
        uint256 relicId = relic.nextTokenId();
        uint256 totalMinted = partnerSacrifice.totalMinted();
        vm.expectEmit(address(partnerSacrifice));
        emit PartnerZeroSacrificed(alice, relicId, NON_ENCLAVE_ID);
        uint256 actualRelicId = mockPartnerProxy.execute(alice);
        assertEq(actualRelicId, relicId);
        assertEq(relic.ownerOf(relicId), alice);
        assertEq(partnerSacrifice.totalMinted(), totalMinted+1);

        // mint cap > 0
        uint256 mintCap = 2;
        partnerSacrifice.setMintCap(2);
        relicId = relic.nextTokenId();
        totalMinted = partnerSacrifice.totalMinted();
        vm.expectEmit(address(partnerSacrifice));
        emit PartnerZeroSacrificed(alice, relicId, NON_ENCLAVE_ID);
        mockPartnerProxy.execute(alice);
        assertEq(partnerSacrifice.totalMinted(), totalMinted+1);
        assertEq(relic.ownerOf(relicId), alice);

        vm.expectRevert(abi.encodeWithSelector(ISacrifice.MintCapExceeded.selector, mintCap+1));
        mockPartnerProxy.execute(alice);

        // update mintCap and mint
        partnerSacrifice.setMintCap(3);
        relicId = relic.nextTokenId();
        vm.expectEmit(address(partnerSacrifice));
        emit PartnerZeroSacrificed(alice, relicId, NON_ENCLAVE_ID);
        mockPartnerProxy.execute(alice);
        assertEq(partnerSacrifice.totalMinted(), totalMinted+2);
    }
}