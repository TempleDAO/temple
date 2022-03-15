pragma solidity ^0.8.4;
// SPDX-License-Identifier: GPL-3.0-or-later

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "../TempleERC20Token.sol";

import "hardhat/console.sol";


contract TempleIVSwap is Ownable {
    TempleERC20Token public immutable templeToken;

    struct Price {
        uint frax;
        uint temple;
    }

    // some portion of all buys above threshold get minted on protocol
    Price public iv;

    modifier ensure(uint deadline) {
        require(deadline >= block.timestamp, 'TempleFraxAMMRouter: EXPIRED');
        _;
    }

    constructor(
        TempleERC20Token _templeToken,
        Price memory _iv
    ) {
        templeToken = _templeToken;
        iv = _iv;
    }


    function swapExactTempleForFrax(
        uint amountIn,
        address to,
        uint deadline
    ) external virtual ensure(deadline) {
        SafeERC20.burnFrom(templeToken, msg.sender);
        SafeERC20.transfer(templeToken, to, amountIn * (iv.frax / iv.temple));
    }

    function setIV(uint256 frax, uint256 temple) external onlyOwner {
        iv.frax = frax;
        iv.temple = temple;
    }
}
