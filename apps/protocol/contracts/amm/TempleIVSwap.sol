pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "hardhat/console.sol";


contract TempleIVSwap is Ownable {
    ERC20Burnable public immutable templeToken;
    IERC20 public immutable stablecToken;

    struct Price {
        uint frax;
        uint temple;
    }

    /// @notice intrinsinc value gauranteed by the protocol
    Price public iv;

    constructor(
        ERC20Burnable _templeToken,
        IERC20 _stablecToken,
        Price memory _iv
    ) {
        templeToken = _templeToken;
        stablecToken = _stablecToken;
        iv = _iv;
    }

    /**
     * @notice swap temple for stablec at IV
     */
    function swapTempleForIV(
        uint amountIn,
        address to,
        uint deadline
    ) external virtual ensure(deadline) {
        templeToken.burnFrom(msg.sender, amountIn);
        SafeERC20.safeTransfer(stablecToken, to, amountIn * (iv.frax / iv.temple));
    }

    /**
     * Explicitly set IV
     */
    function setIV(uint256 frax, uint256 temple) external onlyOwner {
        iv.frax = frax;
        iv.temple = temple;
    }

    /**
     * @notice transfer out amount of token to provided address
     */
    function withdraw(address token, address to, uint256 amount) external onlyOwner {
      require(to != address(0), "to address zero");
      if (token == address(0)) {
        (bool sent,) = payable(to).call{value: amount}("");
        require(sent, "send failed");
      } else {
        SafeERC20.safeTransfer(IERC20(token), to, amount);
      }
    }

    modifier ensure(uint deadline) {
        require(deadline >= block.timestamp, 'TempleIVSwap: EXPIRED');
        _;
    }
}
