pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/amo/helpers/IProtocolTokenVault.sol)

interface IRamosProtocolTokenVault {
    function borrowProtocolToken(uint256 amount, address recipient) external;

    function repayProtocolToken(uint256 amount) external;
}