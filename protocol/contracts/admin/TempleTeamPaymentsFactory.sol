// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./TempleTeamPaymentsV2.sol";

contract TempleTeamPaymentsFactory is Ownable {
    struct FundingData {
        address paymentContract;
        uint256 totalFunding;
        uint256 epoch;
    }

    uint256 public lastPaidEpoch;
    mapping(uint256 => FundingData) public epochsFunded;

    event FundingPaid(
        address paymentToken,
        uint256 indexed fundingRound,
        address[] indexed dests,
        uint256[] indexed amounts
    );
    event FundingDeployed(
        address paymentToken,
        uint256 indexed fundingRound,
        address[] indexed dests,
        uint256[] indexed amounts,
        address deployedTo
    );

    constructor(uint256 _lastPaidEpoch) {
        lastPaidEpoch = _lastPaidEpoch;
    }

    /**
     * @dev Deploys a new TempleTeamPayments contract, setAllocations to _dests and _allocations, funded with _totalFunding as _temple tokens, available to claim at _startTimestamp
     * @param _temple the token to distribute
     * @param _dests the recipient of the tokens
     * @param _allocations the recipients respective amounts
     * @param _totalFunding the total funding to supply the contract with initially
     * @param _startTimestamp the time when recipients can make a claim
     */
    function deployPayouts(
        IERC20 _temple,
        address[] calldata _dests,
        uint256[] calldata _allocations,
        uint256 _totalFunding,
        uint256 _startTimestamp
    ) external onlyOwner returns (TempleTeamPaymentsV2) {
        require(
            _dests.length == _allocations.length,
            "TempleTeamPaymentsFactory: mismatch length dests + allos"
        );

        TempleTeamPaymentsV2 paymentContract = new TempleTeamPaymentsV2(
            _temple,
            _startTimestamp
        );
        paymentContract.setAllocations(_dests, _allocations);
        paymentContract.transferOwnership(msg.sender);
        _temple.transferFrom(
            msg.sender,
            address(paymentContract),
            _totalFunding
        );

        lastPaidEpoch++;
        epochsFunded[lastPaidEpoch] = FundingData({
            paymentContract: address(paymentContract),
            totalFunding: _totalFunding,
            epoch: lastPaidEpoch
        });

        emit FundingDeployed(
            address(_temple),
            lastPaidEpoch,
            _dests,
            _allocations,
            address(paymentContract)
        );

        return paymentContract;
    }

    /**
     * @dev Directly transfers _temple tokens to _dests and _allocations
     * @param _temple the token to distribute
     * @param _dests the recipient of the tokens
     * @param _allocations the recipients respective amounts
     */
    function directPayouts(
        IERC20 _temple,
        address[] calldata _dests,
        uint256[] calldata _allocations
    ) external onlyOwner {
        require(
            _dests.length == _allocations.length,
            "TempleTeamPaymentsFactory: mismatch length dest + allos"
        );

        uint256 totalFunding;
        for (uint256 i; i < _dests.length; i++) {
            uint256 value = _allocations[i];
            _temple.transferFrom(msg.sender, _dests[i], value);
            totalFunding += value;
        }

        lastPaidEpoch++;
        epochsFunded[lastPaidEpoch] = FundingData({
            paymentContract: address(this),
            totalFunding: totalFunding,
            epoch: lastPaidEpoch
        });

        emit FundingPaid(address(_temple), lastPaidEpoch, _dests, _allocations);
    }

    function withdrawToken(IERC20 _token, uint256 _amount) external onlyOwner {
        require(
            _amount > 0,
            "TempleTeamPaymentsFactory: Amount must be greater than 0"
        );
        SafeERC20.safeTransfer(_token, msg.sender, _amount);
    }
}
