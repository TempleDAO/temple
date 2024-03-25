pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/makerDao/IMakerDaoVatLike.sol)

interface IMakerDaoVatLike {
    function hope(address) external;
    function dai(address) external returns (uint256);
}
