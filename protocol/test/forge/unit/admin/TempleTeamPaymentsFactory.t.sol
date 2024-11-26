// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "forge-std/Test.sol";
import "contracts/admin/TempleTeamPaymentsFactory.sol";
import {TempleTest} from "../TempleTest.sol";

contract TempleTeamPaymentsFactoryTest is TempleTest {
    //
    TempleTeamPaymentsFactory public factory;
    IERC20 public temple = IERC20(0x470EBf5f030Ed85Fc1ed4C2d36B9DD02e77CF1b7);
    address multisig = 0xe2Bb722DA825eBfFa1E368De244bdF08ed68B5c4;
    address testUser = vm.addr(1);

    // factory events
    event FundingPaid(
        uint256 indexed fundingRound,
        address[] indexed dests,
        uint256[] indexed amounts
    );
    event FundingDeployed(
        uint256 indexed fundingRound,
        address[] indexed dests,
        uint256[] indexed amounts,
        address deployedTo
    );
    event ImplementationChanged(address indexed newImplementation);

    // payments events
    event Claimed(address indexed member, uint256 amount);
    event MemberToggled(address indexed member, bool status);
    event AllocationSet(address indexed member, uint256 allocation);

    // admin recovery events
    event TokenRecovered(address indexed token, uint256 amount);

    function setUp() public {
        fork("mainnet", 16060000);
        address impl = address(new TempleTeamPaymentsV2());
        factory = new TempleTeamPaymentsFactory(impl, 0);
        factory.transferOwnership(multisig);
    }

    function testDirectPayoutsAssertions(uint256 _length) internal {
        uint256[] memory previousBalances = new uint256[](_length);
        address[] memory recip = new address[](_length);
        uint256[] memory values = new uint256[](_length);
        for (uint256 i; i < recip.length; i++) {
            address test = vm.addr(i + 1);
            recip[i] = test;
            uint256 testAmount = (i + 1) * 1 ether;
            values[i] = testAmount;
            previousBalances[i] = temple.balanceOf(test);
        }

        vm.startPrank(multisig);
        temple.approve(address(factory), type(uint256).max);

        vm.expectEmit();
        emit FundingPaid(factory.lastPaidEpoch() + 1, recip, values);
        factory.directPayouts(temple, recip, values);
        vm.stopPrank();

        for (uint256 i; i < recip.length; i++) {
            address tester = vm.addr(i + 1);
            uint256 currentBalance = temple.balanceOf(tester);
            assertEq(currentBalance, previousBalances[i] + values[i]);
        }
    }

    function testDirectPayoutsSingle() public {
        uint256 lengthOfUsers = 1;
        testDirectPayoutsAssertions(lengthOfUsers);
    }

    function testDirectPayoutsMany() public {
        uint256 lengthOfUsers = 50;
        testDirectPayoutsAssertions(lengthOfUsers);
    }

    function testDeployPayoutsAssertions(
        uint256 _userTestLength
    ) internal returns (TempleTeamPaymentsV2) {
        address[] memory recip = new address[](_userTestLength);
        uint256[] memory values = new uint256[](_userTestLength);
        uint256 totalPaid;
        for (uint256 i; i < recip.length; i++) {
            address test = vm.addr(i + 1);
            recip[i] = test;
            uint256 testAmount = (i + 1) * 1 ether;
            values[i] = testAmount;
            totalPaid += testAmount;
        }

        vm.startPrank(multisig);
        temple.approve(address(factory), type(uint256).max);

        bytes32 salt = keccak256(
            abi.encodePacked(temple, factory.lastPaidEpoch() + 1)
        );
        address nextEpochClone = Clones.predictDeterministicAddress(
            factory.templeTeamPaymentsImplementation(),
            salt,
            address(factory)
        );
        vm.expectEmit();
        emit FundingDeployed(
            factory.lastPaidEpoch() + 1,
            recip,
            values,
            nextEpochClone
        );
        TempleTeamPaymentsV2 testContract = factory.deployPayouts(
            temple,
            recip,
            values,
            totalPaid
        );
        vm.stopPrank();

        for (uint256 i; i < recip.length; i++) {
            address tester = vm.addr(i + 1);
            uint256 currentBalance = testContract.allocation(tester);
            assertEq(currentBalance, values[i]);
        }

        return testContract;
    }

    function testDeployPayoutsSingle() public returns (TempleTeamPaymentsV2) {
        return testDeployPayoutsAssertions(1);
    }

    function testDeployPayoutsMany() public returns (TempleTeamPaymentsV2) {
        return testDeployPayoutsAssertions(50);
    }

    function testRoundIncrementsDirectPayout() public {
        uint256 prev = factory.lastPaidEpoch();
        testDirectPayoutsSingle();
        assertEq(factory.lastPaidEpoch(), prev + 1);
    }

    function testRoundIncrementsDeployPayout() public {
        uint256 prev = factory.lastPaidEpoch();
        testDeployPayoutsSingle();
        assertEq(factory.lastPaidEpoch(), prev + 1);
    }

    function testCanPauseMember() public {
        TempleTeamPaymentsV2 testContract = testDeployPayoutsSingle();

        bool prevState = testContract.paused(testUser);
        vm.expectEmit();
        emit MemberToggled(testUser, !prevState);
        vm.prank(multisig);
        testContract.toggleMember(testUser);
    }

    function testCanSetAllocation() public {
        TempleTeamPaymentsV2 testContract = testDeployPayoutsSingle();

        uint256 newAllocation = 123 ether;
        vm.expectEmit();
        emit AllocationSet(testUser, newAllocation);
        vm.prank(multisig);
        testContract.setAllocation(testUser, newAllocation);
    }

    function testCanClaimAllocation() public {
        TempleTeamPaymentsV2 testContract = testDeployPayoutsSingle();

        uint256 prev = temple.balanceOf(testUser);
        uint256 alloc = testContract.allocation(testUser);
        vm.expectEmit();
        emit Claimed(address(testUser), alloc);
        vm.prank(testUser);
        testContract.claim(type(uint256).max);

        assertEq(
            temple.balanceOf(testUser),
            prev + testContract.allocation(testUser)
        );
    }

    function testCanClaimAllocationPartial() public {
        TempleTeamPaymentsV2 testContract = testDeployPayoutsSingle();

        uint256 prev = temple.balanceOf(testUser);
        uint256 alloc = testContract.allocation(testUser);
        uint256 halfAlloc = alloc / 2;
        vm.expectEmit();
        emit Claimed(address(testUser), halfAlloc);
        vm.prank(testUser);
        testContract.claim(halfAlloc);

        vm.expectEmit();
        emit Claimed(address(testUser), halfAlloc);
        vm.prank(testUser);
        testContract.claim(halfAlloc);

        assertEq(
            temple.balanceOf(testUser),
            prev + testContract.allocation(testUser)
        );
    }

    function testCannotClaimTwice() public {
        TempleTeamPaymentsV2 testContract = testDeployPayoutsSingle();

        vm.startPrank(testUser);

        testContract.claim(type(uint256).max);

        vm.expectRevert(
            abi.encodeWithSelector(TempleTeamPaymentsV2.ClaimZeroValue.selector)
        );
        testContract.claim(type(uint256).max);
    }

    function testCannotClaimPause() public {
        TempleTeamPaymentsV2 testContract = testDeployPayoutsSingle();

        vm.prank(multisig);
        testContract.toggleMember(testUser);

        vm.expectRevert(
            abi.encodeWithSelector(
                TempleTeamPaymentsV2.ClaimMemberPaused.selector
            )
        );
        vm.prank(testUser);
        testContract.claim(type(uint256).max);
    }

    function testCannotInitializeTwice() public {
        TempleTeamPaymentsV2 testContract = testDeployPayoutsSingle();

        vm.expectRevert(abi.encodeWithSelector(Initializable.InvalidInitialization.selector));
        testContract.initialize(temple);
    }

    function testCannotSetAllocationsZeroAddress() public {
        TempleTeamPaymentsV2 testContract = testDeployPayoutsSingle();

        address[] memory addrs = new address[](1);
        addrs[0] = address(0);

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1 ether;

        vm.expectRevert(
            abi.encodeWithSelector(
                TempleTeamPaymentsV2.AllocationAddressZero.selector
            )
        );
        vm.prank(multisig);
        testContract.setAllocations(addrs, amounts);
    }

    function testCannotSetAllocationsLengthMismatch() public {
        TempleTeamPaymentsV2 testContract = testDeployPayoutsSingle();

        address[] memory addrs = new address[](1);
        addrs[0] = address(0);

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 1 ether;
        amounts[1] = 1 ether;

        vm.expectRevert(
            abi.encodeWithSelector(
                TempleTeamPaymentsV2.AllocationsLengthMismatch.selector
            )
        );
        vm.prank(multisig);
        testContract.setAllocations(addrs, amounts);
    }
}
