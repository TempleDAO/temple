pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/v2/templeLineOfCredit/ITlcStorage.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ITlcDataTypes } from "contracts/interfaces/v2/templeLineOfCredit/ITlcDataTypes.sol";
import { ITreasuryReservesVault } from "contracts/interfaces/v2/ITreasuryReservesVault.sol";
import { ITlcStrategy } from "contracts/interfaces/v2/templeLineOfCredit/ITlcStrategy.sol";

interface ITlcStorage is ITlcDataTypes {
    /**
     * @notice The collateral token supplied by users/accounts
     */
    function templeToken() external view returns (IERC20);
    
    /**
     * @notice DAI is one of the debt tokens which can be borrowed
     */
    function daiToken() external view returns (IERC20);
    
    /**
     * @notice Oud is one of the debt tokens which can be borrowed
     */
    function oudToken() external view returns (IERC20);

    /**
     * @notice The Strategy contract managing the TRV borrows and equity positions of TLC.
     */
    function tlcStrategy() external view returns (ITlcStrategy);

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
     * @notice Users/accounts must first request to remove collateral. 
     * The user must wait a period of time after the request before they can action the withdraw.
     * The request also has an expiry time.
     * If a request expires, a new request will need to be made or the actual withdraw will then revert.
     */
    function removeCollateralRequestWindow() external view returns (uint32 minSecs, uint32 maxSecs);

    /**
     * @notice A record of the total amount of collateral deposited by users/accounts.
     */
    function totalCollateral() external view returns (uint256);

    /**
     * @notice Configuration and latest data snapshot of the debt tokens
     */
    function debtTokenDetails(IERC20 token) external view returns (
        DebtTokenConfig memory config,
        DebtTokenData memory data
    );
}