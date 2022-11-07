//SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

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
        require(
            _addresses.length == _amounts.length,
            "TempleTeamPayments: addresses and amounts must be the same length"
        );
        address addressZero = address(0);
        for (uint256 i = 0; i < _addresses.length; i++) {
            require(
                _addresses[i] != addressZero,
                "TempleTeamPayments: Address cannot be 0x0"
            );
            allocation[_addresses[i]] = _amounts[i];
        }
    }

    function setAllocation(
        address _address,
        uint256 _amount
    ) external onlyOwner {
        require(
            _address != address(0),
            "TempleTeamPayments: Address cannot be 0x0"
        );
        allocation[_address] = _amount;
    }

    function toggleMember(address _address) external onlyOwner {
        paused[_address] = !paused[_address];
    }

    function withdrawToken(IERC20 _token, uint256 _amount) external onlyOwner {
        require(
            _amount > 0,
            "TempleTeamPayments: Amount must be greater than 0"
        );
        SafeERC20.safeTransfer(_token, msg.sender, _amount);
    }

    function calculateClaimable(address _member) public view returns (uint256) {
        return allocation[_member] - claimed[_member];
    }

    function claim() external {
        uint256 claimable = calculateClaimable(msg.sender);
        require(
            roundStartDate < block.timestamp,
            "TempleTeamPayments: before round start"
        );
        require(!paused[msg.sender], "TempleTeamPayments: Member paused");
        require(
            claimable > 0,
            "TempleTeamPayments: Member has no TEMPLE to claim"
        );

        claimed[msg.sender] += claimable;
        SafeERC20.safeTransfer(temple, msg.sender, claimable);
        emit Claimed(msg.sender, claimable);
    }
}
