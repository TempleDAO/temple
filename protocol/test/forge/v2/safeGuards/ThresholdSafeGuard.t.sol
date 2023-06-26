pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { GnosisSafe } from "@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol";
import { Enum } from "@gnosis.pm/safe-contracts/contracts/common/Enum.sol";

import { TempleTest } from "../../TempleTest.sol";
import { ThresholdSafeGuard, IThresholdSafeGuard } from "contracts/v2/safeGuards/ThresholdSafeGuard.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

/* solhint-disable func-name-mixedcase */
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
    ThresholdSafeGuard public guard;
    MockContract public mock;
    FakeERC20 public dai;
    uint256 public constant DEFAULT_SIGNATURES_THRESHOLD = 2;

    GnosisSafe public safe;
    address[] public safeOwners;

    function setUp() public {
        fork("mainnet", 16675385);

        guard = new ThresholdSafeGuard(rescuer, executor, DEFAULT_SIGNATURES_THRESHOLD);
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
    function signexecutor(address signer) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = (1, bytes32(uint256(uint160(address(signer)))), bytes32("")); 
        return abi.encodePacked(r, s, v);
    }

    function addSafeOwners() internal returns (uint256, uint256) {
        changePrank(address(safe));
        (address newexecutor2, uint256 pk2) = makeAddrAndKey("newexecutor2");
        (address newexecutor3, uint256 pk3) = makeAddrAndKey("newexecutor3");

        safe.addOwnerWithThreshold(newexecutor2, 2);
        safe.addOwnerWithThreshold(newexecutor3, 2);
        return (pk2, pk3);
    }
}

contract ThresholdSafeGuardTestAdmin is ThresholdSafeGuardTestBase {
    event DisableGuardChecksSet(bool value);
    event DefaultSignaturesThresholdSet(uint256 threshold);
    event SafeTxExecutorAdded(address indexed executor);
    event SafeTxExecutorRemoved(address indexed executor);

    function test_initalization() public {
        assertEq(guard.executor(), executor);
        assertEq(guard.rescuer(), rescuer);
        assertEq(guard.VERSION(), "1.0.0");
        assertEq(guard.disableGuardChecks(), false);
        assertEq(guard.defaultSignaturesThreshold(), DEFAULT_SIGNATURES_THRESHOLD);

        address[] memory executors = guard.safeTxExecutors();
        assertEq(executors.length, 0);
    }

    function test_setDisableGuardChecks(bool answer) public {
        vm.startPrank(rescuer);
        guard.setRescueMode(true);

        vm.expectEmit();
        emit DisableGuardChecksSet(answer);

        guard.setDisableGuardChecks(answer);
        assertEq(guard.disableGuardChecks(), answer);
    }

    function test_addAndremoveSafeTxExecutor() public {
        vm.startPrank(executor);

        {
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
            guard.addSafeTxExecutor(address(0));

            vm.expectEmit();
            emit SafeTxExecutorAdded(alice);

            guard.addSafeTxExecutor(alice);
            guard.addSafeTxExecutor(executor);
            address[] memory executors = guard.safeTxExecutors();
            assertEq(executors.length, 2);
            assertEq(executors[0], alice);
            assertEq(executors[1], executor);

            // Already exists
            vm.expectRevert(abi.encodeWithSelector(IThresholdSafeGuard.InvalidExecutor.selector));
            guard.addSafeTxExecutor(executor);
        }

        {
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
            guard.removeSafeTxExecutor(address(0));

            vm.expectEmit();
            emit SafeTxExecutorRemoved(executor);
            guard.removeSafeTxExecutor(executor);
            address[] memory executors = guard.safeTxExecutors();
            assertEq(executors.length, 1);
            assertEq(executors[0], alice);

            // Doesn't exist
            vm.expectRevert(abi.encodeWithSelector(IThresholdSafeGuard.InvalidExecutor.selector));
            guard.removeSafeTxExecutor(executor);
        }
    }

    function test_recoverToken() public {
        uint256 amount = 100 ether;
        deal(address(dai), address(guard), amount, true);

        vm.expectEmit();
        emit CommonEventsAndErrors.TokenRecovered(alice, address(dai), amount);

        vm.startPrank(executor);
        guard.recoverToken(address(dai), alice, amount);
        assertEq(dai.balanceOf(alice), amount);
        assertEq(dai.balanceOf(address(guard)), 0);
    }
}

