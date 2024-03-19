pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (amo/test/RamosTestnetTempleTokenVault.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IRamosTokenVault } from "contracts/interfaces/amo/helpers/IRamosTokenVault.sol";
import { ITempleERC20Token } from "contracts/interfaces/core/ITempleERC20Token.sol";

/// @notice A version of the Protocol Token Vault which has mint/burn rights on the Temple ERC20
contract RamosTestnetTempleTokenVault is IRamosTokenVault {
    using SafeERC20 for ITempleERC20Token;
    using SafeERC20 for IERC20;

    ITempleERC20Token public immutable templeToken;
    IERC20 public immutable quoteToken;

    constructor (address _templeToken, address _quoteToken) {
        templeToken = ITempleERC20Token(_templeToken);
        quoteToken = IERC20(_quoteToken);
    }

    function borrowProtocolToken(uint256 amount, address recipient) external {
        templeToken.mint(recipient, amount);
    }

    function borrowQuoteToken(uint256 amount, address recipient) external {
        quoteToken.safeTransfer(recipient, amount);
    }

    function repayProtocolToken(uint256 amount) external {
        templeToken.safeTransferFrom(msg.sender, address(this), amount);
        templeToken.burn(amount);
    }

    function repayQuoteToken(uint256 amount) external {
        quoteToken.safeTransferFrom(msg.sender, address(this), amount);
    }
}