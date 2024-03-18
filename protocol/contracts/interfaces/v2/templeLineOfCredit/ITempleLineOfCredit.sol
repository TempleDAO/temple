pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/v2/templeLineOfCredit/ITempleLineOfCredit.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { ITlcEventsAndErrors } from "contracts/interfaces/v2/templeLineOfCredit/ITlcEventsAndErrors.sol";
import { ITlcDataTypes } from "contracts/interfaces/v2/templeLineOfCredit/ITlcDataTypes.sol";
import { ITreasuryReservesVault } from "contracts/interfaces/v2/ITreasuryReservesVault.sol";
import { ITlcStrategy } from "contracts/interfaces/v2/strategies/ITlcStrategy.sol";
import { ITempleCircuitBreakerProxy } from "contracts/interfaces/v2/circuitBreaker/ITempleCircuitBreakerProxy.sol";

/**
 * @title Temple Line of Credit (TLC)
 * @notice Users supply Temple as collateral, and can then borrow DAI.
 * 
 * Temple is valued at the Temple Treasury Price Index (TPI)
 * User debt increases at a continuously compounding rate.
 * Liquidations occur when users LTV exceeds the maximum allowed.
 */
interface ITempleLineOfCredit is ITlcDataTypes, ITlcEventsAndErrors {
    /**
     * @notice Deposit Temple as collateral
     * @param collateralAmount The amount to deposit
     * @param onBehalfOf An account can add collateral on behalf of another address.
     */
    function addCollateral(uint128 collateralAmount, address onBehalfOf) external;

    /**
     * @notice Remove Temple collateral. (active borrow positions are not allowed to go above the max LTV)
     * @param amount The amount of collateral to remove
     * @param recipient Send the Temple collateral to a specified recipient address.
     */
    function removeCollateral(uint128 amount, address recipient) external;

    /**
     * @notice Borrow DAI (not allowed to borrow over the max LTV)
     * @param amount The amount to borrow
     * @param recipient Send the borrowed token to a specified recipient address.
     */
    function borrow(uint128 amount, address recipient) external;

    /**
     * @notice An account repays some of its DAI debt
     * @param repayAmount The amount to repay. Cannot be more than the current debt.
     * @param onBehalfOf Another address can repay the debt on behalf of someone else
     */
    function repay(uint128 repayAmount, address onBehalfOf) external;
    
    /**
     * @notice An account repays all of its DAI debt
     * @dev The amount of debt is calculated as of this block.
     * @param onBehalfOf Another address can repay the debt on behalf of someone else
     */
    function repayAll(address onBehalfOf) external;

    /**
     * @notice Liquidate one or more accounts which have exceeded the 
     * maximum allowed LTV.
     * The Temple collateral is seized, and the accounts debt wiped.
     * @dev If one of the accounts in the batch hasn't exceeded the max LTV
     * then no action is performed for that account.
     */
    function batchLiquidate(
        address[] calldata accounts
    ) external returns (
        uint128 totalCollateralClaimed,
        uint128 totalDaiDebtWiped
    );

    /**
     * @notice New borrows of DAI may be paused in an emergency to protect user funds
     */
    function setBorrowPaused(bool isPaused) external;

    /**
     * @notice Liquidations may be paused in order for users to recover/repay debt after emergency
     * actions
     */
    function setLiquidationsPaused(bool isPaused) external;

    /**
     * @notice Set the minimum amount of Temple which must be borrowed on each call.
     */
    function setMinBorrowAmount(uint128 amount) external;

    /**
     * @notice Update the TLC Strategy contract, and Treasury Reserves Vault (TRV)
     * @dev The TRV is granted access to spend DAI, in order to repay debt.
     */
    function setTlcStrategy(address _tlcStrategy) external;
    
    /**
     * @notice Update the interest rate model contract for DAI borrows
     * @param interestRateModel The contract address of the new model
     */
    function setInterestRateModel(address interestRateModel) external;
    
    /**
     * @notice Set the maximum Loan To Value Ratio allowed for DAI borrows before the position is liquidated
     * @param maxLtvRatio The max LTV ratio (18 decimal places)
     */
    function setMaxLtvRatio(uint256 maxLtvRatio) external;
    
    /**
     * @notice Elevated access can recover tokens accidentally sent to this contract
     * No user Temple collateral can be taken.
     */
    function recoverToken(address token, address to, uint256 amount) external;

    /**
     * @notice Update and checkpoint the total debt up until now
     * Then recalculate the interest rate based on the updated utilisation ratio.
     */
    function refreshInterestRates() external;
    
    /**
     * @notice The collateral token supplied by users/accounts
     */
    function templeToken() external view returns (IERC20);
    
    /**
     * @notice DAI token -- the debt token which can be borrowed
     */
    function daiToken() external view returns (IERC20);

    /**
     * @notice The Treasury Reserve Vault (TRV) which funds the DAI borrows to users/accounts.
     * - When users borrow, the DAI is pulled from the TRV
     *      (via the TlcStrategy, increasing the dUSD debt)
     * - When users repay, the DAI is repaid to the TRV 
     *      (reducing the dUSD debt of the TlcStrategy)
     * - When there is a liquidation, the seized Temple collateral is paid to the TRV
     *      (reducing the dTEMPLE debt of the TlcStrategy)
     */
    function treasuryReservesVault() external view returns (ITreasuryReservesVault);

    /**
     * @notice The Strategy contract managing the TRV borrows and equity positions of TLC.
     */
    function tlcStrategy() external view returns (ITlcStrategy);

    /**
     * @notice A record of the total amount of collateral deposited by users/accounts.
     */
    function totalCollateral() external view returns (uint256);

    /**
     * @notice Liquidations may be paused in order for users to recover/repay debt after emergency
     * actions
     */
    function liquidationsPaused() external view returns (bool);

    /**
     * @notice The minimum borrow amount per transaction
     * @dev It costs gas to liquidate users, so we don't want dust amounts.
     */
    function minBorrowAmount() external view returns (uint128);

    /**
     * @notice An view of an accounts current and up to date position as of this block
     * @param account The account to get a position for
     */
    function accountPosition(
        address account
    ) external view returns (
        AccountPosition memory position
    );

    /**
     * @notice Get the current total DAI debt position across all accounts
     * as of this block.
     */
    function totalDebtPosition() external view returns (
        TotalDebtPosition memory daiPosition
    );

    /**
     * @notice Compute the liquidity status for a set of accounts.
     * @dev This can be used to verify if accounts can be liquidated or not.
     * @param accounts The accounts to get the status for.
     */
    function computeLiquidity(
        address[] calldata accounts
    ) external view returns (LiquidationStatus[] memory status);

    /**
     * @notice A view of the last checkpoint of account data (not as of this block)
     */
    function accountData(
        address account
    ) external view returns (AccountData memory data);

    /**
     * @notice Configuration and latest data snapshot of the DAI debt token
     */
    function debtTokenDetails() external view returns (
        DebtTokenConfig memory config, 
        DebtTokenData memory data
    );

    /**
     * @notice New borrows and collateral withdrawals are checked against a circuit breaker
     * to ensure no more than a cap is withdrawn in a given period
     */
    function circuitBreakerProxy() external view returns (ITempleCircuitBreakerProxy);
}
