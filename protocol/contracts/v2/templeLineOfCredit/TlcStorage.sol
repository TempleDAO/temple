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
     * @notice Collateral Token supplied by accounts
     */
    ITreasuryReservesVault public override treasuryReservesVault;

    uint32 public override withdrawCollateralCooldownSecs;

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
    mapping(TokenType => DebtTokenDetails) public override debtTokenDetails;

    constructor(address _templeToken)
    {
        templeToken = IERC20(_templeToken);
    }

}