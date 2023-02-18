pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Oud (protocol/contracts/interfaces/oud/IOudtoken.sol)

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {IERC20Permit} from '@openzeppelin/contracts/token/ERC20/extensions/draft-IERC20Permit.sol';

/// @notice An ERC20 token which can be minted/burnt by approved accounts
interface IOudRedeemer {

  function treasuryPriceIndex() external view returns (uint256);

  function TPI_PRECISION() external pure returns (uint256); // 9880 == $0.988, precision = 4

  function setTreasuryPriceIndex(uint256 value) external;
    
  function setStableCoin(address newStable) external;

  function redeem(uint256 oudAmount) external returns (uint256 templeAmount);
}
