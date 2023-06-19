pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (amo/test/RamosTestnetTempleTokenVault.sol)

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IRamosTokenVault } from "contracts/interfaces/amo/helpers/IRamosTokenVault.sol";
import { ITempleERC20Token } from "contracts/interfaces/core/ITempleERC20Token.sol";

/// @notice A version of the Protocol Token Vault which has mint/burn rights on the Temple ERC20
contract RamosTestnetTempleTokenVault is IRamosTokenVault {
    using SafeERC20 for ITempleERC20Token;

    ITempleERC20Token public immutable templeToken;

    constructor (address _templeToken) {
        templeToken = ITempleERC20Token(_templeToken);
    }

    function borrowProtocolToken(uint256 amount, address recipient) external {
        templeToken.mint(recipient, amount);
    }

    function repayProtocolToken(uint256 amount) external {
        templeToken.safeTransferFrom(msg.sender, address(this), amount);
        templeToken.burn(amount);
    }
}