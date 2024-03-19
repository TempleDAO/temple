pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later


interface IWeightPool2Tokens {
     function getNormalizedWeights() external view returns (uint256[] memory);
}