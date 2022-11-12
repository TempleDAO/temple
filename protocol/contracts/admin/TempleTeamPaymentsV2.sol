//SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.4;


import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

error AllocationsLengthMismatch();
error AllocationAddressZero();
error ClaimMemberPaused();
error ClaimZeroValue();
error ClaimTooEarly();

contract TempleTeamPaymentsV2 is Ownable {
    IERC20 public immutable temple;
    uint256 public immutable roundStartDate;

    mapping(address => uint256) public allocation;
    mapping(address => uint256) public claimed;
    mapping(address => bool) public paused;

    event Claimed(address indexed member, uint256 amount);

    constructor(IERC20 _temple, uint256 _roundStartDate) {
        temple = _temple;
        roundStartDate = _roundStartDate;
    }

    function setAllocations(
        address[] memory _addresses,
        uint256[] memory _amounts
    ) external onlyOwner {
        if (_addresses.length != _amounts.length)
            revert AllocationsLengthMismatch();

        for (uint256 i = 0; i < _addresses.length; i++) {
            if (_addresses[i] == address(0)) revert AllocationAddressZero();
            allocation[_addresses[i]] = _amounts[i];
        }
    }

    function setAllocation(
        address _address,
        uint256 _amount
    ) external onlyOwner {
        if (_address == address(0)) revert AllocationAddressZero();
        allocation[_address] = _amount;
    }

    function toggleMember(address _address) external onlyOwner {
        paused[_address] = !paused[_address];
    }

    function withdrawToken(IERC20 _token, uint256 _amount) external onlyOwner {
        if (_amount == 0) revert ClaimZeroValue();
        SafeERC20.safeTransfer(_token, msg.sender, _amount);
    }

    function calculateClaimable(address _member) public view returns (uint256) {
        return allocation[_member] - claimed[_member];
    }

    function claim() external {
        uint256 claimable = calculateClaimable(msg.sender);
        if (roundStartDate > block.timestamp) revert ClaimTooEarly();
        if (paused[msg.sender]) revert ClaimMemberPaused();
        if (claimable < 0) revert ClaimZeroValue();

        claimed[msg.sender] += claimable;
        SafeERC20.safeTransfer(temple, msg.sender, claimable);
        emit Claimed(msg.sender, claimable);
    }
}
