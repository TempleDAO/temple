pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later


interface AMO__Goerli_ILiquidityGaugeFactory {
    function isGaugeFromFactory(address gauge) external view returns (bool);
    function create(address pool) external returns (address);
}