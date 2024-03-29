// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./TempleTeamPaymentsV2.sol";
contract TempleTeamPaymentsFactory is Ownable {
    error AllocationsLengthMismatch();
    error AllocationAddressZero();
    error ClaimZeroValue();
    error ImplementationAddressZero();

    struct FundingData {
        address paymentContract;
        uint16 epoch;
        uint256 totalFunding;
    }

    address public templeTeamPaymentsImplementation;
    uint16 immutable public initialEpoch;
    uint16 public lastPaidEpoch;
    mapping(uint256 => FundingData) public epochsFunded;

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
    event TokenRecovered(address indexed token, uint256 amount);

    constructor(address _implementation, uint16 _lastPaidEpoch) Ownable(msg.sender) {
        templeTeamPaymentsImplementation = _implementation;
        lastPaidEpoch = _lastPaidEpoch;
        initialEpoch = _lastPaidEpoch + 1;
    }

    function incrementEpoch(
        address _paymentContract,
        uint256 _totalFunding
    ) internal {
        FundingData memory data = FundingData({
            paymentContract: address(_paymentContract),
            totalFunding: _totalFunding,
            epoch: lastPaidEpoch++
        });
        epochsFunded[lastPaidEpoch] = data;
    }

    function withdrawToken(IERC20 _token, uint256 _amount) external onlyOwner {
        if (_amount == 0) revert ClaimZeroValue();
        SafeERC20.safeTransfer(_token, msg.sender, _amount);
        emit TokenRecovered(address(_token), _amount);
    }

    function setTempleTeamPaymentsImplementation(
        address _templeTeamPaymentsImplementation
    ) external onlyOwner {
        if (_templeTeamPaymentsImplementation == address(0))
            revert ImplementationAddressZero();
        templeTeamPaymentsImplementation = _templeTeamPaymentsImplementation;
        emit ImplementationChanged(_templeTeamPaymentsImplementation);
    }

    /**
     * @dev Deploys a new TempleTeamPayments contract, setAllocations to _dests and _allocations, funded with _totalFunding as _temple tokens, available to claim at _startTimestamp
     * @param _dests the recipient of the tokens
     * @param _allocations the recipients respective amounts
     * @param _totalFunding the total funding to supply the contract with initially
     */
    function deployPayouts(
        IERC20 _token,
        address[] calldata _dests,
        uint256[] calldata _allocations,
        uint256 _totalFunding
    ) external onlyOwner returns (TempleTeamPaymentsV2) {
        bytes32 salt = keccak256(abi.encodePacked(_token, lastPaidEpoch + 1));
        TempleTeamPaymentsV2 paymentContract = TempleTeamPaymentsV2(
            Clones.cloneDeterministic(templeTeamPaymentsImplementation, salt)
        );
        paymentContract.initialize(_token);
        paymentContract.setAllocations(_dests, _allocations);

        paymentContract.transferOwnership(msg.sender);

        if (_totalFunding != 0)
            SafeERC20.safeTransferFrom(
                _token,
                msg.sender,
                address(paymentContract),
                _totalFunding
            );

        incrementEpoch(address(paymentContract), _totalFunding);

        emit FundingDeployed(
            lastPaidEpoch,
            _dests,
            _allocations,
            address(paymentContract)
        );

        return paymentContract;
    }

    /**
     * @dev Directly transfers _temple tokens to _dests and _allocations
     * @param _dests the recipient of the tokens
     * @param _allocations the recipients respective amounts
     */
    function directPayouts(
        IERC20 _token,
        address[] calldata _dests,
        uint256[] calldata _allocations
    ) external onlyOwner {
        if (_dests.length != _allocations.length)
            revert AllocationsLengthMismatch();

        uint256 totalFunding;
        for (uint256 i; i < _dests.length; ) {
            address dest = _dests[i];
            if (dest == address(0)) revert AllocationAddressZero();
            uint256 value = _allocations[i];
            if (value == 0) revert ClaimZeroValue();
            SafeERC20.safeTransferFrom(_token, msg.sender, dest, value);
            totalFunding += value;
            unchecked {
                i++;
            }
        }

        incrementEpoch(address(this), totalFunding);

        emit FundingPaid(lastPaidEpoch, _dests, _allocations);
    }
}
