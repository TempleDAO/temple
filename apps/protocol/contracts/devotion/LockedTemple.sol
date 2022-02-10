pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * Bookkeeping and faith rewards Temple that's locked
 */
contract LockedTemple {
    struct LockedEntry {
        // How many tokens are locked
        uint256 amount;

        // WHen can the user unlock these tokens
        uint256 lockedUntilTimestamp;
    }

    // All temple locked for any given user
    mapping(address => LockedEntry) public wemTemple;

    IERC20 public templeToken;

    event Lock(address staker, uint256 increasedByTemple, uint256 totalLockedTemple, uint256 lockedUntil);
    event Unlock(address staker, uint256 amount);

    constructor(IERC20 _templeToken) {
        templeToken = _templeToken;
    }

    /**
    * _amount: $TEMPLE to lock
    * _unlockDelaySeconds: Delay to add to block.timestamp will pick max btw block.timestamp + _unlockDelaySeconds > lockEntry.lockedUntilTimestamp
    */
    function lock(uint256 _amount, uint256 _unlockDelaySeconds) public {
        LockedEntry storage lockEntry = wemTemple[msg.sender];

        lockEntry.amount += _amount;
        uint256 newLockedUntilTimestamp = block.timestamp + _unlockDelaySeconds;
        if (newLockedUntilTimestamp > lockEntry.lockedUntilTimestamp) {
            lockEntry.lockedUntilTimestamp = newLockedUntilTimestamp;
        }

        // TODO(butler): Allocate faith

        SafeERC20.safeTransferFrom(templeToken, msg.sender, address(this), _amount);
        emit Lock(msg.sender, _amount, lockEntry.amount, lockEntry.lockedUntilTimestamp);
    }

    /** Withdraw a specific locked entry */
    function unlockFor(address _staker, uint256 _amount) public {
        LockedEntry storage lockEntry = wemTemple[_staker];
        require(lockEntry.lockedUntilTimestamp < block.timestamp, "LockedTemple: Still Locked");
        require(_amount <= lockEntry.amount, "LockedTemple: can't unlock more than originally locked");

        lockEntry.amount -= _amount;
        SafeERC20.safeTransfer(templeToken, _staker, _amount);
        emit Unlock(_staker, _amount);
    }

    function unlock(uint256 _amount) external {
        unlockFor(msg.sender, _amount);
    }
}
