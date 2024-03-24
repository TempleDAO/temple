pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later


interface AMO__IBalancerAuthorizerAdapter {
    function getActionId(bytes4 selector) external view returns (bytes32);
    function performAction(address target, bytes calldata data) external payable returns (bytes memory);
    function getAuthorizer() external view returns (address);
    function getVault() external view returns (address);
}