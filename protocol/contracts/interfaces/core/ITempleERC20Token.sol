pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (protocol/contracts/interfaces/core/ITempleERC20Token.sol)

interface ITempleERC20Token {
    function mint(address to, uint256 amount) external;
    function burn(uint256 amount) external;
}