contract ThresholdSafeGuardTestAccess is ThresholdSafeGuardTestBase {
    function test_access_setDisableGuardChecks() public {
        expectElevatedAccess();
        guard.setDisableGuardChecks(true);

        // Doesn't work for the executor
        vm.prank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        guard.setDisableGuardChecks(true);

        // Doesn't work for the rescuer unless in rescue mode
        vm.startPrank(rescuer);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        guard.setDisableGuardChecks(true);

        // Works in rescue mode
        guard.setRescueMode(true);
        guard.setDisableGuardChecks(true);

        // Still not for the executor
        changePrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        guard.setDisableGuardChecks(true);

    }

    function test_access_addSafeTxExecutor() public {
        expectElevatedAccess();
        guard.addSafeTxExecutor(alice);
    }

    function test_access_removeSafeTxExecutor() public {
        expectElevatedAccess();
        guard.removeSafeTxExecutor(alice);
    }

    function test_access_setDefaultSignaturesThreshold() public {
        expectElevatedAccess();
        guard.setDefaultSignaturesThreshold(3);
    }

    function test_access_setFunctionThreshold() public {
        expectElevatedAccess();
        bytes4 fnSelector = bytes4(keccak256("doThing(string,uint256)"));
        guard.setFunctionThreshold(address(mock), fnSelector, 5);
    }

    function test_access_setFunctionThresholdBatch() public {
        expectElevatedAccess();
        bytes4[] memory fnSels = new bytes4[](2);
        fnSels[0] = bytes4(keccak256("doThing(string,uint256)"));
        fnSels[1] = bytes4(keccak256("doThing()"));
        guard.setFunctionThresholdBatch(address(mock), fnSels, 5);
    }

    function test_access_recoverToken() public {
        expectElevatedAccess();
        guard.recoverToken(address(dai), alice, 100);
    }
}

