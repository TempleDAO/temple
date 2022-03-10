pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later

import "@openzeppelin/contracts/access/Ownable.sol";

import "./RebasingERC20.sol";
import "./Rational.sol";

/**
 * @title Captures the distribution of shares of a given strategy
 *
 * @notice When a strategy generates revenue, it's rebases (thereby)
 * increasing the total supply of strategy tokens, without changing
 * the relative proportions of any given share holder.
 *
 * This allows individual account holders to decide if they'd like
 * to re-invest and compound their earnings from a strategy (the default
 * if you take no action) or liquidate some portion of your share
 */
contract Strategy is Ownable, RebasingERC20 {
    Rational private _amountPerShare;

    /// @dev Strategies are tightly coupled with vaults. Vaults
    /// can increase (ie mint) and decrease (ie burn) their own
    /// shares depending on their temple holdings
    mapping(address => bool) public isVault;

    /**
     * @dev Sets the values for {name} and {symbol}.
     *
     * The default value of {decimals} is 18. To select a different value for
     * {decimals} you should overload it.
     *
     * All two of these values are immutable: they can only be set once during
     * construction.
     */
    constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) { 
        _amountPerShare.p = 1;
        _amountPerShare.q = 1;
    }

    /**
     * @notice Generate new strategy shares
     * 
     * @dev Only callable by a vault, and only to increase a vault's
     * own share
     */
    function mint(uint256 amount) external onlyVault {
        _mint(msg.sender, amount);
    }

    function addVault(address account) external onlyOwner {
        isVault[account] = true;
    }

    function removeVault(address account) external onlyOwner {
        isVault[account] = false;
    }

    function amountPerShare() public view override returns (uint256 p, uint256 q) {
        p = _amountPerShare.p;
        q = _amountPerShare.q;
    }

    function setAmountPerShare(uint256 p, uint256 q) external onlyOwner {
        _amountPerShare.p = p;
        _amountPerShare.q = q;
    }

    /**
     * @dev Destroys `amount` tokens from the caller.
     *
     * See {ERC20-_burn}.
     */
    function burn(uint256 amount) public virtual {
        _burn(_msgSender(), amount);
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
    function burnFrom(address account, uint256 amount) public virtual {
        uint256 currentAllowance = allowance(account, _msgSender());
        require(currentAllowance >= amount, "ERC20: burn amount exceeds allowance");
        unchecked {
            _approve(account, _msgSender(), currentAllowance - amount);
        }
        _burn(account, amount);
    }

    /**
     * Throws if called by any account other than the manager.
     */
    modifier onlyVault() {
        require(isVault[msg.sender], "Strategy: caller is not a vault");
        _;
    }
}