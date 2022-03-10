pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./RebasingERC20.sol";
import "./Strategy.sol";

// import "hardhat/console.sol";

/**
 * @title A temple investment vault, allows deposits and withdrawals on a set period (eg. monthly)
 *
 * @notice Each vault is a rebasing ERC20, users ca
 *
 * If a vault is in a cycle period, the any revenue is re-invested
 */
contract Vault is EIP712, Ownable, RebasingERC20 {
    using Counters for Counters.Counter;
    mapping(address => Counters.Counter) public _nonces;

    // solhint-disable-next-line var-name-mixedcase
    bytes32 public immutable DEPOSIT_FOR_TYPEHASH = keccak256("depositFor(address owner, uint256 maxAmount, uint256 deadline, uint256 nonce)");

    // solhint-disable-next-line var-name-mixedcase
    bytes32 public immutable WITHDRAW_FOR_TYPEHASH = keccak256("withdrawFor(address owner, uint256 amount, uint256 deadline, uint256 nonce)");

    /// @dev total temple deposited into vault, this isn't the total 
    /// temple in the vault (as that is deposits + revenue). A users
    /// share of a vault is a function of the total temple in the vault
    /// (that is, their balanceOf(account) / totalSupply * totalTemple)
    uint256 public totalDepositsTemple;

    IERC20 public templeToken;

    /// @dev share of main revenue strategy owned by this vault, should be 1 to 1 with the
    /// vault's total temple
    Strategy public treasuryInvestmentRevenueStrategy;

    /// @dev share of revenue from any re-investment strategy. At time 0 revenueSharetrategy
    /// and revenueReinvestmentStrategy should be in the same proportions, and this will
    /// diverge over time.
    Strategy public revenueReinvestmentStrategy;

    /// @dev timestamp (in seconds) of the first period in this vault
    uint256 public firstPeriodStartTimestamp;

    /// @dev how often a vault cycles, in seconds
    uint256 public periodDuration;

    /// @dev window from cycle start in which accounts can enter/exit the vault
    uint256 public enterExitWindowDuration;


    constructor(
        string memory _name,
        string memory _symbol,
        IERC20 _templeToken,
        Strategy _treasuryInvestmentRevenueStrategy,
        Strategy _revenueReinvestmentStrategy,
        uint256 _periodDuration,
        uint256 _enterExitWindowDuration
    ) EIP712(_name, "1") ERC20(_name, _symbol)  {
        templeToken = _templeToken;
        treasuryInvestmentRevenueStrategy = _treasuryInvestmentRevenueStrategy;
        revenueReinvestmentStrategy = _revenueReinvestmentStrategy;
        periodDuration = _periodDuration;
        enterExitWindowDuration = _enterExitWindowDuration;

        firstPeriodStartTimestamp = block.timestamp;
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
     * @dev public and permisionless, however for correctness within reasonably
     * time bounds this only needs to be called during a vault deposit/withdrawal
     */
    function syncStrategyShares() public {
        uint256 totalTemple = templeToken.balanceOf(address(this));
        uint totalRevenueShares = treasuryInvestmentRevenueStrategy.balanceOf(address(this));

        if (totalTemple > totalRevenueShares) { // mint extra revenue/reinvestment shares
            treasuryInvestmentRevenueStrategy.mint(totalTemple - totalRevenueShares);
            revenueReinvestmentStrategy.mint(totalTemple - totalRevenueShares);
        } else if (totalTemple < totalRevenueShares) { // burn shares to account for withdrawal
            treasuryInvestmentRevenueStrategy.burn(totalRevenueShares - totalTemple);
            revenueReinvestmentStrategy.burn(totalRevenueShares - totalTemple);
            // TODO(butlerji): Is the above correct for balancing out the reinvestment strategy?
            // I think so (it needs extra eyes)
        }
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

    function amountPerShare() public view override returns (uint256 p, uint256 q) {
        p = templeToken.balanceOf(address(this));
        q = totalDepositsTemple;
    }

    function inEnterExitWindow() public returns (bool) {
        // TODO(butlerji): Implement - there is a lot of chat on how to best do
        // this so left as a stub for now
        return true;
    }

    /**
     * @dev shared private implementation of depositFor. Must be private, to prevent
     * security issue where anyone can deposit (and lock) for another account, once
     * said account as approved this contract to pull temple funds.
     */
    function depositFor(address _account, uint256 _amount) private {
        require(inEnterExitWindow(), "Vault: Cannot join vault when outside of enter/exit window");

        totalDepositsTemple += _amount;

        if (_amount > 0) {
            SafeERC20.safeTransferFrom(templeToken, _account, address(this), _amount);
            syncStrategyShares();
            _mint(_account, _amount);
        }

        emit Deposit(_account, _amount);
    }

    /**
     * @dev shared private implementation of withdrawFor. Must be private, to prevent
     * security issue where anyone can withdraw for another account. Isn't as severe as
     * depositFor (as there are no locks), however still a nucance if an account is
     * exited from a vault without consent.
     */
    function withdrawFor(address _account, uint256 _amount) private {
        require(inEnterExitWindow(), "Vault: Cannot exit vault when outside of enter/exit window");

        // TODO(bulterji): I think this math is wrong. Review
        totalDepositsTemple -= toSharesAmount(_amount);
        SafeERC20.safeTransferFrom(templeToken, address(this), msg.sender, _amount);

        if (_amount > 0) {
            syncStrategyShares();
            _burnFrom(_account, _amount);
        }

        emit Withdraw(_account, _amount);
    }

    /**
     * @dev Destroys `amount` tokens from `account`, deducting from the caller's
     * allowance.
     *
     * See {ERC20-_burn} and {ERC20-allowance}.
     *
     * Requirements:
     *
     * - the caller must have allowance for ``accounts``'s tokens of at least
     * `amount`.
     */
    function _burnFrom(address account, uint256 amount) private {
        uint256 currentAllowance = allowance(account, _msgSender());
        require(currentAllowance >= amount, "ERC20: burn amount exceeds allowance");
        unchecked {
            _approve(account, _msgSender(), currentAllowance - amount);
        }
        _burn(account, amount);
    }

    event Deposit(address account, uint256 amount);
    event Withdraw(address account, uint256 amount);
}
