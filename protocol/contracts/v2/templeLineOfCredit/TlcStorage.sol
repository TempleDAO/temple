pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/templeLineOfCredit/TlcStorage.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ITlcStorage } from "contracts/interfaces/v2/templeLineOfCredit/ITlcStorage.sol";
import { ITreasuryReservesVault } from "contracts/interfaces/v2/ITreasuryReservesVault.sol";
import { ITlcStrategy } from "contracts/interfaces/v2/templeLineOfCredit/ITlcStrategy.sol";

abstract contract TlcStorage is ITlcStorage {
    /**
     * @notice The collateral token supplied by users/accounts
     */
    IERC20 public immutable override templeToken;

    /**
     * @notice DAI token -- the debt token which can be borrowed
     */
    IERC20 public immutable override daiToken;

    /**
     * @notice The Treasury Reserve Vault (TRV) which funds the DAI borrows to users/accounts.
     * - When users borrow, the DAI is pulled from the TRV
     *      (via the TlcStrategy, increasing the dUSD debt)
     * - When users repay, the DAI is repaid to the TRV 
     *      (reducing the dUSD debt of the TlcStrategy)
     * - When there is a liquidation, the seized Temple collateral is paid to the TRV
     *      (reducing the dUSD debt of the TlcStrategy)
     */
    ITreasuryReservesVault public override treasuryReservesVault;

    /**
     * @notice The Strategy contract managing the TRV borrows and equity positions of TLC.
     */
    ITlcStrategy public override tlcStrategy;

    /**
     * @notice Users/accounts must first request to remove collateral. 
     * The user must wait a period of time after the request before they can action the withdraw.
     * The request also has an expiry time.
     * If a request expires, a new request will need to be made or the actual withdraw will then revert.
     */
    FundsRequestConfig public override removeCollateralRequestConfig;
    
    /**
     * @notice A record of the total amount of collateral deposited by users/accounts.
     */
    uint256 public override totalCollateral;

    /**
     * @notice A per user/account mapping to the data to track active collateral/debt positions.
     */
    mapping(address => AccountData) internal allAccountsData;

    /**
     * @notice Configuration and latest data snapshot of the debt tokens
     */
    DebtTokenConfig internal debtTokenConfig;
    DebtTokenData internal debtTokenData;

    /**
     * @notice An internal state tracking how interest has accumulated.
     */
    uint256 internal constant INITIAL_INTEREST_ACCUMULATOR = 1e27;

    /**
     * @notice The minimum borrow amount per transaction
     * @dev It costs gas to liquidate users, so we don't want dust amounts.
     */
    uint256 public constant MIN_BORROW_AMOUNT = 1000e18;
    
    constructor(address _templeToken, address _daiToken)
    {
        templeToken = IERC20(_templeToken);
        daiToken = IERC20(_daiToken);
    }

}