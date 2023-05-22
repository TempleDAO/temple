pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/v2/templeLineOfCredit/ITempleLineOfCredit.sol)

import { ITlcDataTypes } from "contracts/interfaces/v2/templeLineOfCredit/ITlcDataTypes.sol";

interface ITempleLineOfCredit is ITlcDataTypes {
    error InsufficentCollateral(uint256 maxCapacity, uint256 borrowAmount);
    error ExceededBorrowedAmount(uint256 totalDebtAmount, uint256 repayAmount);

    event PostCollateral(address indexed fundedBy, address indexed onBehalfOf, uint256 collateralAmount);
    event Borrow(address indexed account, address indexed recipient, address indexed token, uint256 amount);
    event Repay(address indexed fundedBy, address indexed onBehalfOf, address indexed token, uint256 repayAmount);

    // @todo add all functions, then add override in TempleLineOfCredit
}
