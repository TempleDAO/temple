pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/v2/templeLineOfCredit/ITlcStorage.sol)

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ITlcDataTypes } from "contracts/interfaces/v2/templeLineOfCredit/ITlcDataTypes.sol";
import { ITreasuryReservesVault } from "contracts/interfaces/v2/ITreasuryReservesVault.sol";
import { ITlcStrategy } from "contracts/interfaces/v2/templeLineOfCredit/ITlcStrategy.sol";

interface ITlcStorage is ITlcDataTypes {
    function tlcStrategy() external view returns (ITlcStrategy);
    function templeToken() external view returns (IERC20);
    function daiToken() external view returns (IERC20);
    function oudToken() external view returns (IERC20);
    function treasuryReservesVault() external view returns (ITreasuryReservesVault);
    function fundsRequestWindow() external view returns (uint32 minSecs, uint32 maxSecs);

    function debtTokenDetails(IERC20 token) external view returns (
        DebtTokenConfig memory config,
        DebtTokenData memory data
    );
    
    function PRICE_PRECISION() external view returns (uint256);
    function LTV_PRECISION() external view returns (uint256);
}