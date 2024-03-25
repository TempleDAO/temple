pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { GnosisSafe } from "@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol";
import { GnosisSafeProxyFactory } from "@gnosis.pm/safe-contracts/contracts/proxies/GnosisSafeProxyFactory.sol";
import { CompatibilityFallbackHandler } from "./CompatibilityFallbackHandler.forked.sol";
import { Enum } from "@gnosis.pm/safe-contracts/contracts/common/Enum.sol";

import { TempleTest } from "../../TempleTest.sol";
import { ThresholdSafeGuard, IThresholdSafeGuard } from "contracts/v2/safeGuards/ThresholdSafeGuard.sol";
import { FakeERC20 } from "contracts/fakes/FakeERC20.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

/* solhint-disable func-name-mixedcase */
contract MockContract {
    bool public someState;

    bytes4 public immutable doThing0Args_Selector;
    bytes4 public immutable doThing2Args_Selector;
    bytes4 public immutable doOther_Selector;
    bytes4 public immutable wycpnbqcyf_Selector;

    constructor() {
        // Need to hash doThing() because it's overloaded
        doThing0Args_Selector = bytes4(keccak256("doThing()"));
        doThing2Args_Selector = bytes4(keccak256("doThing(string,uint256)"));
        doOther_Selector = MockContract.doOther.selector;
        wycpnbqcyf_Selector = MockContract.wycpnbqcyf.selector;
    }

    function doThing() external returns (bool) {
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

    // A magic function with a signature of 0x00000000
    function wycpnbqcyf() external {
        someState = true;
    }

    receive() external payable {}
}

contract ThresholdSafeGuardTestBase is TempleTest {
    ThresholdSafeGuard public guard;
    MockContract public mock;
    FakeERC20 public dai;
    uint256 public constant DEFAULT_SIGNATURES_THRESHOLD = 2;

    GnosisSafe public safe;
    address[] public safeOwners;

    GnosisSafe private safeSingleton;
    GnosisSafeProxyFactory private safeProxyFactory;
    CompatibilityFallbackHandler private fallbackHandler;

    GnosisSafe public safeAsOwner;
    address[] public safeAsOwnerOwners;

    address[] public safeOwnerEOAs;
    mapping(address => uint256) private privateKeys;

    enum SignType {
        // The executor (also an owner) of the Safe tx can take a shortcut when signing (v == 1)
        AS_EXECUTOR,

        // An EOA (owner of the safe) signs the tx data (using vm.sign) (v == 27,28)
        AS_EOA_TX,

        // An EOA signs a particular Safe message (not just the tx data)
        AS_EOA_MESSAGE_FOR_SAFE,

        // Another upstream Safe is an owner, and signs via EIP-1271.
        // This builds the signature up by appending any other data
        // to the end of the regular signature
        AS_CONTRACT
    }

    struct SignSpec {
        SignType signType;
        address signerAddr;
    }

    enum ExpectSuccessOrFailure {
        SUCCESS,
        FAILURE_THRESHOLD,
        FAILURE_THRESHOLD_NESTED,
        FAILURE_THRESHOLD_UPSTREAM,
        FAILURE_INVALID_EXECUTOR,
        FAILURE_INCORRECT_EXECUTOR,
        FAILURE_ACCOUNTS_NOT_IN_ORDER
    }

    struct TransactionParams {
        uint256 value;
        bytes fnCall;
        SignSpec[] signers;
        SignSpec[] nestedSigners; // Used when one of the signers is a Safe itself (EIP-1271)
    }

    function setUp() public {
        fork("mainnet", 16675385);

        guard = new ThresholdSafeGuard(rescuer, executor, DEFAULT_SIGNATURES_THRESHOLD);
        mock = new MockContract();

        dai = new FakeERC20("DAI", "DAI", address(0), 0);

        // Create the Safe singleton/proxy
        {
            safeSingleton = new GnosisSafe();
            safeProxyFactory = new GnosisSafeProxyFactory();
            fallbackHandler = new CompatibilityFallbackHandler();
        }

        // Create owners
        {
            // 3 New EOA accounts as owners, created in sorted order.
            // 0x3aafB0f432EEBCeA44A1A27cd4B234304D6df89a
            Account memory acct = makeAccount("owner Z");
            safeOwnerEOAs.push(acct.addr);
            privateKeys[acct.addr] = acct.key;

            // 0x487D0a3F24C8e09a507C00BA8b803e68A992794F
            acct = makeAccount("owner A");
            safeOwnerEOAs.push(acct.addr);
            privateKeys[acct.addr] = acct.key;

            // 0x57DBAEC3f3Da6f22FFf6C82eFBd2cCca7F03caf1
            acct = makeAccount("owner Y");
            safeOwnerEOAs.push(acct.addr);
            privateKeys[acct.addr] = acct.key;

            // Also create a new Safe as one of the owners, threshold 2/3
            safeAsOwner = createSafeWithOwners(safeOwnerEOAs, 2);

            // Now create the safe, threshold 2/4
            safeOwners.push(safeOwnerEOAs[0]);
            safeOwners.push(safeOwnerEOAs[1]);
            safeOwners.push(safeOwnerEOAs[2]);
            safeOwners.push(address(safeAsOwner));
            safe = createSafeWithOwners(safeOwners, 2); 

            // Do an initial transaction on the safe without the Guard
            {
                deal(address(safe), 1e18);
                execSafeTx(
                    ExpectSuccessOrFailure.SUCCESS,
                    safeOwners[0],
                    makeTransactionParams(
                        1e18, 
                        "", 
                        makeSignSpecs(
                            SignSpec(SignType.AS_EXECUTOR, safeOwners[0]),
                            SignSpec(SignType.AS_EOA_TX, safeOwners[1])
                        )
                    )
                );
            }
        }

    }

    function makeSignSpecs(SignSpec memory s1) internal pure returns (SignSpec[] memory specs) {
        specs = new SignSpec[](1);
        specs[0] = s1;
    }

    function makeSignSpecs(SignSpec memory s1, SignSpec memory s2) internal pure returns (SignSpec[] memory specs) {
        specs = new SignSpec[](2);
        specs[0] = s1;
        specs[1] = s2;
    }

    function makeSignSpecs(SignSpec memory s1, SignSpec memory s2, SignSpec memory s3) internal pure returns (SignSpec[] memory specs) {
        specs = new SignSpec[](3);
        specs[0] = s1;
        specs[1] = s2;
        specs[2] = s3;
    }

    function encodeTxData(
        uint256 value,
        bytes memory fnCall,
        bool forSafeGuard
    ) internal view returns (bytes memory txData) {
        // If it's directly checking the Safe Guard, then
        // subtract one from the nonce.
        // This is the Safe increments the nonce prior to calling the Safe Guard.
        uint256 _nonce = safe.nonce();
        _nonce = forSafeGuard ? _nonce - 1 : _nonce;

        txData = safe.encodeTransactionData({
            to: address(mock),
            value: value,
            data: fnCall,
            operation: Enum.Operation.Call,
            safeTxGas: 0,
            baseGas: 0,
            gasPrice: 0,
            gasToken: address(0),
            refundReceiver: payable(0),
            _nonce: _nonce
        });
    }
    
    function createSignature(SignSpec[] memory signers, bytes memory txData) internal view returns (bytes memory signature) {
        bytes32 txDataHash = keccak256(txData);

        bytes memory tsig;
        for (uint256 i; i < signers.length; ++i) {
            SignType signType = signers[i].signType;
            if (signType == SignType.AS_EXECUTOR) {
                tsig = signExecutor(signers[i].signerAddr);
            } else if (signType == SignType.AS_EOA_TX) {
                tsig = signEOA(txDataHash, signers[i].signerAddr);
            } else if (signType == SignType.AS_EOA_MESSAGE_FOR_SAFE) {
                bytes32 messageHash = CompatibilityFallbackHandler(address(safeAsOwner)).getMessageHash(txData);
                tsig = signEOA(messageHash, signers[i].signerAddr);
            } else if (signType == SignType.AS_CONTRACT) {
                tsig = signContract(signers[i].signerAddr, signers.length);
            } else {
                revert("Unknown SignType");
            }
            signature = bytes.concat(signature, tsig);
        }
    }

    function buildSignatures(TransactionParams memory txParams, bool forSafeGuard) internal view returns (bytes memory signatures) {
        bytes memory txData = encodeTxData(txParams.value, txParams.fnCall, forSafeGuard);
        signatures = createSignature(txParams.signers, txData);

        // Append any nested contract signatures (if there are any)
        if (txParams.nestedSigners.length > 0) {
            bytes memory nestedSigners = createSignature(txParams.nestedSigners, txData);
            nestedSigners = bytes.concat(bytes32(nestedSigners.length), nestedSigners);

            signatures = bytes.concat(signatures, nestedSigners);
        }
    }

    function makeTransactionParams(
        uint256 value,
        bytes memory fnCall,
        SignSpec[] memory signers
    ) internal pure returns (TransactionParams memory) {
        return TransactionParams(value, fnCall, signers, new SignSpec[](0));
    }

    function setExpectedRevert(ExpectSuccessOrFailure successOrFailure) internal {
        if (successOrFailure == ExpectSuccessOrFailure.FAILURE_THRESHOLD) {
            vm.expectRevert("!Dynamic Signature Threshold");
        } else if (successOrFailure == ExpectSuccessOrFailure.FAILURE_THRESHOLD_UPSTREAM) {
            // In the case of an upstream safe not having enough signatures
            vm.expectRevert("GS020");
        } else if (successOrFailure == ExpectSuccessOrFailure.FAILURE_THRESHOLD_NESTED) {
            // In the case of an upstream safe being one of the signers,
            // then if the total signature isn't big enough this error is thrown.
            vm.expectRevert("GS021");
        } else if (successOrFailure == ExpectSuccessOrFailure.FAILURE_INVALID_EXECUTOR) {
            vm.expectRevert(abi.encodeWithSelector(IThresholdSafeGuard.InvalidExecutor.selector));
        } else if (successOrFailure == ExpectSuccessOrFailure.FAILURE_INCORRECT_EXECUTOR) {
            vm.expectRevert("GS025");
        } else if (successOrFailure == ExpectSuccessOrFailure.FAILURE_ACCOUNTS_NOT_IN_ORDER) {
            vm.expectRevert("GS026");
        }
    }

    function checkTransaction(
        ExpectSuccessOrFailure successOrFailure,
        address _executor, 
        TransactionParams memory txParams
    ) public {
        vm.startPrank(address(safe));
        bytes memory signatures = buildSignatures(txParams, true);
        setExpectedRevert(successOrFailure);

        guard.checkTransaction({
            to: address(mock),
            value: txParams.value,
            data: txParams.fnCall,
            operation: Enum.Operation.Call,
            safeTxGas: 0,
            baseGas: 0,
            gasPrice: 0,
            gasToken: address(0),
            refundReceiver: payable(0),
            signatures: signatures,
            safeTxExecutor: _executor
        });
    }

    function execSafeTx(
        ExpectSuccessOrFailure successOrFailure,
        address _executor, 
        TransactionParams memory txParams
    ) internal {
        vm.startPrank(_executor);
        bytes memory signatures = buildSignatures(txParams, false);
        setExpectedRevert(successOrFailure);

        safe.execTransaction({
            to: address(mock),
            value: txParams.value,
            data: txParams.fnCall,
            operation: Enum.Operation.Call,
            safeTxGas: 0,
            baseGas: 0,
            gasPrice: 0,
            gasToken: address(0),
            refundReceiver: payable(0),
            signatures: signatures
        });
    }

    function createSafeWithOwners(address[] memory owners, uint256 threshold) internal returns (GnosisSafe newSafe){
        newSafe = GnosisSafe(payable(safeProxyFactory.createProxy(address(safeSingleton), "")));
        newSafe.setup(
            owners, 
            threshold, 
            address(0), 
            "", 
            address(fallbackHandler), 
            address(0), 
            0, 
            payable(0)
        );
    }

    // v == 28 || 28
    function signEOA(bytes32 dataHash, address signer) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKeys[signer], dataHash);
        return abi.encodePacked(r, s, v);
    }

    // This hits the EIP-1271 to sign for contracts.
    // v == 0
    // r == the contract address which must be an owner of the safe
    // s == a pointer to the start position of the contractSignature which is passed through to `signer.isValidSignature(data, contractSignature)`
    //      Each signer takes up 65 bits (1 + 32 + 32). So this is the bit position after those.
    function signContract(address signer, uint256 totalSigners) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = (0, bytes32(uint256(uint160(address(signer)))), bytes32(uint256(65*totalSigners))); 
        return abi.encodePacked(r, s, v);
    }

    // The transaction executor can sign in-situ - it's 'pre-approved'
    // v == 1
    // r == The signer which must be the current executor.
    // s == Empty
    function signExecutor(address signer) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = (1, bytes32(uint256(uint160(address(signer)))), bytes32("")); 
        return abi.encodePacked(r, s, v);
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
        vm.startPrank(executor);
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
        bytes4 fnSelector = mock.doThing2Args_Selector();
        expectElevatedAccess();
        guard.setFunctionThreshold(address(mock), fnSelector, 5);
    }

    function test_access_setFunctionThresholdBatch() public {
        bytes4[] memory fnSels = new bytes4[](2);
        fnSels[0] = mock.doThing2Args_Selector();
        fnSels[1] = mock.doThing0Args_Selector();

        expectElevatedAccess();
        guard.setFunctionThresholdBatch(address(mock), fnSels, 5);
    }

    function test_access_setEthTransferThreshold() public {
        expectElevatedAccess();
        guard.setEthTransferThreshold(address(mock), 5);
    }

    function test_access_recoverToken() public {
        expectElevatedAccess();
        guard.recoverToken(address(dai), alice, 100);
    }
}

