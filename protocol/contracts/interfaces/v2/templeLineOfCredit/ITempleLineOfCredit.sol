pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/v2/templeLineOfCredit/ITempleLineOfCredit.sol)

import { ITlcStorage } from "contracts/interfaces/v2/templeLineOfCredit/ITlcStorage.sol";
import { ITlcEventsAndErrors } from "contracts/interfaces/v2/templeLineOfCredit/ITlcEventsAndErrors.sol";

interface ITempleLineOfCredit is ITlcStorage, ITlcEventsAndErrors {
    /** Add Collateral */
    function addCollateral(uint256 collateralAmount, address onBehalfOf) external;

    /** Remove Collateral (requires a request with cooldown first) */
    function requestRemoveCollateral(uint256 amount) external;
    function cancelRemoveCollateralRequest(address account) external;
    function removeCollateral(address recipient) external;

    /** Borrow (requires a request with cooldown first) */
    function requestBorrow(TokenType tokenType, uint256 amount) external;
    function cancelBorrowRequest(address account, TokenType tokenType) external;
    function borrow(TokenType tokenType, address recipient) external;

    /** Repay */
    function repay(TokenType tokenType, uint256 repayAmount, address onBehalfOf) external;
    function repayAll(TokenType tokenType, address onBehalfOf) external;

    /** Position views */
    function accountPosition(address account) external view returns (AccountPosition memory position);
    function totalPosition() external view returns (
        TotalPosition memory daiPosition,
        TotalPosition memory oudPosition
    );

    /** Liquidations */
    function computeLiquidity(
        address[] memory accounts,
        bool includePendingRequests
    ) external view returns (LiquidityStatus[] memory status);
    function batchLiquidate(address[] memory accounts) external;

    // Manually checkpoint debt to adjust interest rate based on latest utillization ratio
    function refreshInterestRates(TokenType tokenType) external;

    /** EXECUTORS/RESCUERS ONLY */
    function setTlcStrategy(address _tlcStrategy) external;
    function setWithdrawCollateralCooldownSecs(uint256 cooldownSecs) external;
    function setBorrowCooldownSecs(TokenType tokenType, uint256 cooldownSecs) external;
    function setInterestRateModel(TokenType tokenType, address interestRateModel) external;
    function setMaxLtvRatio(TokenType tokenType, uint256 maxLtvRatio) external;
    function recoverToken(address token, address to, uint256 amount) external;
}
