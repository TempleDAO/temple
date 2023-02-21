pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (protocol/contracts/interfaces/templeLineOfCredit/ITempleLineOfCredit.sol)

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

/// @notice Helper interface for calling the TempleLineOfCredit contract
interface ITempleLineOfCredit {

  function depositReserve(IERC20 debtToken, address account, uint256 amount) external;

}
