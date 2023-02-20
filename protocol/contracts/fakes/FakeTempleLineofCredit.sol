pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Fake Temple Line of Credit (protocol/contracts/fakes/FakeTempleLineofCredit.sol)

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {IERC20Permit} from '@openzeppelin/contracts/token/ERC20/extensions/draft-IERC20Permit.sol';
import {ITempleLineOfCredit} from '../interfaces/templeLineOfCredit/ITempleLineOfCredit.sol';

/// @notice Helper interface for calling the TempleLineOfCredit contract
contract FakeTempleLineOfCredit is ITempleLineOfCredit {
  using SafeERC20 for IERC20;

  /**
   * @dev Allows operator to deposit debt tokens
   * @param debtToken debt token to deposit
   * @param account account to take debtToken from
   * @param amount is the amount to deposit
   */

  function depositReserve(
    IERC20 debtToken,
    address account,
    uint256 amount
  ) external override {

    SafeERC20.safeTransferFrom(debtToken, account, address(this), amount);
  }
}
