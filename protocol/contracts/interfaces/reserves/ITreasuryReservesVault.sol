pragma solidity 0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/reserves/ITreasuryReservesVault.sol)

import {ITreasuryReservesDepositor} from "contracts/interfaces/reserves/ITreasuryReservesDepositor.sol";

/// @notice Internal TempleDAO accounts can deposit and withdraw amounts of ERC20 tokens
/// into this vault. Deposits are routed to an appropriate low risk yield bearing protocol so they're
/// not sitting idle
interface ITreasuryReservesVault {
    
    /// @notice A per token position across all accounts in the vault.
    struct TokenPosition {
        /// @dev Whether deposits are enabled for this token, even if the balance is negative
        bool areDepositsEnabled;

        /// @dev The maximum amount of net deposits this token is allowed to have, across all users
        uint248 depositCap;

        /// @dev Whether withdrawals are enabled for this token, even if the balance is positive
        bool areWithdrawalsEnabled;

        /// @dev The maximum amount of net debt this token is allowed to go into, across all users
        uint248 withdrawalCap;

        /// @dev The contract responsible for putting the reserves to work for this token.
        ITreasuryReservesDepositor depositor;
        
        /// @dev The net balance of deposits and withdrawals across all users.
        /// Positive balance: All acounts have a net positive position (ie deposits)
        /// Negative balance: All accounts have a net negative position (ie withdrawals)
        int256 balance;
    }

    /// @notice A per account position representing the deposit or withdrawal balance
    /// for a particular token
    struct AccountPosition {
        /// @dev Whether deposits are enabled for this account & token, even if the balance is negative
        bool areDepositsEnabled;

        /// @dev The maximum amount of net deposits this account & token is allowed to have
        uint248 depositCap;

        /// @dev Whether withdrawals are enabled for this account & token, even if the balance is positive
        bool areWithdrawalsEnabled;
        
        /// @dev The maximum amount of net debt this account & token is allowed to go into
        uint248 withdrawalCap;

        /// @dev The net balance of deposits and withdrawals.
        /// Positive balance: The account has a net positive position (ie deposits)
        /// Negative balance: The account has a net negative position (ie withdrawals)
        int256 balance;
    }
    
    /// @notice Token => Net Position across all accounts
    /// @dev getter to return the struct as memory (rather than a bag of member variables)
    function tokenPositions(address tokenAddress) external view returns (TokenPosition memory);

    /// @notice Account => Token => Position
    /// @dev getter to return the struct as memory (rather than a bag of member variables)
    function accountPositions(address account, address tokenAddress) external view returns (AccountPosition memory);

    /**
      * @notice Approved callers can deposit tokens into the vault, up to a cap.
      * @dev There is a net deposit cap per token, across all accounts. 
      * And also a cap per token, per account.
      */
    function deposit(address token, uint256 amount) external;

    /**
      * @notice Approved callers can withdraw tokens into the vault, up to a cap.
      * @dev There is a net withdrawal cap per token, across all accounts. 
      * And also a cap per token, per account.
      */
    function withdraw(address token, uint256 amount, address receiver) external;
}