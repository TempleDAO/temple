pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { GnosisSafe } from '@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol';
import { Enum } from '@gnosis.pm/safe-contracts/contracts/common/Enum.sol';

import { TempleTest } from "../../TempleTest.sol";
import { ThresholdSafeGuard, IThresholdSafeGuard } from "contracts/v2/safeGuards/ThresholdSafeGuard.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

contract MockContract {
    bool public someState;

    function doThing() external returns (bool) {
        someState = true;
        return true;
    }
    function doThing(string memory) external returns (bool) {
        someState = true;
        return true;
    }
    function doThing(string memory, uint256) external returns (bool) {
        someState = true;
        return true;
    }
    function doOther(string memory, uint256) external returns (bool) {
        someState = true;
        return true;
    }
}

contract ThresholdSafeGuardTestBase is TempleTest {
    address public executor = makeAddr("executor");
    ThresholdSafeGuard public guard;
    MockContract public mock;
    FakeERC20 public dai;
    uint256 public constant defaultSignaturesThreshold = 2;

    GnosisSafe public safe;
    address[] public safeOwners;

    function setUp() public {
        fork("mainnet", 16675385);

        guard = new ThresholdSafeGuard(gov, defaultSignaturesThreshold);
        mock = new MockContract();
        safe = GnosisSafe(payable(0x4D6175d58C5AceEf30F546C0d5A557efFa53A950));
        safeOwners = safe.getOwners();

        dai = new FakeERC20("DAI", "DAI", address(0), 0);
    }

    function signEOA(bytes32 dataHash, uint256 privateKey) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, dataHash);
        return abi.encodePacked(r, s, v);
    }

    // The transaction executor can sign in-situ - it's 'pre-approved'
    function signOwner(address owner) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = (1, bytes32(uint256(uint160(address(owner)))), bytes32("")); 
        return abi.encodePacked(r, s, v);
    }

    function addSafeOwners() internal returns (uint256, uint256) {
        changePrank(address(safe));
        (address newOwner2, uint256 pk2) = makeAddrAndKey("newOwner2");
        (address newOwner3, uint256 pk3) = makeAddrAndKey("newOwner3");

        safe.addOwnerWithThreshold(newOwner2, 2);
        safe.addOwnerWithThreshold(newOwner3, 2);
        return (pk2, pk3);
    }
}

contract ThresholdSafeGuardTestAdmin is ThresholdSafeGuardTestBase {
    event DisableGuardChecksSet(bool value);
    event DefaultSignaturesThresholdSet(uint256 threshold);
    event AddedExecutor(address indexed executor);
    event RemovedExecutor(address indexed executor);

    function test_initalization() public {
        assertEq(guard.gov(), gov);
        assertEq(guard.VERSION(), "1.0.0");
        assertEq(guard.disableGuardChecks(), false);
        assertEq(guard.defaultSignaturesThreshold(), defaultSignaturesThreshold);

        address[] memory _executors = guard.executors();
        assertEq(_executors.length, 0);
    }

    function test_setDisableGuardChecks(bool answer) public {
        vm.startPrank(gov);

        vm.expectEmit(true, true, true, true);
        emit DisableGuardChecksSet(answer);

        guard.setDisableGuardChecks(answer);
        assertEq(guard.disableGuardChecks(), answer);
    }

    function test_addAndRemoveExecutor() public {
        vm.startPrank(gov);

        {
            vm.expectRevert(abi.encodeWithSelector(IThresholdSafeGuard.InvalidAddress.selector));
            guard.addExecutor(address(0));

            vm.expectEmit(true, true, true, true);
            emit AddedExecutor(alice);

            guard.addExecutor(alice);
            guard.addExecutor(gov);
            address[] memory _executors = guard.executors();
            assertEq(_executors.length, 2);
            assertEq(_executors[0], alice);
            assertEq(_executors[1], gov);

            // Already exists
            vm.expectRevert(abi.encodeWithSelector(IThresholdSafeGuard.InvalidExecutor.selector));
            guard.addExecutor(gov);
        }

        {
            vm.expectRevert(abi.encodeWithSelector(IThresholdSafeGuard.InvalidAddress.selector));
            guard.removeExecutor(address(0));

            vm.expectEmit(true, true, true, true);
            emit RemovedExecutor(gov);
            guard.removeExecutor(gov);
            address[] memory _executors = guard.executors();
            assertEq(_executors.length, 1);
            assertEq(_executors[0], alice);

            // Doesn't exist
            vm.expectRevert(abi.encodeWithSelector(IThresholdSafeGuard.InvalidExecutor.selector));
            guard.removeExecutor(gov);
        }
    }

    function test_recoverToken() public {
        uint256 amount = 100 ether;
        deal(address(dai), address(guard), amount, true);

        vm.expectEmit(true, true, true, true);
        emit CommonEventsAndErrors.TokenRecovered(alice, address(dai), amount);

        vm.startPrank(gov);
        guard.recoverToken(address(dai), alice, amount);
        assertEq(dai.balanceOf(alice), amount);
        assertEq(dai.balanceOf(address(guard)), 0);
    }
}

