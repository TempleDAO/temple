pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later


interface AMO__IBalancerAuthorizer {
    function grantRole(bytes32 role, address account) external;
    function grantRoles(bytes32[] memory roles, address account) external;
    function grantRolesToMany(bytes32[] memory roles, address[] memory accounts) external;
    function revokeRoles(bytes32[] memory roles, address account) external;
    function revokeRolesFromMany(bytes32[] memory roles, address[] memory accounts) external;
    function canPerform(
        bytes32 actionId,
        address account,
        address
    ) external view returns (bool);
}