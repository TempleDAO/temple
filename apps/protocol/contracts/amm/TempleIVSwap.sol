pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "../TempleERC20Token.sol";

// import "hardhat/console.sol";


contract TempleIVSwap is Ownable {
    TempleERC20Token public immutable templeToken;
    IERC20 public immutable stablecToken;

    struct Price {
        uint frax;
        uint temple;
    }

    /// @notice intrinsinc value gauranteed by the protocol
    Price public iv;

    constructor(
        TempleERC20Token _templeToken,
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
        SafeERC20.safeTransferFrom(templeToken, msg.sender, address(this), amountIn);
        SafeERC20.safeTransfer(stablecToken, to, amountIn * iv.frax / iv.temple);
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

    /**
     * @notice burn the given amount of temple held by this contract
     */
    function burnTemple(uint256 amount) external onlyOwner {
      templeToken.burn(amount);
    }

    modifier ensure(uint deadline) {
        require(deadline >= block.timestamp, 'TempleIVSwap: EXPIRED');
        _;
    }
}
