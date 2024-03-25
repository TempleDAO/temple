pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/v2/strategies/ITlcStrategy.sol)

import { ITempleStrategy } from "contracts/interfaces/v2/strategies/ITempleStrategy.sol";

/**
 * @title Temple Line of Credit Strategy
 * @notice A simple wrapper strategy over TLC, where
 * the assets is the current total user debt.
 */
interface ITlcStrategy is ITempleStrategy {
    /**
     * @notice TLC (only) will call on this to fund user borrows of DAI
     */
    function fundFromTrv(uint256 amount, address recipient) external;
}
