pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./OGTemple.sol";

/**
 * Bookkeeping for OGTemple that's locked
 */
contract LockedOGTemple {
    struct LockedEntry {
        // How many tokens are locked
        uint256 amount;

        // WHen can the user unlock these tokens
        uint256 lockedUntilTimestamp;
    }

    // All temple locked for any given user
    mapping(address => LockedEntry) public ogTempleLocked;

    OGTemple public ogTempleToken;

    event Lock(address staker, uint256 increasedByOgTemple, uint256 totalLockedOgTemple, uint256 lockedUntil);
    event Unlock(address staker, uint256 amount);

    constructor(OGTemple _ogTempleToken) {
        ogTempleToken = _ogTempleToken;
    }

    /** lock up OG */
    function lockFor(address _staker, uint256 _amountOGTemple, uint256 _unlockDelaySeconds) public {
        LockedEntry storage lockEntry = ogTempleLocked[_staker];
        
        lockEntry.amount += _amountOGTemple;
        lockEntry.lockedUntilTimestamp = block.timestamp + _unlockDelaySeconds;

        SafeERC20.safeTransferFrom(ogTempleToken, msg.sender, address(this), _amountOGTemple);
        emit Lock(_staker, _amountOGTemple, lockEntry.amount, lockEntry.lockedUntilTimestamp);
    }

    function lock(uint256 _amountOGTemple, uint256 _lockedUntilTimestamp) external {
        lockFor(msg.sender, _amountOGTemple, _lockedUntilTimestamp);
    }

    /** Withdraw a specific locked entry */
    function unlockFor(address _staker, uint256 _amountOGTemple) public {
        LockedEntry storage lockEntry = ogTempleLocked[_staker];
        require(lockEntry.lockedUntilTimestamp < block.timestamp, "LockedOGTemple: Too soon!");
        require(_amountOGTemple <= lockEntry.amount, "LockedOGTemple: can't withdraw more than originally locked");

        SafeERC20.safeTransfer(ogTempleToken, _staker, _amountOGTemple);
        emit Unlock(_staker, _amountOGTemple);
    }

    function unlock(uint256 _amountOGTemple) external {
        unlockFor(msg.sender, _amountOGTemple);
    }
}