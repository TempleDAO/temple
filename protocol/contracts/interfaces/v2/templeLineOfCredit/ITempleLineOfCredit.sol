pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/v2/templeLineOfCredit/ITempleLineOfCredit.sol)

import { ITlcStorage } from "contracts/interfaces/v2/templeLineOfCredit/ITlcStorage.sol";
import { ITlcEventsAndErrors } from "contracts/interfaces/v2/templeLineOfCredit/ITlcEventsAndErrors.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ITempleLineOfCredit is ITlcStorage, ITlcEventsAndErrors {
    /**
     * @notice Deposit Temple as collateral
     * @param collateralAmount The amount to deposit
     * @param onBehalfOf An account can add collateral on behalf of another address.
     */
    function addCollateral(uint256 collateralAmount, address onBehalfOf) external;

    /**
     * @notice An account requests to remove Temple collateral.
     * @dev After this request is issued, the account must then execute the `removeCollateral()`
     * within the `removeCollateralRequestWindow`
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
     * @notice An account requests to borrow either Dai or Oud
     * @dev After this request is issued, the account must then execute the `borrow()`
     * within the `borrowRequestWindow`
     * Subsequent requests override previous requests.
     * @param token The token to borrow - either Dai or Oud
     * @param amount The amount to borrow
     */
    function requestBorrow(IERC20 token, uint256 amount) external;
    
    /**
     * @notice An account (or elevated access) cancels an existing Borrow request
     * @param account The account to cancel the request for.
     * @param token The token to cancel the request for.
     */
    function cancelBorrowRequest(address account, IERC20 token) external;
    
    /**
     * @notice Execute the borrow request, within the window of the prior issued request
     * @param token The token to borrow
     * @param recipient Send the borrowed token to a specified recipient address.
     */
    function borrow(IERC20 token, address recipient) external;

    /**
     * @notice An account repays some of its DAI or OUD debt
     * @param token The debt token to repay
     * @param repayAmount The amount to repay. Cannot be more than the current debt.
     * @param onBehalfOf Another address can repay the debt on behalf of someone else
     */
    function repay(IERC20 token, uint256 repayAmount, address onBehalfOf) external;
    
    /**
     * @notice An account repays all of its DAI or OUD debt
     * @dev The amount of debt is calculated as of this block.
     * @param token The debt token to repay
     * @param onBehalfOf Another address can repay the debt on behalf of someone else
     */
    function repayAll(IERC20 token, address onBehalfOf) external;

    /**
     * @notice Liquidate one or more accounts which have exceeded the 
     * maximum allowed LTV.
     * The Temple collateral is seized, and the accounts debt wiped.
     * @dev If one of the accounts in the batch hasn't exceeded the max LTV
     * then no action is performed for that account.
     */
    function batchLiquidate(
        address[] memory accounts
    ) external returns (
        uint256 totalCollateralClaimed,
        uint128 totalDaiDebtWiped,
        uint128 totalOudDebtWiped
    );

    /**
     * @notice Update the TLC Strategy contract, and Treasury Reserves Vault (TRV)
     * @dev The TRV is granted access to spend DAI, in order to repay debt.
     */
    function setTlcStrategy(address _tlcStrategy) external;
    
    /**
     * @notice Set the Withdrawal Collateral Request Window parameters
     * @param minSecs The number of seconds which must elapse between a request and the action
     * @param maxSecs The number of seconds until a request expires
     */
    function setWithdrawCollateralRequestWindow(uint256 minSecs, uint256 maxSecs) external;
    
    /**
     * @notice Set the Borrow Request Window parameters
     * @param minSecs The number of seconds which must elapse between a request and the action
     * @param maxSecs The number of seconds until a request expires
     */
    function setBorrowRequestWindow(IERC20 token, uint256 minSecs, uint256 maxSecs) external;
    
    /**
     * @notice Update the interest rate model for either DAI or OUD
     * @param token The token to update the model for
     * @param interestRateModel The contract address of the new model
     */
    function setInterestRateModel(IERC20 token, address interestRateModel) external;
    
    /**
     * @notice Set the maximum Loan To Value Ratio for either DAI or OUD
     * @param token The token to update the max LTV for
     * @param maxLtvRatio The max LTV ratio (18 decimal places)
     */
    function setMaxLtvRatio(IERC20 token, uint256 maxLtvRatio) external;
    
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
     * @notice Get the current total debt positions for both DAI and OUD
     * as of this block.
     */
    function totalDebtPosition() external view returns (
        TotalDebtPosition memory daiPosition,
        TotalDebtPosition memory oudPosition
    );

    /**
     * @notice Compute the liquidity status for a set of accounts.
     * @dev This can be used to verify if accounts can be liquidated or not.
     * @param accounts The accounts to get the status for.
     * @param includePendingRequests Whether to include any pending but not yet executed
     * requests for Collateral Withdraw or Borrow. 
     */
    function computeLiquidity(
        address[] memory accounts,
        bool includePendingRequests
    ) external view returns (LiquidationStatus[] memory status);

    /**
     * @notice A view of the last checkpoint of account data (not as of this block)
     */
    function accountData(
        address account
    ) external view returns (
        uint256 collateralPosted,
        WithdrawFundsRequest memory removeCollateralRequest,
        AccountDebtData memory _daiDebtData,
        AccountDebtData memory _oudDebtData
    );
    

}
