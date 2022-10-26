pragma solidity ^0.8.4;
// SPDX-License-Identifier: AGPL-3.0-or-later


import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IBalancerVault {
  struct JoinPoolRequest {
    IERC20[] assets;
    uint256[] maxAmountsIn;
    bytes userData;
    bool fromInternalBalance;
  }

  struct ExitPoolRequest {
    address[] assets;
    uint256[] minAmountsOut;
    bytes userData;
    bool toInternalBalance;
  }

  enum JoinKind { 
    INIT, 
    EXACT_TOKENS_IN_FOR_BPT_OUT, 
    TOKEN_IN_FOR_EXACT_BPT_OUT, 
    ALL_TOKENS_IN_FOR_EXACT_BPT_OUT 
  }

  function joinPool(
      bytes32 poolId,
      address sender,
      address recipient,
      JoinPoolRequest memory request
  ) external payable;

  function exitPool( 
    bytes32 poolId, 
    address sender, 
    address recipient, 
    ExitPoolRequest memory request 
  ) external;

  function getPoolTokens(
    bytes32 poolId
  ) external view
    returns (
      address[] memory tokens,
      uint256[] memory balances,
      uint256 lastChangeBlock
  );
}