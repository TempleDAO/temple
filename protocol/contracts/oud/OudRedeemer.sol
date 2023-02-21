pragma solidity ^0.8.17;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (protocol/contracts/oud/OudRedeemer.sol)

import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';
import {SafeERC20, IERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {IOudRedeemer} from '../interfaces/oud/IOudRedeemer.sol';
import {ITempleLineOfCredit} from '../interfaces/templeLineOfCredit/ITempleLineOfCredit.sol';
import {IOudToken} from '../interfaces/oud/IOudToken.sol';
import {ITempleERC20Token} from '../interfaces/core/ITempleERC20Token.sol';

/**
 * @title Allows for the redemption of Oud + a stable coin for Temple at the Temple Treasury Price index
 */
contract OudRedeemer is IOudRedeemer, Ownable {
  using SafeERC20 for IERC20;

  /// @notice Temple token address
  address public immutable override templeToken;

  /// @notice Oud token address
  address public immutable override oudToken;

  /// @notice Stable token address
  IERC20 public override stable;

  /// @notice The Treasury Price Index, used to calculate amount of 'stable' required to mint Temple
  uint256 public override treasuryPriceIndex;

  /// @notice The decimal precision of 'tpi'/Temple Price index
  /// @dev Decimal precision for 'tpi', 9880 == $0.988, precision = 4
  uint256 public constant override TPI_DECIMALS = 4;

  /// Upon redemption, stable tokens are deposited here
  address public override depositStableTo;

  event TreasuryPriceIndexSet(uint256 oldTPI, uint256 newTPI);
  event StableCoinSet(address oldStable, address newStable);
  event OudRedeemed(
    address account,
    uint256 oudRedeemed,
    uint256 staleRedeemed,
    uint256 tpi,
    uint256 templeAmount
  );
  event TokenRecovered(address token, address to, uint256 amount);

  error AddressZero();
  error RedeemAmountZero();

  /// @dev requires this contract to have minting rights for both Temple and Oud
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
    treasuryPriceIndex = _tpi;
  }

  /// @dev Allows the tpi to be adjusted.
  /// @param value is the new TPI
  function setTreasuryPriceIndex(uint256 value) external override onlyOwner {
    emit TreasuryPriceIndexSet(treasuryPriceIndex, value);
    treasuryPriceIndex = value;
  }

  /// @dev set address of stable coin used for minting Temple 
  /// @param newStable updated address fo 'stable', cannot be 0
  function setStableCoin(address newStable) external override onlyOwner {
    if (newStable == address(0)) revert AddressZero();
    emit StableCoinSet(address(stable), newStable);
    stable = IERC20(newStable);
  }

  /**
    * @notice Provides a quote for how much stable is required from the user and 
    * how much temple will be minted to the user, given an `oudAmount`
    * @param oudAmount The amount of Oud that will be redeemed
    * @return _stableAmount The amount of Stable token required from the user
    * @return _templeAmount The amount of Temple that will be minted to the user
    */
  function quoteForRedeem(
    uint256 oudAmount
  ) external override view returns (uint256 _stableAmount, uint256 _templeAmount) {
    _stableAmount = _getStableAmount(oudAmount, treasuryPriceIndex);
    _templeAmount = oudAmount;
  }

  /**
    * @notice Redeems Oud and Stable token (@ tpi) for Temple
    * @dev requires allowances for Oud and Stable Token
    * @param oudAmount The amount of Oud to be redeemed for Temple
    * @return stableAmount The amount of Stable token required from the user
    * @return templeAmount The amount of Temple that has been minted to sender.
    */ 
  function redeem(uint256 oudAmount) external override returns (uint256 stableAmount, uint256 templeAmount) {
    if (oudAmount == 0) revert RedeemAmountZero();
    uint256 _tpi = treasuryPriceIndex;
    address _depositStableTo = depositStableTo;
    IERC20 _stable = stable;
    stableAmount = _getStableAmount(oudAmount, _tpi);

    // Burn the user's $Oud
    IOudToken(oudToken).burn(msg.sender, oudAmount);

    // Pull the user's $Stable and deposit into TLC
    _stable.safeTransferFrom(msg.sender, address(this), stableAmount);
    _stable.safeIncreaseAllowance(_depositStableTo, stableAmount);
    ITempleLineOfCredit(_depositStableTo).depositReserve(
      _stable,
      address(this),
      stableAmount
    );

    // Mint the user $Temple
    // Conversion is 1 OUD + (Stable*TPI) = 1 Temple thus Temple Amount == Oud Amount.
    templeAmount = oudAmount;
    ITempleERC20Token(templeToken).mint(msg.sender, templeAmount);
    emit OudRedeemed(msg.sender, oudAmount, stableAmount, _tpi, templeAmount);
  }

  function _getStableAmount(
    uint256 oudAmount,
    uint256 tpi
  ) internal pure returns (uint256 stableAmount) {
    return (oudAmount * tpi) / (10 ** TPI_DECIMALS);
  }

  /// @notice Owner can recover tokens
  function recoverToken(
    address _token,
    address _to,
    uint256 _amount
  ) external onlyOwner {
    emit TokenRecovered(_token, _to, _amount);
    IERC20(_token).safeTransfer(_to, _amount);
  }
}