contract ThresholdSafeGuardTest is ThresholdSafeGuardTestBase {
    event FunctionThresholdSet(address indexed contractAddr, bytes4 indexed functionSignature, uint256 threshold);
    event EthTransferThresholdSet(address indexed contractAddr, uint256 threshold);

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

    function test_setEthTransferThreshold(address contractAddr, uint256 threshold) public {
        vm.startPrank(executor);

        if (contractAddr == address(0)) {
            vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
            guard.setEthTransferThreshold(contractAddr, threshold);
        } else {
            vm.expectEmit();
            emit EthTransferThresholdSet(contractAddr, threshold);

            guard.setEthTransferThreshold(contractAddr, threshold);
            assertEq(guard.ethTransferThresholds(contractAddr), threshold);

            // Check the derived getThreshold
            if (threshold == 0) {
                assertEq(guard.getEthTransferThreshold(contractAddr), DEFAULT_SIGNATURES_THRESHOLD);
            } else {
                assertEq(guard.getEthTransferThreshold(contractAddr), threshold);
            }
        }
    }

    function test_checkTransaction_notExecutor() public {
        checkTransaction(
            ExpectSuccessOrFailure.FAILURE_INVALID_EXECUTOR,
            alice,
            makeTransactionParams(0, "", new SignSpec[](0))
        );
    }

    function test_checkTransaction_safeOwner() public {
        // The default threshold == the safe's threshold - so this doesn't revert.
        checkTransaction(
            ExpectSuccessOrFailure.SUCCESS,
            safeOwners[0],
            makeTransactionParams(0, "", new SignSpec[](0))
        );
    }

    function test_checkTransaction_executor() public {
        vm.startPrank(executor);
        guard.addSafeTxExecutor(alice);

        // The default threshold == the safe's threshold - so this doesn't revert.
        checkTransaction(
            ExpectSuccessOrFailure.SUCCESS,
            alice,
            makeTransactionParams(0, "", new SignSpec[](0))
        );
    }

    function test_checkTransaction_safeThresholdOfOne() public {
        vm.startPrank(address(safe));
        safe.changeThreshold(1);
        
        // If the safe's threshold == 1, then no further checks are done.
        checkTransaction(
            ExpectSuccessOrFailure.SUCCESS,
            safeOwners[0],
            makeTransactionParams(0, "", new SignSpec[](0))
        );
    }

    function test_checkTransaction_3Required_0Found() public {
        vm.startPrank(executor);
        guard.setDefaultSignaturesThreshold(3);

        checkTransaction(
            ExpectSuccessOrFailure.FAILURE_THRESHOLD,
            safeOwners[0],
            makeTransactionParams(0, "", new SignSpec[](0))
        );
    }

    function test_checkTransaction_3Required_1Found() public {
        vm.startPrank(executor);
        guard.setDefaultSignaturesThreshold(3);

        checkTransaction(
            ExpectSuccessOrFailure.FAILURE_THRESHOLD,
            safeOwners[0],
            makeTransactionParams(0, "", makeSignSpecs(
                SignSpec(SignType.AS_EXECUTOR, safeOwners[0]))
            )
        );
    }

    function test_checkTransaction_3Required_2Found() public {
        vm.startPrank(executor);
        guard.setDefaultSignaturesThreshold(3);

        checkTransaction(
            ExpectSuccessOrFailure.FAILURE_THRESHOLD,
            safeOwners[0], 
            makeTransactionParams(
                0, 
                "", 
                makeSignSpecs(
                    SignSpec(SignType.AS_EXECUTOR, safeOwners[0]),
                    SignSpec(SignType.AS_EOA_TX, safeOwners[1])
                )
            )
        );
    }

    function test_checkTransaction_3Required_3Found() public {
        vm.startPrank(executor);
        guard.setDefaultSignaturesThreshold(3);

        checkTransaction(
            ExpectSuccessOrFailure.SUCCESS,
            safeOwners[0], 
            makeTransactionParams(
                0, 
                "", 
                makeSignSpecs(
                    SignSpec(SignType.AS_EXECUTOR, safeOwners[0]),
                    SignSpec(SignType.AS_EOA_TX, safeOwners[1]),
                    SignSpec(SignType.AS_EOA_TX, safeOwners[2])
                )
            )
        );
    }

    function test_checkTransaction_3Required_DuplicateSigner() public {
        vm.startPrank(executor);
        guard.setDefaultSignaturesThreshold(3);

        checkTransaction(
            ExpectSuccessOrFailure.FAILURE_ACCOUNTS_NOT_IN_ORDER,
            safeOwners[0], 
            makeTransactionParams(
                0, 
                "", 
                makeSignSpecs(
                    SignSpec(SignType.AS_EXECUTOR, safeOwners[0]),
                    SignSpec(SignType.AS_EOA_TX, safeOwners[1]),
                    SignSpec(SignType.AS_EOA_TX, safeOwners[1])
                )
            )
        );
    }

    function test_checkTransaction_badPreApproval() public {
        vm.startPrank(executor);
        guard.setDefaultSignaturesThreshold(3);

        // Check with a different executor to what we signed with
        checkTransaction(
            ExpectSuccessOrFailure.FAILURE_INCORRECT_EXECUTOR,
            safeOwners[1], // Not the same as the AS_EXECUTOR below
            makeTransactionParams(
                0, 
                "", 
                makeSignSpecs(
                    SignSpec(SignType.AS_EXECUTOR, safeOwners[0]),
                    SignSpec(SignType.AS_EOA_TX, safeOwners[1]),
                    SignSpec(SignType.AS_EOA_TX, safeOwners[2])
                )
            )
        );
    }

    function test_checkTransaction_withOverrideTresholdSet_zeroSelector() public {
        vm.startPrank(executor);
        // Magically this function is hashed to `0x00000000`
        bytes4 fnSelector = mock.wycpnbqcyf_Selector();
        assertEq(fnSelector, bytes4(0));

        guard.setFunctionThreshold(address(mock), fnSelector, 3);

        // Fails with 2 signers
        checkTransaction(
            ExpectSuccessOrFailure.FAILURE_THRESHOLD,
            safeOwners[0], 
            makeTransactionParams(
                100e18, 
                abi.encodeWithSelector(fnSelector), 
                makeSignSpecs(
                    SignSpec(SignType.AS_EXECUTOR, safeOwners[0]),
                    SignSpec(SignType.AS_EOA_TX, safeOwners[1])
                )
            )
        );

        // OK with 3 signers
        checkTransaction(
            ExpectSuccessOrFailure.SUCCESS,
            safeOwners[0], 
            makeTransactionParams(
                100e18, 
                abi.encodeWithSelector(fnSelector), 
                makeSignSpecs(
                    SignSpec(SignType.AS_EXECUTOR, safeOwners[0]),
                    SignSpec(SignType.AS_EOA_TX, safeOwners[1]),
                    SignSpec(SignType.AS_EOA_TX, safeOwners[2])
                )
            )
        );
    }

    function test_checkTransaction_withOverrideThresholdSet() public {
        vm.startPrank(executor);
        bytes4 fnSelector = mock.doThing2Args_Selector();
        bytes4 fnSelector2 = mock.doThing0Args_Selector();

        guard.setFunctionThreshold(address(mock), fnSelector, 3);
        guard.setFunctionThreshold(address(mock), fnSelector2, 4);
        guard.setFunctionThreshold(address(mock), mock.doOther_Selector(), 5);

        // Success for fnSelector (threshold = 3)
        checkTransaction(
            ExpectSuccessOrFailure.SUCCESS,
            safeOwners[0], 
            makeTransactionParams(
                0, 
                abi.encodeWithSelector(fnSelector, "abc", 1), 
                makeSignSpecs(
                    SignSpec(SignType.AS_EXECUTOR, safeOwners[0]),
                    SignSpec(SignType.AS_EOA_TX, safeOwners[1]),
                    SignSpec(SignType.AS_EOA_TX, safeOwners[2])
                )
            )
        );

        // Fail for fnSelector2 (threshold = 4)
        checkTransaction(
            ExpectSuccessOrFailure.FAILURE_THRESHOLD,
            safeOwners[0], 
            makeTransactionParams(
                0, 
                abi.encodeWithSelector(fnSelector2), 
                makeSignSpecs(
                    SignSpec(SignType.AS_EXECUTOR, safeOwners[0]),
                    SignSpec(SignType.AS_EOA_TX, safeOwners[1]),
                    SignSpec(SignType.AS_EOA_TX, safeOwners[2])
                )
            )
        );
    }

    function test_checkTransaction_withContractSig() public {
        vm.startPrank(executor);
        bytes4 fnSelector = mock.doThing2Args_Selector();
        bytes4 fnSelector2 = mock.doThing0Args_Selector();

        guard.setFunctionThreshold(address(mock), fnSelector, 3);

        // Also add some extra fns to make sure it picks the right one.
        guard.setFunctionThreshold(address(mock), fnSelector2, 4);
        guard.setFunctionThreshold(address(mock), mock.doOther_Selector(), 5);

        // Succeed for fnSelector (threshold = 3)
        checkTransaction(
            ExpectSuccessOrFailure.SUCCESS,
            safeOwners[0], 
            TransactionParams(
                0, 
                abi.encodeWithSelector(fnSelector, "abc", 1), 
                makeSignSpecs(
                    SignSpec(SignType.AS_EXECUTOR, safeOwners[0]),
                    SignSpec(SignType.AS_EOA_TX, safeOwners[1]),
                    SignSpec(SignType.AS_CONTRACT, safeOwners[3]) // This is a Safe itself
                ),
                // Add the signer details Safe owner - only need 2/3 as this safe doesn't use the same guard
                makeSignSpecs(
                    SignSpec(SignType.AS_EOA_MESSAGE_FOR_SAFE, safeOwners[1]),
                    SignSpec(SignType.AS_EOA_MESSAGE_FOR_SAFE, safeOwners[2])
                )
            )
        );

        // Fail for fnSelector2 (threshold = 4)
        checkTransaction(
            ExpectSuccessOrFailure.FAILURE_THRESHOLD_NESTED,
            safeOwners[0], 
            TransactionParams(
                0, 
                abi.encodeWithSelector(fnSelector2), 
                makeSignSpecs(
                    SignSpec(SignType.AS_EXECUTOR, safeOwners[0]),
                    SignSpec(SignType.AS_EOA_TX, safeOwners[1]),
                    SignSpec(SignType.AS_CONTRACT, safeOwners[3]) // This is a Safe itself
                ),
                // Add the signer details Safe owner - only need 2/3 as this safe doesn't use the same guard
                makeSignSpecs(
                    SignSpec(SignType.AS_EOA_MESSAGE_FOR_SAFE, safeOwners[1]),
                    SignSpec(SignType.AS_EOA_MESSAGE_FOR_SAFE, safeOwners[2])
                )
            )
        );
    }

    function test_checkTransaction_disabled() public {
        vm.startPrank(executor);
        bytes4 fnSelector = mock.doThing2Args_Selector();
        guard.setFunctionThreshold(address(mock), fnSelector, 3);
        bytes memory fnCall = abi.encodeWithSelector(fnSelector, "abc", 1);

        // Not enough signers
        {
            checkTransaction(
                ExpectSuccessOrFailure.FAILURE_THRESHOLD,
                safeOwners[0],
                makeTransactionParams(0, fnCall, makeSignSpecs(
                    SignSpec(SignType.AS_EXECUTOR, safeOwners[0])
                ))
            );
        }

        // Not enough signers - disabled, so passes
        {
            vm.startPrank(rescuer);
            guard.setRescueMode(true);
            guard.setDisableGuardChecks(true);

            checkTransaction(
                ExpectSuccessOrFailure.SUCCESS,
                safeOwners[0],
                makeTransactionParams(0, fnCall, makeSignSpecs(
                    SignSpec(SignType.AS_EXECUTOR, safeOwners[0])
                ))
            );
        }

        // Re-enabled -- Not enough signers again
        {
            vm.startPrank(rescuer);
            guard.setDisableGuardChecks(false);
            guard.setRescueMode(false);

            checkTransaction(
                ExpectSuccessOrFailure.FAILURE_THRESHOLD,
                safeOwners[0],
                makeTransactionParams(0, fnCall, makeSignSpecs(
                    SignSpec(SignType.AS_EXECUTOR, safeOwners[0])
                ))
            );
        }
    }

}

