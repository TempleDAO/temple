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

    function _update(address from, address to, uint256 value) internal virtual override {
        uint256 shares = toSharesAmount(value);
        if (from == address(0)) {
            // MINT
            // Overflow check required: The rest of the code assumes that totalShares never overflows
            totalShares += shares;
        } else {
            // TRANSFER FROM
            uint256 fromBalanceShares = shareBalanceOf[from];
            if (fromBalanceShares < shares) {
                revert ERC20InsufficientBalance(from, fromBalanceShares, shares);
            }
            unchecked {
                // Overflow not possible: shares <= fromBalanceShares <= totalShares.
                shareBalanceOf[from] = fromBalanceShares - shares;
            }
        }

        if (to == address(0)) {
            // BURN
            unchecked {
                // Overflow not possible: shares <= totalShares or value <= fromBalanceShares <= totalShares.
                totalShares -= shares;
            }
        } else {
            // TRANSFER TO
            unchecked {
                // Overflow not possible: balance + value is at most totalShares, which we know fits into a uint256.
                shareBalanceOf[to] += shares;
            }
        }

        emit Transfer(from, to, value);
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