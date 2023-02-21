pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (protocol/contracts/interfaces/oud/IOudRedeemer.sol)

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

/**
 * @title Allows for the redemption of Oud + a stable coin for Temple at the Temple Treasury Price index
 */
interface IOudRedeemer {

  /// @notice Temple token address
  function templeToken() external returns (address);

  /// @notice Oud token address
  function oudToken() external returns (address);

  /// @notice Stable token address
  function stable() external returns (IERC20);

  /// @notice The Treasury Price Index, used to calculate amount of 'stable' required to mint Temple
  function treasuryPriceIndex() external returns (uint256);

  /// @notice The decimal precision of 'tpi'/Temple Price index
  /// @dev Decimal precision for 'tpi', 9880 == $0.988, precision = 4
  function TPI_DECIMALS() external returns (uint256);

  /// Upon redemption, stable tokens are deposited here
  function depositStableTo() external returns (address);

  /// @dev Allows the tpi to be adjusted.
  /// @param value is the new TPI
  function setTreasuryPriceIndex(uint256 value) external;

  /// @dev set address of stable coin used for minting Temple 
  /// @param newStable updated address fo 'stable', cannot be 0
  function setStableCoin(address newStable) external;

  /**
    * @notice Provides a quote for how much stable is required from the user and 
    * how much temple will be minted to the user, given an `oudAmount`
    * @param oudAmount The amount of Oud that will be redeemed
    * @return _stableAmount The amount of Stable token required from the user
    * @return _templeAmount The amount of Temple that will be minted to the user
    */
  function redeemQuote(
    uint256 oudAmount
  )
    external
    view
    returns (
      uint256 _stableAmount,
      uint256 _templeAmount
    );

  /**
    * @notice Redeems Oud and Stable token (@ tpi) for Temple
    * @dev requires allowances for Oud and Stable Token
    * @param oudAmount The amount of Oud to be redeemed for Temple
    * @return stableAmount The amount of Stable token required from the user
    * @return templeAmount The amount of Temple that has been minted to sender.
    */ 
  function redeem(uint256 oudAmount) external returns (uint256 stableAmount, uint256 templeAmount);
}
