pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (v2/templeLineOfCredit/TlcStorage.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ITlcStorage } from "contracts/interfaces/v2/templeLineOfCredit/ITlcStorage.sol";
import { ITreasuryReservesVault } from "contracts/interfaces/v2/ITreasuryReservesVault.sol";
import { ITlcStrategy } from "contracts/interfaces/v2/templeLineOfCredit/ITlcStrategy.sol";

abstract contract TlcStorage is ITlcStorage {
    ITlcStrategy public override tlcStrategy;

    /**
     * @notice Collateral Token supplied by accounts
     */
    IERC20 public immutable override templeToken;

    /**
     * @notice DAI token 
     */
    IERC20 public immutable override daiToken;

    /**
     * @notice OUD token
     */
    IERC20 public immutable override oudToken;

    /**
     * @notice Collateral Token supplied by accounts
     */
    ITreasuryReservesVault public override treasuryReservesVault;

    /**
     * @notice When either a withdraw collateral or borrow request is made,
     * the account has a window in which they can action the request.
     * If a request expires, a new request will need to be made or the action will revert.
     */
    FundsRequestWindow public override fundsRequestWindow;

    // @todo check constants
    uint256 internal constant INITIAL_INTEREST_ACCUMULATOR = 1e27;
    uint256 public override constant PRICE_PRECISION = 1e18;
    uint256 public override constant LTV_PRECISION = 1e18;

    /**
     * @notice Account collateral and current token debt information
     */
    mapping(address => AccountData) internal allAccountsData;

    /**
     * @notice Configuration and current data for borrowed tokens
     */
    mapping(IERC20 => DebtTokenDetails) public override debtTokenDetails;

    constructor(address _templeToken, address _daiToken, address _oudToken)
    {
        templeToken = IERC20(_templeToken);
        daiToken = IERC20(_daiToken);
        oudToken = IERC20(_oudToken);
    }

}