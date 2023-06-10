pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/v2/tlc/ITlcStrategy.sol)

import { ITempleStrategy } from "contracts/interfaces/v2/strategies/ITempleStrategy.sol";

interface ITlcStrategy is ITempleStrategy {
    function fundFromTrv(uint256 amount, address recipient) external;
}