contract ThresholdSafeGuardTestAccess is ThresholdSafeGuardTestBase {
    function test_access_setDisableGuardChecks() public {
        expectOnlyGov();
        guard.setDisableGuardChecks(true);
    }

    function test_access_addExecutor() public {
        expectOnlyGov();
        guard.addExecutor(alice);
    }

    function test_access_removeExecutor() public {
        expectOnlyGov();
        guard.removeExecutor(alice);
    }

    function test_access_setDefaultSignaturesThreshold() public {
        expectOnlyGov();
        guard.setDefaultSignaturesThreshold(3);
    }

    function test_access_setFunctionThreshold() public {
        expectOnlyGov();
        bytes4 fnSelector = bytes4(keccak256("doThing(string,uint256)"));
        guard.setFunctionThreshold(address(mock), fnSelector, 5);
    }

    function test_access_recoverToken() public {
        expectOnlyGov();
        guard.recoverToken(address(dai), alice, 100);
    }
}

contract ThresholdSafeGuardTest is ThresholdSafeGuardTestBase {
    event FunctionThresholdSet(address indexed contractAddr, bytes4 indexed functionSignature, uint256 threshold);

    function test_setFunctionThreshold(address contractAddr, bytes4 functionSignature, uint256 threshold) public {
        vm.startPrank(gov);

        if (contractAddr == address(0)) {
            vm.expectRevert(abi.encodeWithSelector(IThresholdSafeGuard.InvalidAddress.selector));
            guard.setFunctionThreshold(contractAddr, functionSignature, threshold);
        } else if (functionSignature == bytes4(0)) {
            vm.expectRevert(abi.encodeWithSelector(IThresholdSafeGuard.InvalidFunctionSignature.selector));
            guard.setFunctionThreshold(contractAddr, functionSignature, threshold);
        } else {
            vm.expectEmit(true, true, true, true);
            emit FunctionThresholdSet(contractAddr, functionSignature, threshold);

            guard.setFunctionThreshold(contractAddr, functionSignature, threshold);
            assertEq(guard.functionThresholds(contractAddr, functionSignature), threshold);

            // Check the derived getThreshold
            if (threshold == 0) {
                assertEq(guard.getThreshold(contractAddr, functionSignature), defaultSignaturesThreshold);
            } else {
                assertEq(guard.getThreshold(contractAddr, functionSignature), threshold);
            }
        }
    }

    function doCheck(bytes memory data, address _executor, bytes memory _signatures) public view {
        guard.checkTransaction(
            address(mock),
            0,
            data,
            Enum.Operation.Call,
            0,
            0,
            0,
            address(0),
            payable(0),
            _signatures,
            _executor
        );
    }

    function getTxHash(bytes memory data) public view returns (bytes32) {
        bytes memory txData = safe.encodeTransactionData(
            address(mock), 
            0, 
            data,
            Enum.Operation.Call,
            0,
            0,
            0,
            address(0),
            payable(0),
            safe.nonce() - 1 // Remove one from the nonce, as the Safe.execTransaction increased it prior to calling the guard.
        );
        return keccak256(txData);
    }

    function test_checkTransaction_notOwnerOrExecutor() public {
        changePrank(address(safe));
        vm.expectRevert(abi.encodeWithSelector(IThresholdSafeGuard.InvalidExecutor.selector));
        doCheck("", alice, "");
    }

    function test_checkTransaction_owner() public {
        changePrank(address(safe));

        // The default threshold == the safe's threshold - so this doesn't revert.
        doCheck("", safeOwners[0], "");
    }

    function test_checkTransaction_executor() public {
        changePrank(gov);
        guard.addExecutor(alice);

        // The default threshold == the safe's threshold - so this doesn't revert.
        changePrank(address(safe));
        doCheck("", alice, "");
    }

    function test_checkTransaction_safeThresholdOfOne() public {
        changePrank(address(safe));
        safe.changeThreshold(1);
        
        // If the safe's threshold == 1, then no further checks are done.
        doCheck("", safeOwners[0], "");
    }

    function test_checkTransaction_3Required_0Found() public {
        changePrank(gov);
        guard.setDefaultSignaturesThreshold(3);

        changePrank(address(safe));
        
        vm.expectRevert(abi.encodeWithSelector(IThresholdSafeGuard.DynamicSignatureThresholdNotMet.selector, 3, 0));
        doCheck("", safeOwners[0], "");
    }

    function test_checkTransaction_3Required_1Found() public {
        changePrank(gov);
        guard.setDefaultSignaturesThreshold(3);
        changePrank(address(safe));

        vm.expectRevert(abi.encodeWithSelector(IThresholdSafeGuard.DynamicSignatureThresholdNotMet.selector, 3, 1));
        doCheck("", safeOwners[0], signOwner(safeOwners[0]));
    }

    function test_checkTransaction_3Required_2Found() public {
        changePrank(gov);
        guard.setDefaultSignaturesThreshold(3);
        (uint256 pk2,) = addSafeOwners();

        bytes32 dataHash = getTxHash("");        
        bytes memory signature = bytes.concat(
            signOwner(safeOwners[0]), 
            signEOA(dataHash, pk2)
        );

        vm.expectRevert(abi.encodeWithSelector(IThresholdSafeGuard.DynamicSignatureThresholdNotMet.selector, 3, 2));
        doCheck("", safeOwners[0], signature);
    }

    function test_checkTransaction_3Required_3Found() public {
        changePrank(gov);
        guard.setDefaultSignaturesThreshold(3);
        (uint256 pk2, uint256 pk3) = addSafeOwners();

        bytes32 dataHash = getTxHash("");        
        bytes memory signature = bytes.concat(
            signOwner(safeOwners[0]), 
            signEOA(dataHash, pk2), 
            signEOA(dataHash, pk3)
        );

        doCheck("", safeOwners[0], signature);
    }

    function test_checkTransaction_badPreApproval() public {
        changePrank(gov);
        guard.setDefaultSignaturesThreshold(3);
        (uint256 pk2, uint256 pk3) = addSafeOwners();

        bytes32 dataHash = getTxHash("");        
        bytes memory signature = bytes.concat(
            signOwner(safeOwners[0]), 
            signEOA(dataHash, pk2), 
            signEOA(dataHash, pk3)
        );

        // Check with a different owner to what we signed with
        vm.expectRevert("GS025");
        doCheck("", safeOwners[1], signature);
    }

    function test_checkTransaction_withOverrideTresholdSet() public {
        changePrank(gov);
        bytes4 fnSelector = bytes4(keccak256("doThing(string,uint256)"));
        bytes4 fnSelector2 = bytes4(keccak256("doThing()"));

        guard.setFunctionThreshold(address(mock), fnSelector, 3);

        // Also add some extra fns to make sure it picks the right one.
        guard.setFunctionThreshold(address(mock), fnSelector2, 4);
        guard.setFunctionThreshold(address(mock), bytes4(keccak256("doOther(string,uint256)")), 5);

        // Add a couple more owners to the safe which we can sign on behalf of.
        (uint256 pk2, uint256 pk3) = addSafeOwners();

        bytes memory fnCall = abi.encodeWithSelector(fnSelector, "abc", 1);
        bytes32 dataHash = getTxHash(fnCall);
        bytes memory signature = bytes.concat(
            signOwner(safeOwners[0]),
            signEOA(dataHash, pk2),
            signEOA(dataHash, pk3)
        );
        doCheck(fnCall, safeOwners[0], signature);

        // Try once more with the other selector - it will need 4 signatures so will fail.
        {
            fnCall = abi.encodeWithSelector(fnSelector2);
            dataHash = getTxHash(fnCall);
            signature = bytes.concat(
                signOwner(safeOwners[0]),
                signEOA(dataHash, pk2),
                signEOA(dataHash, pk3)
            );
            vm.expectRevert(abi.encodeWithSelector(IThresholdSafeGuard.DynamicSignatureThresholdNotMet.selector, 4, 3));
            doCheck(fnCall, safeOwners[0], signature);
        }
    }

    function test_checkTransaction_disabled() public {
        changePrank(gov);
        bytes4 fnSelector = bytes4(keccak256("doThing(string,uint256)"));
        guard.setFunctionThreshold(address(mock), fnSelector, 3);
        bytes memory signature = signOwner(safeOwners[0]);
        bytes memory fnCall = abi.encodeWithSelector(fnSelector, "abc", 1);

        // Not enough signers
        {
            changePrank(address(safe));
            vm.expectRevert(abi.encodeWithSelector(IThresholdSafeGuard.DynamicSignatureThresholdNotMet.selector, 3, 1));
            doCheck(fnCall, safeOwners[0], signature);
        }

        // Not enough signers - disabled, so passes
        {
            changePrank(gov);
            guard.setDisableGuardChecks(true);
            doCheck(fnCall, safeOwners[0], signature);
        }

        // Re-enabled -- Not enough signers again
        {
            changePrank(gov);
            guard.setDisableGuardChecks(false);
            changePrank(address(safe));
            vm.expectRevert(abi.encodeWithSelector(IThresholdSafeGuard.DynamicSignatureThresholdNotMet.selector, 3, 1));
            doCheck(fnCall, safeOwners[0], signature);
        }
    }

}
