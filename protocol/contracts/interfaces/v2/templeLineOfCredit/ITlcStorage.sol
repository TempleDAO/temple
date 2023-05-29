pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/v2/templeLineOfCredit/ITlcStorage.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ITlcDataTypes } from "contracts/interfaces/v2/templeLineOfCredit/ITlcDataTypes.sol";
import { ITreasuryReservesVault } from "contracts/interfaces/v2/ITreasuryReservesVault.sol";
import { ITlcStrategy } from "contracts/interfaces/v2/templeLineOfCredit/ITlcStrategy.sol";

interface ITlcStorage is ITlcDataTypes {
    function tlcStrategy() external returns (ITlcStrategy);
    function templeToken() external returns (IERC20);
    function treasuryReservesVault() external returns (ITreasuryReservesVault);
    function withdrawCollateralCooldownSecs() external returns (uint32);

    function accountData(address account) external returns (
        AccountData memory accountData
    );

    function debtTokenDetails(TokenType tokenType) external returns (
        DebtTokenConfig memory config,
        DebtTokenData memory data
    );
    
    function PRICE_PRECISION() external returns (uint256);
    function LTV_PRECISION() external returns (uint256);
}