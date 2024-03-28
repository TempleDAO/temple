pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// import "hardhat/console.sol";

/**
 * @title A generic rebasing ERC20 implementation, based of openzepplin
 * 
 * @dev Intended to be inherited and customised per use case
 */
abstract contract RebasingERC20 is ERC20 {
    /**
     * @dev returns the total shares in existence. When scaled up
     * by amountPerShare we get the total supply
     */ 
    uint256 public totalShares;

    /**
     * @dev number of shares owned by any given account, this is
     * scalled up by amountPerShare to work out the totalSupply and
     * balanceOf any given account
     */
    mapping(address => uint256) public shareBalanceOf;

    /**
     * @dev Rebasing scaling factor - implemented by child classes and
     * controls the rebasing policy of the token.
     *
     * returns a rational (p/q where q != 0)
     */
    function amountPerShare() public view virtual returns (uint256 p, uint256 q);

    /**
     * @notice Returns the amount of tokens in existence.
     */
    function totalSupply() public view virtual override returns (uint256) {
        return toTokenAmount(totalShares);
    }

    /**
     * @notice Returns the amount of tokens owned by `account`.
     */
    function balanceOf(address account) public view virtual override returns (uint256) {
        return toTokenAmount(shareBalanceOf[account]);
    }

    /**
     * @dev See {IERC20-transfer}.
     *
     * Requirements:
     *
     * - `to` cannot be the zero address.
     * - the caller must have a balance of at least `value`.
     */
    function transfer(address to, uint256 value) public virtual override returns (bool) {
        address owner = _msgSender();
        _update(owner, to, value);
        return true;
    }

    /**
     * @dev See {IERC20-transferFrom}.
     *
     * Emits an {Approval} event indicating the updated allowance. This is not
     * required by the EIP. See the note at the beginning of {ERC20}.
     *
     * NOTE: Does not update the allowance if the current allowance
     * is the maximum `uint256`.
     *
     * Requirements:
     *
     * - `from` and `to` cannot be the zero address.
     * - `from` must have a balance of at least `value`.
     * - the caller must have allowance for ``from``'s tokens of at least
     * `value`.
     */
    function transferFrom(address from, address to, uint256 value) public virtual override returns (bool) {
        address spender = _msgSender();
        _spendAllowance(from, spender, value);
        _update(from, to, value);
        return true;
    }

    /**
     * @dev Moves `amount` of tokens from `sender` to `recipient`.
     *
     * This internal function is equivalent to {transfer}, and can be used to
     * e.g. implement automatic token fees, slashing mechanisms, etc.
     *
     * Emits a {Transfer} event.
     *
     * Requirements:
     *
     * - `sender` cannot be the zero address.
     * - `recipient` cannot be the zero address.
     * - `sender` must have a balance of at least `amount`.
     */
    function _update(
        address sender,
        address recipient,
        uint256 amount
    ) internal virtual override {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");

        uint256 senderBalanceShares = shareBalanceOf[sender];
        uint256 amountShares = toSharesAmount(amount);

        require(senderBalanceShares >= amountShares, "ERC20: transfer amount exceeds balance");
        unchecked {
            shareBalanceOf[sender] -= amountShares;
        }
        shareBalanceOf[recipient] += amountShares;

        emit Transfer(sender, recipient, amount);
    }

    /** @dev Creates `amount` tokens and assigns them to `account`, increasing
     * the total supply.
     *
     * Emits a {Transfer} event with `from` set to the zero address.
     *
     * Requirements:
     *
     * - `account` cannot be the zero address.
     */
    function _mintUpdate(address account, uint256 amount) internal {
        require(account != address(0), "ERC20: mint to the zero address");

        uint256 amountShares = toSharesAmount(amount);
        totalShares += amountShares;
        shareBalanceOf[account] += amountShares;
        emit Transfer(address(0), account, amount);
    }

    /**
     * @dev Destroys `amount` tokens from `account`, reducing the
     * total supply.
     *
     * Emits a {Transfer} event with `to` set to the zero address.
     *
     * Requirements:
     *
     * - `account` cannot be the zero address.
     * - `account` must have at least `amount` tokens.
     */
    function _burnUpdate(address account, uint256 amount) internal {
        require(account != address(0), "ERC20: burn from the zero address");

        uint256 accountBalanceShares = shareBalanceOf[account];
        uint256 amountShares = toSharesAmount(amount);

        require(accountBalanceShares >= amountShares, "ERC20: burn amount exceeds balance");
        unchecked {
            shareBalanceOf[account] = accountBalanceShares - amountShares;
        }
        totalShares -= amountShares;

        emit Transfer(account, address(0), amount);
    }

    function toTokenAmount(uint sharesAmount) public view returns (uint256 tokenAmount) {
        (uint256 p, uint256 q) = amountPerShare();
        tokenAmount = sharesAmount * p / q;
    }

    function toSharesAmount(uint tokenAmount) public view returns (uint256 sharesAmount) {
        (uint256 p, uint256 q) = amountPerShare();
        sharesAmount = tokenAmount * q / p;
    }
}