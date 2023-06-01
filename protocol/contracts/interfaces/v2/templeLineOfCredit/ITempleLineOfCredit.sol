pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/v2/templeLineOfCredit/ITempleLineOfCredit.sol)

import { ITlcStorage } from "contracts/interfaces/v2/templeLineOfCredit/ITlcStorage.sol";
import { ITlcEventsAndErrors } from "contracts/interfaces/v2/templeLineOfCredit/ITlcEventsAndErrors.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ITempleLineOfCredit is ITlcStorage, ITlcEventsAndErrors {
    /** Add Collateral */
    function addCollateral(uint256 collateralAmount, address onBehalfOf) external;

    /** Remove Collateral (requires a request with cooldown first) */
    function requestRemoveCollateral(uint256 amount) external;
    function cancelRemoveCollateralRequest(address account) external;
    function removeCollateral(address recipient) external;

    /** Borrow (requires a request with cooldown first) */
    function requestBorrow(IERC20 token, uint256 amount) external;
    function cancelBorrowRequest(address account, IERC20 token) external;
    function borrow(IERC20 token, address recipient) external;

    /** Repay */
    function repay(IERC20 token, uint256 repayAmount, address onBehalfOf) external;
    function repayAll(IERC20 token, address onBehalfOf) external;

    /** Position views */
    function accountData(
        address account
    ) external view returns (
        uint256 collateralPosted,
        WithdrawFundsRequest memory removeCollateralRequest,
        AccountDebtData memory _daiDebtData,
        AccountDebtData memory _oudDebtData
    );

    function accountPosition(
        address account,
        bool includePendingRequests
    ) external view returns (
        AccountPosition memory position
    );

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
    function refreshInterestRates(IERC20 token) external;

    /** EXECUTORS/RESCUERS ONLY */
    function setTlcStrategy(address _tlcStrategy) external;
    function setFundsRequestWindow(uint256 minSecs, uint256 maxSecs) external;
    function setInterestRateModel(IERC20 token, address interestRateModel) external;
    function setMaxLtvRatio(IERC20 token, uint256 maxLtvRatio) external;
    function recoverToken(address token, address to, uint256 amount) external;
}
