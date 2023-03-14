pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Fake Temple Line of Credit (protocol/contracts/fakes/FakeTreasuryReservesVault.sol)

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {IERC20Permit} from '@openzeppelin/contracts/token/ERC20/extensions/draft-IERC20Permit.sol';
import {ITreasuryReservesVault} from "contracts/interfaces/reserves/ITreasuryReservesVault.sol";

/// @notice Fake contract for testing purposes to simulate TreasuryReserveVault.deposit
contract FakeTreasuryReservesVault is ITreasuryReservesVault {
  using SafeERC20 for IERC20;

    /**
      * @notice Approved callers can deposit tokens into the vault, up to a cap.
      * @dev There is a net deposit cap per token, across all accounts. 
      * And also a cap per token, per account.
      */
    function deposit(address token, uint256 amount) external{

    IERC20(token).safeTransferFrom( msg.sender, address(this), amount);
  }

    

  
    /// @notice Token => Net Position across all accounts
    /// @dev getter to return the struct as memory (rather than a bag of member variables)
    function tokenPositions(address tokenAddress) external view returns (TokenPosition memory){

    }

    /// @notice Account => Token => Position
    /// @dev getter to return the struct as memory (rather than a bag of member variables)
    function accountPositions(address account, address tokenAddress) external view returns (AccountPosition memory){

    }

    /**
      * @notice Approved callers can deposit tokens into the vault, up to a cap.
      * @dev There is a net deposit cap per token, across all accounts. 
      * And also a cap per token, per account.
      */

    /**
      * @notice Approved callers can withdraw tokens into the vault, up to a cap.
      * @dev There is a net withdrawal cap per token, across all accounts. 
      * And also a cap per token, per account.
      */
    function withdraw(address token, uint256 amount, address receiver) external{

    }

}
