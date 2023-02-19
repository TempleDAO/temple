pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Oud (protocol/contracts/interfaces/oud/IOudtoken.sol)

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {IERC20Permit} from '@openzeppelin/contracts/token/ERC20/extensions/draft-IERC20Permit.sol';


/**
 * @title Allows for the redemption of Oud + a stable coin for Temple at the Temple Treasury Price index
 */
interface IOudRedeemer {
  //  @notice Returns the index at which 'stable' token is required to mint Temple
  function treasuryPriceIndex() external view returns (uint256);

  // @dev Decimal precision for 'tpi', 9880 == $0.988, precision = 4
  function TPI_PRECISION() external pure returns (uint256);

  // @dev Allows the tpi to be adjusted.
  // @param 'value' is the new TPI
  function setTreasuryPriceIndex(uint256 value) external;

  function setStableCoin(address newStable) external;

  // @notice Redeems Oud and Stable token (@ tpi) for Temple
  // @dev requires allowances for Oud and Stable Token
  // @param 'oudAmount' The amount of Oud to be redeemed for Temple
  // @returns 'templeAmount' The amount of Temple that has been minted to sender.
  function redeem(uint256 oudAmount) external returns (uint256 templeAmount);
}
