pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

import "./IFaith.sol";

/**
 * Bookkeeping and faith rewards Temple that's locked
 */
contract LockedTemple is EIP712 {
    using Counters for Counters.Counter;
    mapping(address => Counters.Counter) public _nonces;

    // solhint-disable-next-line var-name-mixedcase
    bytes32 public immutable LOCK_FOR_TYPEHASH = keccak256("lockFor(address owner, uint256 maxAmount, uint256 unlockDelaySeconds, uint256 deadline, uint256 nonce)");

    // solhint-disable-next-line var-name-mixedcase
    uint256 public immutable SECONDS_IN_MONTH = 2629800;

    struct LockedEntry {
        // How many tokens are locked
        uint256 amount;

        // WHen can the user unlock these tokens
        uint256 lockedUntilTimestamp;
    }

    // All temple locked for any given user
    mapping(address => LockedEntry) public wemTemple;

    IERC20 public templeToken;
    IFaith public faith;

    event Lock(address staker, uint256 increasedByTemple, uint256 totalLockedTemple, uint256 lockedUntil, uint256 faithEarned);
    event Unlock(address staker, uint256 amount);

    constructor(IERC20 _templeToken, IFaith _faith) EIP712("LockedTemple", "1") {
        templeToken = _templeToken;
        faith = _faith;
    }

    /**
    * _amount: $TEMPLE to lock
    * _unlockDelaySeconds: Delay to add to block.timestamp will pick max btw block.timestamp + _unlockDelaySeconds > lockEntry.lockedUntilTimestamp
    */
    function lock(uint256 amount, uint256 unlockDelaySeconds) public {
        lockFor(msg.sender, amount, unlockDelaySeconds);
    }

    /**
     * Lock for another user
     * (assuming the owner has given authority to the caller to act on their behalf)
     * 
     * Gasless for the owner
     *
     * NOTE: amount is explicitly _not_ part of the digest, as in the common use case
     * the owner often doesn't know how much extra will be locked (might be via an AMM purchase)
     * or similar).
     */
    function lockFor(address owner, uint256 amount, uint256 maxAmount, uint256 unlockDelaySeconds, uint256 deadline, uint8 v, bytes32 r, bytes32 s) public {
        require(block.timestamp <= deadline, "LockedTemple: expired deadline");
        require(amount <= maxAmount, "LockedTemple: amount must be less than authorized maxAmount");

        bytes32 structHash = keccak256(abi.encode(LOCK_FOR_TYPEHASH, owner, maxAmount, unlockDelaySeconds, deadline, _useNonce(owner)));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, v, r, s);

        require(signer == owner, "LockedTemple: invalid signature");

        lockFor(owner, amount, unlockDelaySeconds);
    }

    /** Withdraw locked entry */
    function unlock(uint256 _amount) public {
        LockedEntry storage lockEntry = wemTemple[msg.sender];
        require(lockEntry.lockedUntilTimestamp < block.timestamp, "LockedTemple: Still Locked");
        require(_amount <= lockEntry.amount, "LockedTemple: can't unlock more than originally locked");

        lockEntry.amount -= _amount;
        SafeERC20.safeTransfer(templeToken, msg.sender, _amount);
        emit Unlock(msg.sender, _amount);
    }

    /**
     * Must be private, otherwise security issue where anyone can
     * refresh lock for another wallet (and lock more if they have
     * an allowance)
     */
    function lockFor(address _owner, uint256 _amount, uint256 _unlockDelaySeconds) private {
        LockedEntry storage lockEntry = wemTemple[_owner];

        uint256 newLockedUntilTimestamp = block.timestamp + _unlockDelaySeconds;
        require(newLockedUntilTimestamp > lockEntry.lockedUntilTimestamp, "LockedTemple: New unlock time must be greater than current unlock time");

        uint256 faithEarned = 0;
        uint256 lockIncreaseDuration = newLockedUntilTimestamp - lockEntry.lockedUntilTimestamp;
        uint256 lockDuration = newLockedUntilTimestamp - block.timestamp;

        // first, calculate faith for any increase in lock time        
        if (lockEntry.amount > 0) {
            faithEarned += lockEntry.amount * lockIncreaseDuration *  lockDuration / SECONDS_IN_MONTH / SECONDS_IN_MONTH;
        }

        // then, calculate faith for new temple transferred in
        if (_amount > 0) {
            faithEarned += _amount * lockIncreaseDuration *  lockDuration / SECONDS_IN_MONTH / SECONDS_IN_MONTH;
        }

        lockEntry.amount += _amount;
        lockEntry.lockedUntilTimestamp = newLockedUntilTimestamp;

        if (_amount > 0) {
            SafeERC20.safeTransferFrom(templeToken, _owner, address(this), _amount);
        }

        if (faithEarned > 0) {
            faith.gain(_owner, uint112(faithEarned));
        }

        emit Lock(_owner, _amount, lockEntry.amount, lockEntry.lockedUntilTimestamp, faithEarned);
    }

    /**
    * See {IERC20Permit-DOMAIN_SEPARATOR}.
    */
    // solhint-disable-next-line func-name-mixedcase
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /**
    * Current nonce for an given address
    */
    function nonces(address owner) public view returns (uint256) {
        return _nonces[owner].current();
    }

    /**
    * "Consume a nonce": return the current value and increment.
    */
    function _useNonce(address owner) internal returns (uint256 current) {
        Counters.Counter storage nonce = _nonces[owner];
        current = nonce.current();
        nonce.increment();
    }
}
