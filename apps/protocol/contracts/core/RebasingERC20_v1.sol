pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title A generic rebasing ERC20 implementation
 * 
 * @dev Intended to be inherited and customised per use case
 */
abstract contract RebaseingER2CO_v1 is IERC20 {
    // // A number of the form p/q where q != 0
    // struct Rational {
    //     uint256 p;
    //     uint256 q;
    // }

    // Rational public amountPerShare;
    // uint256 public totalShares;

    // uint256 public name;
    // uint256 public symbol;

    // mapping(address => uint256) public balanceOfShare;

    // /**
    //  * @dev Returns the remaining number of tokens that `spender` will be
    //  * allowed to spend on behalf of `owner` through {transferFrom}. This is
    //  * zero by default.
    //  *
    //  * This value changes when {approve} or {transferFrom} are called.
    //  */
    // mapping(address => mapping(address => uint256)) private allowance;

    // /**
    //  * @dev Sets the values for {name} and {symbol}.
    //  *
    //  * The default value of {decimals} is 18. To select a different value for
    //  * {decimals} you should overload it.
    //  *
    //  * All two of these values are immutable: they can only be set once during
    //  * construction.
    //  */
    // constructor(string memory name_, string memory symbol_) {
    //     _name = name_;
    //     _symbol = symbol_;
    // }

    // /**
    //  * @dev Sets the value per share.
    //  *
    //  * This effectively rebases the token, scaling the totalSupply
    //  * and balance per holder
    //  */
    // function setAmountPerShare(Rational memory _amountPerShare) {
    //     amountPerShare = _amountPerShare;
    // }

    // /**
    //  * @dev Returns the number of decimals used to get its user representation.
    //  * For example, if `decimals` equals `2`, a balance of `505` tokens should
    //  * be displayed to a user as `5.05` (`505 / 10 ** 2`).
    //  *
    //  * Tokens usually opt for a value of 18, imitating the relationship between
    //  * Ether and Wei. This is the value {ERC20} uses, unless this function is
    //  * overridden;
    //  *
    //  * NOTE: This information is only used for _display_ purposes: it in
    //  * no way affects any of the arithmetic of the contract, including
    //  * {IERC20-balanceOf} and {IERC20-transfer}.
    //  */
    // function decimals() public view virtual override returns (uint8) {
    //     return 18;
    // }

    // /**
    //  * @dev Returns the amount of tokens in existence.
    //  */
    // function totalSupply() external view returns (uint256) {
    //     return totalShares * amountPerShare.p / amountPerShare.q;
    // }

    // /**
    //  * @dev Returns the amount of tokens owned by `account`.
    //  */
    // function balanceOf(address account) external view returns (uint256) {
    //     return balanceOfShare[account] * amountPerShare.p / amountPerShare.q;
    // }

    // /**
    //  * @dev Moves `amount` tokens from the caller's account to `recipient`.
    //  *
    //  * Returns a boolean value indicating whether the operation succeeded.
    //  *
    //  * Emits a {Transfer} event.
    //  */
    // function transfer(address recipient, uint256 amount) external returns (bool) {
    //     _transfer(_msgSender(), recipient, amount);
    //     return true;
    // }

    // /**
    //  * @dev Sets `amount` as the allowance of `spender` over the caller's tokens.
    //  *
    //  * Returns a boolean value indicating whether the operation succeeded.
    //  *
    //  * IMPORTANT: Beware that changing an allowance with this method brings the risk
    //  * that someone may use both the old and the new allowance by unfortunate
    //  * transaction ordering. One possible solution to mitigate this race
    //  * condition is to first reduce the spender's allowance to 0 and set the
    //  * desired value afterwards:
    //  * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
    //  *
    //  * Emits an {Approval} event.
    //  */
    // function approve(address spender, uint256 amount) external returns (bool) {
    //     _approve(_msgSender(), spender, amount);
    //     return true;
    // }

    // /**
    //  * @dev Moves `amount` tokens from `sender` to `recipient` using the
    //  * allowance mechanism. `amount` is then deducted from the caller's
    //  * allowance.
    //  *
    //  * Returns a boolean value indicating whether the operation succeeded.
    //  *
    //  * Emits a {Transfer} event.
    //  */
    // function transferFrom(
    //     address sender,
    //     address recipient,
    //     uint256 amount
    // ) external returns (bool) {
    //     _transfer(sender, recipient, amount);

    //     uint256 currentAllowance = allowances[sender][_msgSender()];
    //     require(currentAllowance >= amount, "ERC20: transfer amount exceeds allowance");
    //     unchecked {
    //         _approve(sender, _msgSender(), currentAllowance - amount);
    //     }

    //     return true;
    // }

    // /**
    //  * @dev Atomically increases the allowance granted to `spender` by the caller.
    //  *
    //  * This is an alternative to {approve} that can be used as a mitigation for
    //  * problems described in {IERC20-approve}.
    //  *
    //  * Emits an {Approval} event indicating the updated allowance.
    //  *
    //  * Requirements:
    //  *
    //  * - `spender` cannot be the zero address.
    //  */
    // function increaseAllowance(address spender, uint256 addedValue) public virtual returns (bool) {
    //     _approve(_msgSender(), spender, allowances[_msgSender()][spender] + addedValue);
    //     return true;
    // }

    // /**
    //  * @dev Atomically decreases the allowance granted to `spender` by the caller.
    //  *
    //  * This is an alternative to {approve} that can be used as a mitigation for
    //  * problems described in {IERC20-approve}.
    //  *
    //  * Emits an {Approval} event indicating the updated allowance.
    //  *
    //  * Requirements:
    //  *
    //  * - `spender` cannot be the zero address.
    //  * - `spender` must have allowance for the caller of at least
    //  * `subtractedValue`.
    //  */
    // function decreaseAllowance(address spender, uint256 subtractedValue) public virtual returns (bool) {
    //     uint256 currentAllowance = allowances[_msgSender()][spender];
    //     require(currentAllowance >= subtractedValue, "ERC20: decreased allowance below zero");
    //     unchecked {
    //         _approve(_msgSender(), spender, currentAllowance - subtractedValue);
    //     }

    //     return true;
    // }

    // /**
    //  * @dev Emitted when `value` tokens are moved from one account (`from`) to
    //  * another (`to`).
    //  *
    //  * Note that `value` may be zero.
    //  */
    // event Transfer(address indexed from, address indexed to, uint256 value);

    // /**
    //  * @dev Emitted when the allowance of a `spender` for an `owner` is set by
    //  * a call to {approve}. `value` is the new allowance.
    //  */
    // event Approval(address indexed owner, address indexed spender, uint256 value);


    // /**
    //  * @dev Moves `amount` of tokens from `sender` to `recipient`.
    //  *
    //  * This internal function is equivalent to {transfer}, and can be used to
    //  * e.g. implement automatic token fees, slashing mechanisms, etc.
    //  *
    //  * Emits a {Transfer} event.
    //  *
    //  * Requirements:
    //  *
    //  * - `sender` cannot be the zero address.
    //  * - `recipient` cannot be the zero address.
    //  * - `sender` must have a balance of at least `amount`.
    //  */
    // function _transfer(
    //     address sender,
    //     address recipient,
    //     uint256 amount
    // ) internal virtual {
    //     require(sender != address(0), "ERC20: transfer from the zero address");
    //     require(recipient != address(0), "ERC20: transfer to the zero address");

    //     uint256 senderBalanceShares = balanceOfShare[sender];
    //     uint256 amountShares = amount * amountPerShare.q / amountPerShare.p;

    //     require(senderBalanceShares >= amountShares, "ERC20: transfer amount exceeds balance");
    //     unchecked {
    //         balanceOfShare[sender] -= amountShares;
    //     }
    //     balanceOfShare[recipient] += amountShares;

    //     emit Transfer(sender, recipient, amount);
    // }

    // /** @dev Creates `amount` tokens and assigns them to `account`, increasing
    //  * the total supply.
    //  *
    //  * Emits a {Transfer} event with `from` set to the zero address.
    //  *
    //  * Requirements:
    //  *
    //  * - `account` cannot be the zero address.
    //  */
    // function _mint(address account, uint256 amount) internal virtual {
    //     require(account != address(0), "ERC20: mint to the zero address");

    //     uint256 amountShares = amount * amountPerShare.q / amountPerShare.p;
    //     totalShares += amountShares;
    //     _balances[account] += amountShares;
    //     emit Transfer(address(0), account, amount);
    // }

    // /**
    //  * @dev Destroys `amount` tokens from `account`, reducing the
    //  * total supply.
    //  *
    //  * Emits a {Transfer} event with `to` set to the zero address.
    //  *
    //  * Requirements:
    //  *
    //  * - `account` cannot be the zero address.
    //  * - `account` must have at least `amount` tokens.
    //  */
    // function _burn(address account, uint256 amount) internal virtual {
    //     require(account != address(0), "ERC20: burn from the zero address");

    //     uint256 senderBalanceShares = balanceOfShare[sender];
    //     uint256 amountShares = amount * amountPerShare.q / amountPerShare.p;

    //     require(senderBalanceShares >= amountShares, "ERC20: burn amount exceeds balance");
    //     unchecked {
    //         balanceOfShare[account] = accountBalance - amountShares;
    //     }
    //     totalShares -= amountShares;

    //     emit Transfer(account, address(0), amount);
    // }

    // /**
    //  * @dev Sets `amount` as the allowance of `spender` over the `owner` s tokens.
    //  *
    //  * This internal function is equivalent to `approve`, and can be used to
    //  * e.g. set automatic allowances for certain subsystems, etc.
    //  *
    //  * Emits an {Approval} event.
    //  *
    //  * Requirements:
    //  *
    //  * - `owner` cannot be the zero address.
    //  * - `spender` cannot be the zero address.
    //  */
    // function _approve(
    //     address owner,
    //     address spender,
    //     uint256 amount
    // ) internal virtual {
    //     require(owner != address(0), "ERC20: approve from the zero address");
    //     require(spender != address(0), "ERC20: approve to the zero address");

    //     allowances[owner][spender] = amount;
    //     emit Approval(owner, spender, amount);
    // }
}