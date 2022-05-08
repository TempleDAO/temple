pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./RebasingERC20.sol";
import "./Rational.sol";
import "./Exposure.sol";
import "./JoiningFee.sol";

import "hardhat/console.sol";

/**
 * @title A temple investment vault, allows deposits and withdrawals on a set period (eg. monthly)
 *
 * @notice Each vault is a rebasing ERC2O (token representing an accounts vault share), Vaults have a
 * cycle period, and a join/exit period. During the join/exit period, a vault account can withdraw their
 * share of temple from the vault, or deposit more temple in.
 *
 * Depending on when an account joins a vault, there is a linearly increasing joining fee shared by all
 * other vault accounts.
 *
 * If an account doesn't leave during the join/exit period, their holdings are automaticaly re-invested
 * into the next vault cycle.
 */
contract Vault is EIP712, Ownable, RebasingERC20 {
    uint256 constant public ENTER_EXIT_WINDOW_BUFFER = 60 * 5; // 5 minute buffer

    using Counters for Counters.Counter;
    mapping(address => Counters.Counter) public _nonces;

    // solhint-disable-next-line var-name-mixedcase
    bytes32 public immutable DEPOSIT_FOR_TYPEHASH = keccak256("depositFor(address owner, uint256 maxAmount, uint256 deadline, uint256 nonce)");

    // solhint-disable-next-line var-name-mixedcase
    bytes32 public immutable WITHDRAW_FOR_TYPEHASH = keccak256("withdrawFor(address owner, uint256 amount, uint256 deadline, uint256 nonce)");

    IERC20 public templeToken;

    /// @dev timestamp (in seconds) of the first period in this vault
    uint256 public firstPeriodStartTimestamp;

    /// @dev how often a vault cycles, in seconds
    uint256 public periodDuration;

    /// @dev window from cycle start in which accounts can enter/exit the vault
    uint256 public enterExitWindowDuration;

    /// @dev how many shares in the various strategies does this vault get based on temple deposited
    Rational public shareBoostFactor;

    /// @dev Where to query the fee (per hour) when joining the vault
    JoiningFee public joiningFee;

    constructor(
        string memory _name,
        string memory _symbol,
        IERC20 _templeToken,
        uint256 _periodDuration,
        uint256 _enterExitWindowDuration,
        Rational memory _shareBoostFactory,
        JoiningFee _joiningFee,
        uint256 _firstPeriodStartTimestamp
    ) EIP712(_name, "1") ERC20(_name, _symbol)  {
        templeToken = _templeToken;
        periodDuration = _periodDuration;
        enterExitWindowDuration = _enterExitWindowDuration;
        shareBoostFactor = _shareBoostFactory;
        joiningFee = _joiningFee;

        firstPeriodStartTimestamp = _firstPeriodStartTimestamp;
    }

    /**
     * @notice Deposit temple into a vault
     */
    function deposit(uint256 amount) public {
        depositFor(msg.sender, amount);
    }

    /**
     * @notice Deposit for another user (gassless for the temple owner)
     * (assuming the owner has given authority to the caller to act on their behalf)
     *
     * @dev amount is explicitly _not_ part of the digest, as in the common use case
     * the owner often doesn't know exactly how much will be locked (example, AMM buy with
     * immediate lock). We do capture the max however to mitigate any possibly attack vectors
     */
    function depositFor(address owner, uint256 amount, uint256 maxAmount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) public {
        require(block.timestamp <= deadline, "Vault: expired deadline");
        require(amount <= maxAmount, "Vault: amount must be less than authorized maxAmount");

        bytes32 structHash = keccak256(abi.encode(DEPOSIT_FOR_TYPEHASH, owner, maxAmount, deadline, _useNonce(owner)));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, v, r, s);

        require(signer == owner, "Vault: invalid signature");

        depositFor(owner, amount);
    }

    /**
     * @notice Withdraw temple (and any earned revenue) from the vault
     */
    function withdraw(uint256 amount) public {
        withdrawFor(msg.sender, amount);
    }

    /**
     * @notice Withdraw for another user (gasless for the vault token holder)
     * (assuming the owner has given authority for the caller to act on their behalf)
     *
     * @dev amount is explicit, to allow use case of partial vault withdrawals
     */
    function withdrawFor(address owner, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) public {
        require(block.timestamp <= deadline, "Vault: expired deadline");

        bytes32 structHash = keccak256(abi.encode(WITHDRAW_FOR_TYPEHASH, owner, amount, deadline, _useNonce(owner)));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, v, r, s);

        require(signer == owner, "Vault: invalid signature");

        withdrawFor(owner, amount);
    }

    function targetRevenueShare() external view returns (uint256) {
        return templeToken.balanceOf(address(this)) * shareBoostFactor.p / shareBoostFactor.q;
    }

    /// @dev redeem a specific vault's exposure back into temple
    function redeemExposures(Exposure[] memory exposures) external {
        require(inEnterExitWindow(), "Vault: Cannot redeem when outside of enter/exit window");

        for (uint256 i = 0; i < exposures.length; i++) {
            exposures[i].redeem();
        }

        // no need for event, as exposures[i].redeem() triggers one
    }

    function amountPerShare() public view override returns (uint256 p, uint256 q) {
        p = templeToken.balanceOf(address(this));
        q = totalShares;

        // NOTE(butlerji): Assuming this is fairly cheap in gas, as it gets called
        // often
        if (p == 0) {
            p = 1;
        }

        if (q == 0) {
            q = p;
        }
    }

    function inEnterExitWindow() public view returns (bool) {
        if (block.timestamp < firstPeriodStartTimestamp) {
            return false;
        }

        uint256 numCycles = (block.timestamp - firstPeriodStartTimestamp) / periodDuration;
        return numCycles * periodDuration + firstPeriodStartTimestamp + enterExitWindowDuration + ENTER_EXIT_WINDOW_BUFFER > block.timestamp;
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

    /**
     * @dev shared private implementation of depositFor. Must be private, to prevent
     * security issue where anyone can deposit (and lock) for another account, once
     * said account as approved this contract to pull temple funds.
     */
    function depositFor(address _account, uint256 _amount) private {
        require(inEnterExitWindow(), "Vault: Cannot join vault when outside of enter/exit window");

        uint256 feePerTempleScaledPerHour = joiningFee.calc(firstPeriodStartTimestamp, periodDuration, address(this));
        uint256 fee = _amount * feePerTempleScaledPerHour / 1e18;
        uint256 amountStaked = _amount - fee;

        if (_amount > 0) {
            _mint(_account, amountStaked);
            SafeERC20.safeTransferFrom(templeToken, _account, address(this), _amount);
        }

        emit Deposit(_account, _amount, amountStaked);
    }

    /**
     * @dev shared private implementation of withdrawFor. Must be private, to prevent
     * security issue where anyone can withdraw for another account. Isn't as severe as
     * depositFor (as there are no locks), however still a nucance if an account is
     * exited from a vault without consent.
     */
    function withdrawFor(address _account, uint256 _amount) private {
        require(inEnterExitWindow(), "Vault: Cannot exit vault when outside of enter/exit window");

        if (_amount > 0) {
             _burn(_account, _amount);
        }
        SafeERC20.safeTransfer(templeToken, msg.sender, _amount);

        emit Withdraw(_account, _amount);
    }


    /// @dev ****** for testing. Delete before pushing to mainnet
    /// change a vault's start time (so we can fast forward in and out of lock/unlock windows)
    function decreaseStartTime(uint256 delta) external onlyOwner {
        firstPeriodStartTimestamp -= delta;
    }

    event Deposit(address account, uint256 amount, uint256 amountStaked);
    event Withdraw(address account, uint256 amount);
}
