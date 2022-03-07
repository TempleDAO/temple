pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./VaultRevenueShare.sol";

// import "hardhat/console.sol";

/**
 * Bookkeeping for a vault
 */
contract Vault is EIP712, Ownable {
    using Counters for Counters.Counter;
    mapping(address => Counters.Counter) public _nonces;

    // solhint-disable-next-line var-name-mixedcase
    bytes32 public immutable LOCK_FOR_TYPEHASH = keccak256("lockFor(address owner, uint256 maxAmount, uint256 deadline, uint256 nonce)");

    // A number of the form p/q where q != 0
    struct Rational {
        uint256 p;
        uint256 q;
    }

    // All temple locked for any given user
    mapping(address => uint256) public wenTemple;
    uint256 public totalWenTemple;

    IERC20 public templeToken;
    VaultRevenueShare public vaultRevenueShare;
    uint256 public lockEndTimestamp;
    uint256 public joinEndTimestamp;
    Rational public shareMultiplier;

    event Join(address account, uint256 increasedByTemple, uint256 totalLockedTemple, uint256 lockedUntil, uint256 sharesEarned);
    event Leave(address account, uint256 amount);
    event Claim(address account, uint256 depositedTemple, uint256 claimedTemple);

    constructor(
        IERC20 _templeToken,
        RevenueShare _vaultRevenueShare,
        uint256 lockDurationSeconds,
        uint256 joinDurationSeconds,
        Rational shareMultiplier

    ) EIP712("Vault", "1") {
        templeToken = _templeToken;
        revenueShare = _vaultRevenueShare;
        lockEndTimestamp = block.timestamp + lockDurationSeconds;
        joinEndTimestamp = block.timestamp + joinDurationSeconds;
    }

    /**
    * _amount: $TEMPLE to lock
    */
    function join(uint256 amount) public {
        joinFor(msg.sender, amount);
    }

    /**
     * Lock for another user
     * (assuming the owner has given authority to the caller to act on their behalf)
     * 
     * Gasless for the owner
     *
     * NOTE: amount is explicitly _not_ part of the digest, as in the common use case
     * the owner often doesn't know exactly how much will be locked (example, AMM buy with
     * immediate lock). We do capture the max however to mitigate any possibly attack vectors
     */
    function joinFor(address owner, uint256 amount, uint256 maxAmount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) public {
        require(block.timestamp <= deadline, "Vault: expired deadline");
        require(amount <= maxAmount, "Vault: amount must be less than authorized maxAmount");

        bytes32 structHash = keccak256(abi.encode(LOCK_FOR_TYPEHASH, owner, maxAmount, unlockDelaySeconds, deadline, _useNonce(owner)));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, v, r, s);

        require(signer == owner, "Vault: invalid signature");

        lockFor(owner, amount, unlockDelaySeconds);
    }

    /**
     * Must be private, otherwise security issue where anyone can
     * refresh lock for another wallet (and lock more if they have an allowance)
     */
    function joinFor(address _account, uint256 _amount, uint256 _unlockDelaySeconds) private {
        require(block.timestamp <= joinEndTimestamp, "Vault: Cannot no longer join vault");

        uint256 lockDuration = newLockedUntilTimestamp - block.timestamp;

        wenTemple[_account] += _amount;
        totalWenTemple += _amount;

        if (_amount > 0) {
            SafeERC20.safeTransferFrom(templeToken, _account, address(this), _amount);
            revenueShare.increase(address(this), amount * shareMultiplier.p / shareMultiplier.q);
        }

        emit Lock(_account, _amount, lockEntry.amount, lockEntry.lockedUntilTimestamp);
    }

    /** Withdraw locked entry */
    function leave(uint256 _amount) public {
        require(block.timestamp <= joinEndTimestamp, "Vault: Can no longer leave vault until the end timestamp");
        require(wenTemple[msg.sender] <= lockEntry.amount, "Vault: can't unlock more than originally locked");

        revenueShare.decrease(address(this), _amount * shareMultiplier.p / shareMultiplier.q);
        exitFor(msg.sender, _amount, _amount);
        emit Unlock(msg.sender, _amount);
    }

    /**
     * Once the vault expires, claim
     */
    function claimFor(address _account, uint256 _amount) public {
        require(block.timestamp <= lockEndTimestamp, "Vault: temple still locked");
        require(revenueShare.balanceOf(address(this)) == 0, "Vault: vault is not in claim mode (cannot claim while vault still has a revenue share)");

        uint256 depositedTemple = wenTemple[_account];
        require(depositedTemple > 0, "Vault: no temple in vault");

        uint256 claimedTemple = templeToken.balanceOf(address(this)) * depositedTemple / totalWenTemple;
        exitFor(_account, depositedTemple, claimedTemple);
        emit Claim(_account, depositedTemple, claimedTemple);
    }

    /**
     * Bookkeeping to remove a specified balance + claim from this vault
     */
    function exitFor(address _account, uint256 _depositedAmount, uint256 _claimAmount) private {
        totalWenTemple -= _depositedTemple;
        wenTemple[_account] -= _depositedTemple;

        if (_claimAmount > 0) {
            SafeERC20.safeTransfer(templeToken, _account, _amount);
        }
    }

    // NOTE(bulterji): I don't think this belongs on each vault
    function enableClaimMode() onlyOwner {
        require(block.timestamp > joinEnd, "Vault: can only enable claim mode once the vault unlocks");
        revenueShare.decrease(revenue.balanceOf(address(this)));
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
