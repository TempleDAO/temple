pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later


interface AMO__IGaugeAdder {
    function addEthereumGauge(address gauge) external;
}