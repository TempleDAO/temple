//SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract TempleTeamPaymentsV2 is Initializable, OwnableUpgradeable {
    error AllocationsLengthMismatch();
    error AllocationAddressZero();
    error ClaimMemberPaused();
    error ClaimZeroValue();

    IERC20 public temple;
    mapping(address => uint256) public allocation;
    mapping(address => uint256) public claimed;
    mapping(address => bool) public paused;

    event Claimed(address indexed member, uint256 amount);
    event TokenRecovered(address indexed token, uint256 amount);
    event MemberToggled(address indexed member, bool status);
    event AllocationSet(address indexed member, uint256 allocation);

    function initialize(IERC20 _temple) public initializer {
        __Ownable_init_unchained(msg.sender);
        temple = _temple;
    }

    function _setAllocation(address _address, uint256 _amount) internal {
        if (_address == address(0)) revert AllocationAddressZero();
        allocation[_address] = _amount;
        emit AllocationSet(_address, _amount);
    }

    function setAllocation(
        address _address,
        uint256 _amount
    ) external onlyOwner {
        _setAllocation(_address, _amount);
    }

    function setAllocations(
        address[] memory _addresses,
        uint256[] memory _amounts
    ) external onlyOwner {
        if (_addresses.length != _amounts.length)
            revert AllocationsLengthMismatch();

        for (uint256 i; i < _addresses.length; ) {
            _setAllocation(_addresses[i], _amounts[i]);

            unchecked {
                i++;
            }
        }
    }

    function withdrawToken(IERC20 _token, uint256 _amount) external onlyOwner {
        if (_amount == 0) revert ClaimZeroValue();
        SafeERC20.safeTransfer(_token, msg.sender, _amount);
        emit TokenRecovered(address(_token), _amount);
    }

    function toggleMember(address _address) external onlyOwner {
        paused[_address] = !paused[_address];
        emit MemberToggled(_address, paused[_address]);
    }

    function calculateClaimable(address _member) public view returns (uint256) {
        return allocation[_member] - claimed[_member];
    }

    function claim(uint256 _claimAmount) external {
        if (paused[msg.sender]) revert ClaimMemberPaused();

        uint256 claimable = calculateClaimable(msg.sender);
        if (claimable == 0) revert ClaimZeroValue();

        if (_claimAmount > claimable) _claimAmount = claimable;

        claimed[msg.sender] += _claimAmount;
        SafeERC20.safeTransfer(temple, msg.sender, _claimAmount);
        emit Claimed(msg.sender, _claimAmount);
    }
}