contract ThresholdSafeGuardExecuteTest is ThresholdSafeGuardTestBase {

    function _setup() internal {
        // Set the guard
        vm.startPrank(address(safe));
        safe.setGuard(address(guard));

        // Fund the safe some ETH
        vm.deal(address(safe), 200e18);
    }

    function test_checkSafeExecute_withOverrideTresholdSet_ethTransfer() public {
        _setup();

        vm.startPrank(executor);
        guard.setEthTransferThreshold(address(mock), 3);

        assertEq(address(mock).balance, 1e18);
        assertEq(address(safe).balance, 200e18);

        // 2 signatures fails
        {
            execSafeTx(
                ExpectSuccessOrFailure.FAILURE_THRESHOLD,
                safeOwners[0],
                makeTransactionParams(
                    100e18, 
                    "", 
                    makeSignSpecs(
                        SignSpec(SignType.AS_EXECUTOR, safeOwners[0]),
                        SignSpec(SignType.AS_EOA_TX, safeOwners[1])
                    )
                )
            );

            assertEq(address(mock).balance, 1e18);
            assertEq(address(safe).balance, 200e18);
        }

        // 3 signatures succeeds
        {
            execSafeTx(
                ExpectSuccessOrFailure.SUCCESS,
                safeOwners[0],
                makeTransactionParams(
                    100e18, 
                    "", 
                    makeSignSpecs(
                        SignSpec(SignType.AS_EXECUTOR, safeOwners[0]),
                        SignSpec(SignType.AS_EOA_TX, safeOwners[1]),
                        SignSpec(SignType.AS_EOA_TX, safeOwners[2])
                    )
                )
            );
            assertEq(address(mock).balance, 101e18);
            assertEq(address(safe).balance, 100e18);
        }
    }

    function test_checkSafeExecute_withOverrideTresholdSet_function() public {
        _setup();

        vm.startPrank(executor);
        bytes4 fnSelector = mock.doThing2Args_Selector();
        guard.setFunctionThreshold(address(mock), fnSelector, 3);

        bytes memory fnCall = abi.encodeWithSelector(fnSelector, "abc", 1);

        // 2 signatures fails
        {
            execSafeTx(
                ExpectSuccessOrFailure.FAILURE_THRESHOLD,
                safeOwners[0],
                makeTransactionParams(
                    0, 
                    fnCall, 
                    makeSignSpecs(
                        SignSpec(SignType.AS_EXECUTOR, safeOwners[0]),
                        SignSpec(SignType.AS_EOA_TX, safeOwners[1])
                    )
                )
            );

            assertEq(address(mock).balance, 1e18);
            assertEq(address(safe).balance, 200e18);
            assertEq(mock.someState(), false);
        }

        // 3 signatures succeeds
        {
            execSafeTx(
                ExpectSuccessOrFailure.SUCCESS,
                safeOwners[0],
                makeTransactionParams(
                    0, 
                    fnCall, 
                    makeSignSpecs(
                        SignSpec(SignType.AS_EXECUTOR, safeOwners[0]),
                        SignSpec(SignType.AS_EOA_TX, safeOwners[1]),
                        SignSpec(SignType.AS_EOA_TX, safeOwners[2])
                    )
                )
            );
            assertEq(address(mock).balance, 1e18);
            assertEq(address(safe).balance, 200e18);
            assertEq(mock.someState(), true);
        }
    }

    function test_checkSafeExecute_withOverrideTresholdSet_withContractSig() public {
        _setup();

        vm.startPrank(executor);
        bytes4 fnSelector = mock.doThing2Args_Selector();
        guard.setFunctionThreshold(address(mock), fnSelector, 3);

        bytes memory fnCall = abi.encodeWithSelector(fnSelector, "abc", 1);

        // 1 upstream signatures fails
        {
            execSafeTx(
                ExpectSuccessOrFailure.FAILURE_THRESHOLD_UPSTREAM,
                safeOwners[0],
                TransactionParams(
                    0, 
                    fnCall, 
                    makeSignSpecs(
                        SignSpec(SignType.AS_EXECUTOR, safeOwners[0]),
                        SignSpec(SignType.AS_EOA_TX, safeOwners[1]),
                        SignSpec(SignType.AS_CONTRACT, safeOwners[3]) // This is a Safe itself
                    ),
                    // Add the signer details Safe owner
                    makeSignSpecs(
                        SignSpec(SignType.AS_EOA_MESSAGE_FOR_SAFE, safeOwners[1])
                    )
                )
            );

            assertEq(address(mock).balance, 1e18);
            assertEq(address(safe).balance, 200e18);
            assertEq(mock.someState(), false);
        }

        // 2 upstream signatures succeeds
        {
            execSafeTx(
                ExpectSuccessOrFailure.SUCCESS,
                safeOwners[0],
                TransactionParams(
                    0, 
                    fnCall, 
                    makeSignSpecs(
                        SignSpec(SignType.AS_EXECUTOR, safeOwners[0]),
                        SignSpec(SignType.AS_EOA_TX, safeOwners[1]),
                        SignSpec(SignType.AS_CONTRACT, safeOwners[3]) // This is a Safe itself
                    ),
                    // Add the signer details Safe owner
                    makeSignSpecs(
                        SignSpec(SignType.AS_EOA_MESSAGE_FOR_SAFE, safeOwners[1]),
                        SignSpec(SignType.AS_EOA_MESSAGE_FOR_SAFE, safeOwners[2])
                    )
                )
            );

            assertEq(address(mock).balance, 1e18);
            assertEq(address(safe).balance, 200e18);
            assertEq(mock.someState(), true);
        }
    }
}