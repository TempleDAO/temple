pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Oud Redeemer (protocol/contracts/oud/OudRedeemer.sol)

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '../interfaces/oud/IOudRedeemer.sol';
import '../interfaces/templeLineOfCredit/ITempleLineOfCredit.sol';
import '../interfaces/oud/IOudtoken.sol';
import '../interfaces/oud/ITempleERC20Token.sol';

/**
 * @title Allows for the redemption of Oud + a stable coin for Temple at the Temple Treasury Price index
 */
contract OudRedeemer is IOudRedeemer, Ownable {
  using SafeERC20 for IERC20;
  error AddressZero();
  error RedeemAmountZero();

  // @notice Temple token address
  address public immutable templeToken;

  // @notice Oud token address
  address public immutable oudToken;

  // @notice Stable token address
  IERC20 public stable;

  //   @notice The Temple Price Index, used to calculate amount of 'stable' required to mint Temple
  uint256 public tpi;

  // @notice The decimal precision of 'tpi'/Temple Price index
  uint256 public constant tpiDecimals = 4;

  // Target address for 'stable' token used for redemption of Oud + stable for Temple
  address public depositStableTo;

  // @dev requires this contract to have minting rights for both Temple and Oud
  constructor(
    address _oudToken,
    address _templeToken,
    address _stable,
    address _depositStableTo,
    uint256 _tpi
  ) {
    templeToken = _templeToken;
    oudToken = _oudToken;
    stable = IERC20(_stable);
    depositStableTo = _depositStableTo;
    tpi = _tpi;
  }

  //  @notice Returns the index at which 'stable' token is required to mint Temple
  function treasuryPriceIndex() external view returns (uint256) {
    return tpi;
  }

  // @dev Allows the tpi to be adjusted.
  // @param 'value' is the new TPI
  function setTreasuryPriceIndex(uint256 value) external override onlyOwner {
    tpi = value;
  }

  function setStableCoin(address newStable) external override onlyOwner {
    if (newStable == address(0)) revert AddressZero();
    stable = IERC20(newStable);
  }

  // @dev Decimal precision for 'tpi', 9880 == $0.988, precision = 4
  function TPI_PRECISION() external pure returns (uint256) {
    return tpiDecimals;
  }

  /**
   * @notice Provides a quote for 'oudAmount' with relevant token addresses:
   *  'oudAmount' provided, 'stable' token required, 'templeAmount' that will be minted to caller
   * @param oudAmount amount of Oud that will be redeemed
   * @return _stableAmount amount of Stable token required at tpi
   * @return _templeAmount amount of Temple that will be minted
   */
  function getQuote(
    uint256 oudAmount
  ) external view returns (uint256 _stableAmount, uint256 _templeAmount) {
    return (_getStableAmount(oudAmount), oudAmount);
  }

  // @notice Redeems Oud and Stable token (@ tpi) for Temple
  // @dev requires allowances for Oud and Stable Token
  // @param 'oudAmount' The amount of Oud to be redeemed for Temple
  // @returns 'templeAmount' The amount of Temple that has been minted to sender.
  function redeem(uint256 oudAmount) external returns (uint256 templeAmount) {
    if (oudAmount == 0) revert RedeemAmountZero();
    address account = msg.sender;
    uint256 _stableAmount;
    _stableAmount = _getStableAmount(oudAmount);
    IOudToken(oudToken).burn(account, oudAmount);
    SafeERC20.safeTransferFrom(stable, account, address(this), _stableAmount);
    SafeERC20.safeIncreaseAllowance(stable, depositStableTo, _stableAmount);
    ITempleLineOfCredit(depositStableTo).depositReserve(
      stable,
      address(this),
      _stableAmount
    );

    // @dev Conversion is 1 OUD + (Stable*TPI) = 1 Temple thus Temple Amount == Oud Amount.
    Oud__ITempleERC20Token(templeToken).mint(account, oudAmount);
    emit OudRedeemed(account, oudAmount, tpi, oudAmount);
    return oudAmount;
  }

  function _getStableAmount(
    uint256 oudAmount
  ) internal view returns (uint256 stableAmount) {
    return (oudAmount * tpi) / (10 ** tpiDecimals);
  }

  event OudRedeemed(
    address account,
    uint256 OudRedeemed,
    uint256 tpi,
    uint256 templeAmount
  );
}
