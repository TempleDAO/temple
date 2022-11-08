// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "forge-std/Test.sol";
import "../../contracts/admin/TempleTeamPaymentsFactory.sol";

contract TempleTeamPaymentsFactoryTest is Test {
    //
    uint256 testAllocationLength = 3;
    uint256 testLastEpoch = 17;
    address testUser = 0xa6E83976204969B278CcB5246EdB698Af6a0FAeF;

    //
    TempleTeamPaymentsFactory public factory;
    IERC20 public temple = IERC20(0x470EBf5f030Ed85Fc1ed4C2d36B9DD02e77CF1b7);
    address multisig = 0xe2Bb722DA825eBfFa1E368De244bdF08ed68B5c4;

    function setUp() public {
        factory = new TempleTeamPaymentsFactory(testLastEpoch);
        factory.transferOwnership(multisig);
    }

    function testDirectPayouts() public {
        uint256 prev = temple.balanceOf(testUser);

        address[] memory recip = new address[](testAllocationLength);
        for (uint256 i; i < recip.length; i++) {
            recip[i] = testUser;
        }

        uint256[] memory values = new uint256[](testAllocationLength);
        for (uint256 i; i < values.length; i++) {
            values[i] = (i + 1) * 1 ether;
        }
        vm.startPrank(multisig);
        temple.approve(address(factory), type(uint256).max);
        factory.directPayouts(temple, recip, values);
        vm.stopPrank();
        assertGt(temple.balanceOf(testUser), prev);
    }

    function testDeployPayouts() public returns (TempleTeamPaymentsV2) {
        address[] memory recip = new address[](testAllocationLength);
        for (uint256 i; i < recip.length; i++) {
            recip[i] = testUser;
        }

        uint256[] memory values = new uint256[](testAllocationLength);
        uint256 totalPaid;
        for (uint256 i; i < values.length; i++) {
            uint256 testAmount = (i + 1) * 1 ether;
            values[i] = testAmount;
            totalPaid += testAmount;
        }
        vm.startPrank(multisig);
        temple.approve(address(factory), type(uint256).max);

        TempleTeamPaymentsV2 testContract = factory.deployPayouts(
            temple,
            recip,
            values,
            totalPaid,
            block.timestamp + 1 days
        );
        vm.stopPrank();
        return testContract;
    }

    function testRecentRoundIncrements() public {
        uint256 prev = factory.lastPaidEpoch();
        testDirectPayouts();
        assertGt(factory.lastPaidEpoch(), prev);
    }

    function testCanClaim() public {
        TempleTeamPaymentsV2 testContract = testDeployPayouts();

        vm.warp(block.timestamp + 3 days);
        vm.startPrank(testUser);
        uint256 prev = testContract.temple().balanceOf(testUser);
        testContract.claim();
        assertGt(testContract.temple().balanceOf(testUser), prev);
    }

    function testFailCannotClaimEarly() public {
        TempleTeamPaymentsV2 testContract = testDeployPayouts();

        vm.startPrank(testUser);
        uint256 prev = testContract.temple().balanceOf(testUser);
        testContract.claim();
        assertGt(testContract.temple().balanceOf(testUser), prev);
    }

    function testFailClaimTwice() public {
        TempleTeamPaymentsV2 testContract = testDeployPayouts();

        vm.startPrank(testUser);
        uint256 prev = testContract.temple().balanceOf(testUser);
        testContract.claim();
        uint256 afterClaim = testContract.temple().balanceOf(testUser);
        assertGt(afterClaim, prev);

        testContract.claim();
        uint256 afterSecond = testContract.temple().balanceOf(testUser);
        assertEq(afterSecond, afterClaim);
    }

    function testFailPauseCannotClaim() public {
        TempleTeamPaymentsV2 testContract = testDeployPayouts();
        vm.stopPrank();
        vm.startPrank(multisig);
        testContract.toggleMember(testUser);
        vm.stopPrank();

        vm.startPrank(testUser);
        uint256 prev = testContract.temple().balanceOf(testUser);
        testContract.claim();
        assertEq(testContract.temple().balanceOf(testUser), prev);
    }
}
