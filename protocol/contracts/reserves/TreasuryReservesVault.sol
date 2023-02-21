pragma solidity 0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (reserves/TreasuryReservesVault.sol)

import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ITreasuryReservesDepositor} from "contracts/interfaces/reserves/ITreasuryReservesDepositor.sol";
import {ITreasuryReservesVault} from "contracts/interfaces/reserves/ITreasuryReservesVault.sol";

/// @notice Internal TempleDAO accounts can deposit and withdraw amounts of ERC20 tokens
/// into this vault. Deposits are routed to an appropriate low risk yield bearing protocol so they're
/// not sitting idle
contract TreasuryReservesVault is ITreasuryReservesVault, Ownable {
    using SafeERC20 for IERC20;

    /// @notice Token => Net Position across all accounts
    mapping(address => TokenPosition) internal _tokenPositions;

    /// @notice Account => Token => Position
    mapping(address => mapping(address => AccountPosition)) internal _accountPositions;

    error NotEnabled(address account, address token);
    error InvalidAddress(address addr);
    error DepositCapBreached(address account, address token, uint256 cap, int256 priorBalance, uint256 amountRequested);
    error WithdrawalCapBreached(address account, address token, uint256 cap, int256 priorBalance, uint256 amountRequested);
    error ExpectedNonZero();

    event TokenPositionDetailsSet(address indexed token, TokenPosition updatedTokenPosition);
    event AccountPositionDetailsSet(address indexed account, address indexed token, AccountPosition updatedAccountPosition);
    event TokenPositionBalanceSet(address indexed token, int256 oldBalance, int256 newBalance);
    event AccountPositionBalanceSet(address indexed account, address indexed token, int256 oldBalance, int256 newBalance);
    event ReservesDeposited(address indexed account, address indexed token, uint256 amount);
    event ReservesWithdrawn(address indexed account, address indexed token, uint256 amount, address indexed receiver);
    event TokenRecovered(address indexed to, address indexed token, uint256 amount);

    /// @notice Token => Net Position across all accounts
    /// @dev getter to return the struct as memory (rather than a bag of member variables)
    function tokenPositions(address tokenAddress) external view returns (TokenPosition memory) {
        return _tokenPositions[tokenAddress];
    }

    /// @notice Account => Token => Position
    /// @dev getter to return the struct as memory (rather than a bag of member variables)
    function accountPositions(address account, address tokenAddress) external view returns (AccountPosition memory) {
        return _accountPositions[account][tokenAddress];
    }

    /**
      * @notice Set the configuration details for a particular account
      * to deposit/withdraw into the reserves vault
      * @param token The token to set the position for
      * @param areDepositsEnabled Whether deposits are enabled for this token
      * @param depositCap The maximum amount of net deposits this token is allowed to have, across all users
      * @param areWithdrawalsEnabled Whether withdrawals are enabled for this token
      * @param withdrawalCap The maximum amount of net debt this token is allowed to go into, across all users
      * @param depositor The Treasury Reserves Depositor responsible for putting the capital to work
      */
    function setTokenPositionDetails(
        address token, 
        bool areDepositsEnabled,
        uint256 depositCap,
        bool areWithdrawalsEnabled,
        uint256 withdrawalCap,
        address depositor
    ) external onlyOwner {
        TokenPosition storage tokenPosition = _tokenPositions[token];
        tokenPosition.areDepositsEnabled = areDepositsEnabled;
        tokenPosition.depositCap = uint248(depositCap);
        tokenPosition.areWithdrawalsEnabled = areWithdrawalsEnabled;
        tokenPosition.withdrawalCap = uint248(withdrawalCap);

        // Set the depositor
        if (depositor == address(0)) revert InvalidAddress(depositor);
        tokenPosition.depositor = ITreasuryReservesDepositor(depositor);
        
        emit TokenPositionDetailsSet(token, tokenPosition);
    }

    /**
      * @notice Set the configuration details for a particular account
      * to deposit/withdraw into the reserves vault
      * @param account The account address to set the position for
      * @param token The token to set the position for
      * @param areDepositsEnabled Whether deposits are enabled for this token
      * @param depositCap The maximum amount of net deposits this token is allowed to have, across all users
      * @param areWithdrawalsEnabled Whether withdrawals are enabled for this token
      * @param withdrawalCap The maximum amount of net debt this token is allowed to go into, across all users
      */
    function setAccountPositionDetails(
        address account, 
        address token, 
        bool areDepositsEnabled,
        uint256 depositCap,
        bool areWithdrawalsEnabled,
        uint256 withdrawalCap
    ) external onlyOwner {
        AccountPosition storage accountPosition = _accountPositions[account][token];
        accountPosition.areDepositsEnabled = areDepositsEnabled;
        accountPosition.depositCap = uint248(depositCap);
        accountPosition.areWithdrawalsEnabled = areWithdrawalsEnabled;
        accountPosition.withdrawalCap = uint248(withdrawalCap);
        emit AccountPositionDetailsSet(account, token, accountPosition);
    }

    /**
      * @notice Owner can update the utilised balance for a particular token. Useful for migrations
      * @dev Note: These are only balances for *internal* contracts, not user facing. So this is safu
      * @param token The token to set the position balance for
      * @param newBalance The updated balance to reset to
      */
    function setTokenPositionBalance(address token, int256 newBalance) external onlyOwner {
        TokenPosition storage tokenPosition = _tokenPositions[token];
        emit TokenPositionBalanceSet(token, tokenPosition.balance, newBalance);
        tokenPosition.balance = newBalance;
    }

    /**
      * @notice Owner can update the utilised balance for a particular account & token. Useful for migrations
      * @dev Note: These are only balances for *internal* contracts, not user facing. So this is safu
      * @param account The account address to set the position balance for
      * @param token The token to set the position balance for
      * @param newBalance The updated balance to reset to
      */
    function setAccountPositionBalance(address account, address token, int256 newBalance) external onlyOwner {
        AccountPosition storage accountPosition = _accountPositions[account][token];
        emit AccountPositionBalanceSet(account, token, accountPosition.balance, newBalance);
        accountPosition.balance = newBalance;
    }

    /**
      * @notice Approved callers can deposit tokens into the vault, up to a cap.
      * @dev There is a net deposit cap per token, across all accounts. 
      * And also a cap per token, per account.
      */
    function deposit(address token, uint256 amount) external {
        if (amount == 0) revert ExpectedNonZero();

        TokenPosition storage tokenPosition = _tokenPositions[token];
        if (!tokenPosition.areDepositsEnabled) revert NotEnabled(address(0), token);

        // Check and increment the overall token position
        {
            int256 _tokenBalance = tokenPosition.balance;

            _tokenBalance += int256(amount);
            if (_tokenBalance > int248(tokenPosition.depositCap)) {
                revert DepositCapBreached(address(0), token, tokenPosition.depositCap, tokenPosition.balance, amount);
            }
            tokenPosition.balance = _tokenBalance;
        }

        // Check and increment the account position
        {
            AccountPosition storage accountPosition = _accountPositions[msg.sender][token];
            if (!accountPosition.areDepositsEnabled) revert NotEnabled(msg.sender, token);
            int256 _accountBalance = accountPosition.balance;

            _accountBalance += int256(amount);
            if (_accountBalance > int248(accountPosition.depositCap)) {
                revert DepositCapBreached(msg.sender, token, accountPosition.depositCap, accountPosition.balance, amount);
            }
            accountPosition.balance = _accountBalance;
        }
        
        emit ReservesDeposited(msg.sender, token, amount);

        // Send tokens to the depositor and apply
        {
            IERC20(token).safeTransferFrom(msg.sender, address(tokenPosition.depositor), amount);
            tokenPosition.depositor.applyDeposits();
        }
    }

    /**
      * @notice Approved callers can withdraw tokens into the vault, up to a cap.
      * @dev There is a net withdrawal cap per token, across all accounts. 
      * And also a cap per token, per account.
      */
    function withdraw(address token, uint256 amount, address receiver) external {
        if (amount == 0) revert ExpectedNonZero();

        TokenPosition storage tokenPosition = _tokenPositions[token];
        if (!tokenPosition.areWithdrawalsEnabled) revert NotEnabled(address(0), token);

        // Check and decrement the overall token position
        {
            int256 _tokenBalance = tokenPosition.balance;

            _tokenBalance -= int256(amount);
            if (_tokenBalance < -1 * int248(tokenPosition.withdrawalCap)) {
                revert WithdrawalCapBreached(address(0), token, tokenPosition.withdrawalCap, tokenPosition.balance, amount);
            }
            tokenPosition.balance = _tokenBalance;
        }

        // Check and decrement the account position
        {
            AccountPosition storage accountPosition = _accountPositions[msg.sender][token];
            if (!accountPosition.areWithdrawalsEnabled) revert NotEnabled(msg.sender, token);
            int256 _accountBalance = accountPosition.balance;

            _accountBalance -= int256(amount);
            if (_accountBalance < -1 * int248(accountPosition.withdrawalCap)) {
                revert WithdrawalCapBreached(msg.sender, token, accountPosition.withdrawalCap, accountPosition.balance, amount);
            }
            accountPosition.balance = _accountBalance;
        }

        emit ReservesWithdrawn(msg.sender, token, amount, receiver);

        // Withdraw the tokens from the depositor and send to the receiver.
        tokenPosition.depositor.withdraw(amount, receiver);
    }

    /// @notice Owner can recover tokens
    /// @dev ERC20 tokens aren't kept in this contract under normal operations.
    function recoverToken(address _token, address _to, uint256 _amount) external onlyOwner {
        emit TokenRecovered(_to, _token, _amount);
        IERC20(_token).safeTransfer(_to, _amount);
    }
}
