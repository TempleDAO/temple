pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/v2/templeLineOfCredit/ITempleLineOfCredit.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { ITlcEventsAndErrors } from "contracts/interfaces/v2/templeLineOfCredit/ITlcEventsAndErrors.sol";
import { ITlcDataTypes } from "contracts/interfaces/v2/templeLineOfCredit/ITlcDataTypes.sol";
import { ITreasuryReservesVault } from "contracts/interfaces/v2/ITreasuryReservesVault.sol";
import { ITlcStrategy } from "contracts/interfaces/v2/templeLineOfCredit/ITlcStrategy.sol";

/**
 * @title Temple Line of Credit (TLC)
 * @notice Users supply Temple as collateral, and can then borrow DAI.
 * 
 * Both borrows and collateral withdraws require two transactions:
 *   1/ Request the borrow | collateral withdrawal
 *   2/ Wait until the min request time has passed (and before the max time)
 *      and then do the borrow | collateral withdrawal.
 * This is in order to further mitigate money market attack vectors. Requests 
 * can be cancelled by the user or with elevated access on behalf of users.
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
    function addCollateral(uint256 collateralAmount, address onBehalfOf) external;

    /**
     * @notice An account requests to remove Temple collateral.
     * @dev After this request is issued, the account must then execute the `removeCollateral()`
     * within the `removeCollateralRequestConfig`
     * Subsequent requests override previous requests.
     * @param amount The amount of collateral to remove
     */
    function requestRemoveCollateral(uint256 amount) external;

    /**
     * @notice An account (or elevated access) cancels an existing Remove Collateral request
     * @param account The account to cancel the request for.
     */
    function cancelRemoveCollateralRequest(address account) external;

    /**
     * @notice Execute the remove collateral request, within the window of the prior issued request
     * @param recipient Send the Temple collateral to a specified recipient address.
     */
    function removeCollateral(address recipient) external;

    /**
     * @notice An account requests to borrow DAI
     * @dev After this request is issued, the account must then execute the `borrow()`
     * within the valid borrow request window
     * Subsequent requests override previous requests.
     * @param amount The amount to borrow
     */
    function requestBorrow(uint256 amount) external;
    
    /**
     * @notice An account (or elevated access) cancels an existing Borrow request
     * @param account The account to cancel the request for.
     */
    function cancelBorrowRequest(address account) external;
    
    /**
     * @notice Execute the borrow request, within the window of the prior issued request
     * @param recipient Send the borrowed token to a specified recipient address.
     */
    function borrow(address recipient) external;

    /**
     * @notice An account repays some of its borrowed DAI debt
     * @param repayAmount The amount to repay. Cannot be more than the current debt.
     * @param onBehalfOf Another address can repay the debt on behalf of someone else
     */
    function repay(uint256 repayAmount, address onBehalfOf) external;
    
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
        uint256 totalCollateralClaimed,
        uint256 totalDaiDebtWiped
    );

    /**
     * @notice Update the TLC Strategy contract, and Treasury Reserves Vault (TRV)
     * @dev The TRV is granted access to spend DAI, in order to repay debt.
     */
    function setTlcStrategy(address _tlcStrategy) external;
    
    /**
     * @notice Set the Withdrawal Collateral Request window parameters
     * @param minSecs The number of seconds which must elapse between a request and the action
     * @param maxSecs The number of seconds until a request expires
     */
    function setWithdrawCollateralRequestConfig(uint256 minSecs, uint256 maxSecs) external;
    
    /**
     * @notice Set the Borrow Request window parameters
     * @param minSecs The number of seconds which must elapse between a request and the action
     * @param maxSecs The number of seconds until a request expires
     */
    function setBorrowRequestConfig(uint256 minSecs, uint256 maxSecs) external;
    
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
     *      (reducing the dUSD debt of the TlcStrategy)
     */
    function treasuryReservesVault() external view returns (ITreasuryReservesVault);

    /**
     * @notice The Strategy contract managing the TRV borrows and equity positions of TLC.
     */
    function tlcStrategy() external view returns (ITlcStrategy);

    /**
     * @notice Users/accounts must first request to remove collateral. 
     * The user must wait a period of time after the request before they can action the withdraw.
     * The request also has an expiry time.
     * If a request expires, a new request will need to be made or the actual withdraw will then revert.
     */
    function removeCollateralRequestConfig() external view returns (uint32 minSecs, uint32 maxSecs);

    /**
     * @notice A record of the total amount of collateral deposited by users/accounts.
     */
    function totalCollateral() external view returns (uint256);

    /**
     * @notice An view of an accounts current and up to date position as of this block
     * @param account The account to get a position for
     * @param includePendingRequests Whether to include any pending but not yet executed
     * requests for Collateral Withdraw or Borrow. 
     */
    function accountPosition(
        address account,
        bool includePendingRequests
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
     * @param includePendingRequests Whether to include any pending but not yet executed
     * requests for Collateral Withdraw or Borrow. 
     */
    function computeLiquidity(
        address[] calldata accounts,
        bool includePendingRequests
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
}