contract ThresholdSafeGuardTest is ThresholdSafeGuardTestBase {
    event FunctionThresholdSet(address indexed contractAddr, bytes4 indexed functionSignature, uint256 threshold);

    function test_setFunctionThreshold(address contractAddr, bytes4 functionSignature, uint256 threshold) public {
        vm.startPrank(executor);

        if (contractAddr == address(0)) {
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
            guard.setFunctionThreshold(contractAddr, functionSignature, threshold);
        } else {
            vm.expectEmit();
            emit FunctionThresholdSet(contractAddr, functionSignature, threshold);

            guard.setFunctionThreshold(contractAddr, functionSignature, threshold);
            assertEq(guard.functionThresholds(contractAddr, functionSignature), threshold);

            // Check the derived getThreshold
            if (threshold == 0) {
                assertEq(guard.getThreshold(contractAddr, functionSignature), DEFAULT_SIGNATURES_THRESHOLD);
            } else {
                assertEq(guard.getThreshold(contractAddr, functionSignature), threshold);
            }
        }
    }

    function test_setFunctionThresholdBatch(address contractAddr, bytes4 functionSignature1, bytes4 functionSignature2, uint256 threshold) public {
        vm.startPrank(executor);

        bytes4[] memory fnSels = new bytes4[](2);
        fnSels[0] = functionSignature1;
        fnSels[1] = functionSignature2;

        if (contractAddr == address(0)) {
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
            guard.setFunctionThresholdBatch(contractAddr, fnSels, threshold);
        } else if (functionSignature1 == bytes4(0) || functionSignature2 == bytes4(0)) {
            vm.expectRevert(abi.encodeWithSelector(IThresholdSafeGuard.InvalidFunctionSignature.selector));
            guard.setFunctionThresholdBatch(contractAddr, fnSels, threshold);
        } else {
            vm.expectEmit();
            emit FunctionThresholdSet(contractAddr, functionSignature1, threshold);
            emit FunctionThresholdSet(contractAddr, functionSignature2, threshold);

            guard.setFunctionThresholdBatch(contractAddr, fnSels, threshold);
            assertEq(guard.functionThresholds(contractAddr, functionSignature1), threshold);
            assertEq(guard.functionThresholds(contractAddr, functionSignature2), threshold);

            // Check the derived getThreshold
            if (threshold == 0) {
                assertEq(guard.getThreshold(contractAddr, functionSignature1), DEFAULT_SIGNATURES_THRESHOLD);
                assertEq(guard.getThreshold(contractAddr, functionSignature2), DEFAULT_SIGNATURES_THRESHOLD);
            } else {
                assertEq(guard.getThreshold(contractAddr, functionSignature1), threshold);
                assertEq(guard.getThreshold(contractAddr, functionSignature2), threshold);
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

    function test_checkTransaction_notexecutorOrExecutor() public {
        vm.startPrank(address(safe));
        vm.expectRevert(abi.encodeWithSelector(IThresholdSafeGuard.InvalidExecutor.selector));
        doCheck("", alice, "");
    }

    function test_checkTransaction_safeOwner() public {
        vm.startPrank(address(safe));

        // The default threshold == the safe's threshold - so this doesn't revert.
        doCheck("", safeOwners[0], "");
    }

    function test_checkTransaction_executor() public {
        vm.startPrank(executor);
        guard.addSafeTxExecutor(alice);

        // The default threshold == the safe's threshold - so this doesn't revert.
        changePrank(address(safe));
        doCheck("", alice, "");
    }

    function test_checkTransaction_safeThresholdOfOne() public {
        vm.startPrank(address(safe));
        safe.changeThreshold(1);
        
        // If the safe's threshold == 1, then no further checks are done.
        doCheck("", safeOwners[0], "");
    }

    function test_checkTransaction_3Required_0Found() public {
        vm.startPrank(executor);
        guard.setDefaultSignaturesThreshold(3);

        changePrank(address(safe));
        
        vm.expectRevert("!Dynamic Signature Threshold");
        doCheck("", safeOwners[0], "");
    }

    function test_checkTransaction_3Required_1Found() public {
        vm.startPrank(executor);
        guard.setDefaultSignaturesThreshold(3);
        changePrank(address(safe));

        vm.expectRevert("!Dynamic Signature Threshold");
        doCheck("", safeOwners[0], signexecutor(safeOwners[0]));
    }

    function test_checkTransaction_3Required_2Found() public {
        vm.startPrank(executor);
        guard.setDefaultSignaturesThreshold(3);
        (uint256 pk2,) = addSafeOwners();

        bytes32 dataHash = getTxHash("");        
        bytes memory signature = bytes.concat(
            signexecutor(safeOwners[0]), 
            signEOA(dataHash, pk2)
        );

        vm.expectRevert("!Dynamic Signature Threshold");
        doCheck("", safeOwners[0], signature);
    }

    function test_checkTransaction_3Required_3Found() public {
        vm.startPrank(executor);
        guard.setDefaultSignaturesThreshold(3);
        (uint256 pk2, uint256 pk3) = addSafeOwners();

        bytes32 dataHash = getTxHash("");        
        bytes memory signature = bytes.concat(
            signexecutor(safeOwners[0]), 
            signEOA(dataHash, pk2), 
            signEOA(dataHash, pk3)
        );

        doCheck("", safeOwners[0], signature);
    }

    function test_checkTransaction_badPreApproval() public {
        vm.startPrank(executor);
        guard.setDefaultSignaturesThreshold(3);
        (uint256 pk2, uint256 pk3) = addSafeOwners();

        bytes32 dataHash = getTxHash("");        
        bytes memory signature = bytes.concat(
            signexecutor(safeOwners[0]), 
            signEOA(dataHash, pk2), 
            signEOA(dataHash, pk3)
        );

        // Check with a different executor to what we signed with
        vm.expectRevert("GS025");
        doCheck("", safeOwners[1], signature);
    }

    function test_checkTransaction_withOverrideTresholdSet_emptyData() public {
        vm.startPrank(executor);
        bytes4 fnSelector = bytes4(0);

        guard.setFunctionThreshold(address(mock), fnSelector, 3);

        // Add a couple more executors to the safe which we can sign on behalf of.
        (uint256 pk2, uint256 pk3) = addSafeOwners();

        // An empty function call (eg ETH transfer)
        bytes memory fnCall = bytes("");
        bytes32 dataHash = getTxHash(fnCall);
        bytes memory signature = bytes.concat(
            signexecutor(safeOwners[0]),
            signEOA(dataHash, pk2)
        );

        // Fails with 2 signers
        vm.expectRevert("!Dynamic Signature Threshold");
        doCheck(fnCall, safeOwners[0], signature);

        // OK with 3 signers
        signature = bytes.concat(
            signature,
            signEOA(dataHash, pk3)
        );
        doCheck(fnCall, safeOwners[0], signature);
    }

    function test_checkTransaction_withOverrideTresholdSet() public {
        vm.startPrank(executor);
        bytes4 fnSelector = bytes4(keccak256("doThing(string,uint256)"));
        bytes4 fnSelector2 = bytes4(keccak256("doThing()"));

        guard.setFunctionThreshold(address(mock), fnSelector, 3);

        // Also add some extra fns to make sure it picks the right one.
        guard.setFunctionThreshold(address(mock), fnSelector2, 4);
        guard.setFunctionThreshold(address(mock), bytes4(keccak256("doOther(string,uint256)")), 5);

        // Add a couple more executors to the safe which we can sign on behalf of.
        (uint256 pk2, uint256 pk3) = addSafeOwners();

        bytes memory fnCall = abi.encodeWithSelector(fnSelector, "abc", 1);
        bytes32 dataHash = getTxHash(fnCall);
        bytes memory signature = bytes.concat(
            signexecutor(safeOwners[0]),
            signEOA(dataHash, pk2),
            signEOA(dataHash, pk3)
        );
        doCheck(fnCall, safeOwners[0], signature);

        // Try once more with the other selector - it will need 4 signatures so will fail.
        {
            fnCall = abi.encodeWithSelector(fnSelector2);
            dataHash = getTxHash(fnCall);
            signature = bytes.concat(
                signexecutor(safeOwners[0]),
                signEOA(dataHash, pk2),
                signEOA(dataHash, pk3)
            );
            vm.expectRevert("!Dynamic Signature Threshold");
            doCheck(fnCall, safeOwners[0], signature);
        }
    }

    function test_checkTransaction_disabled() public {
        vm.startPrank(executor);
        bytes4 fnSelector = bytes4(keccak256("doThing(string,uint256)"));
        guard.setFunctionThreshold(address(mock), fnSelector, 3);
        bytes memory signature = signexecutor(safeOwners[0]);
        bytes memory fnCall = abi.encodeWithSelector(fnSelector, "abc", 1);

        // Not enough signers
        {
            changePrank(address(safe));
            vm.expectRevert("!Dynamic Signature Threshold");
            doCheck(fnCall, safeOwners[0], signature);
        }

        // Not enough signers - disabled, so passes
        {
            changePrank(rescuer);
            guard.setRescueMode(true);
            guard.setDisableGuardChecks(true);
            changePrank(bob);
            doCheck(fnCall, safeOwners[0], signature);
        }

        // Re-enabled -- Not enough signers again
        {
            changePrank(rescuer);
            guard.setDisableGuardChecks(false);
            guard.setRescueMode(false);

            changePrank(address(safe));
            vm.expectRevert("!Dynamic Signature Threshold");
            doCheck(fnCall, safeOwners[0], signature);
        }
    }

}
