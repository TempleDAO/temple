pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (contracts/common/IMintableToken.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/draft-IERC20Permit.sol";

/// @notice An ERC20 token which can be minted/burnt by approved accounts
interface IMintableToken is IERC20, IERC20Permit {
    function mint(address to, uint256 amount) external;
    function burn(address account, uint256 amount) external;
}