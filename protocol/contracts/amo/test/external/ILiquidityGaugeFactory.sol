pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later


interface AMO__ILiquidityGaugeFactory {
    function create(address pool, uint256 relativeWeightCap) external returns (address);
}