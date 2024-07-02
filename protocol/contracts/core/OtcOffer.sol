pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (core/OtcOffer.sol)

import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

/**
 * @title OTC Offer
 *
 * @notice Temple offers OTC purchases to users on certain tokens - slippage and price impact free.
 * Temple sets the offer price and users can swap tokens for any arbitrary size at this price, up to some
 * max amount of treasury funds (determined by the `fundsOwner` balance and ERC20 approvals).
 */
contract OtcOffer is Pausable, Ownable {
    using SafeERC20 for IERC20Metadata;

    /// @notice The token that the user will sell
    IERC20Metadata public immutable userSellToken;

    /// @notice The token that the user will buy
    IERC20Metadata public immutable userBuyToken;

    /// @notice Where to pull the `userBuyToken` from, and to send the `userSellToken`
    /// @dev The funds owner must grant approval for this contract to pull the `userBuyToken`
    address public fundsOwner;
    
    /// @notice The number of decimal places represented by `offerPrice`
    uint8 public constant OFFER_PRICE_DECIMALS = 18;

    /// @notice The offer price, specified in terms of `offerPricingToken`.
    uint256 public offerPrice;

    enum OfferPricingToken {
        /// @notice The offerPrice 'pricing' token is defined in terms of the `userBuyToken`
        /// ie price is userBuyToken / userSellToken
        /// eg when user sells OHM to buy DAI, the price is defined in terms of DAI/OHM
        UserBuyToken,

        /// @notice The offerPrice 'pricing' token is defined in terms of the `userBuyToken`
        /// ie price is userSellToken / userBuyToken
        /// eg when user sells DAI to buy OHM, the price can still be defined in terms of DAI/OHM
        UserSellToken
    }

    /// @notice Which token the `offerPrice` is defined in terms of.
    OfferPricingToken public immutable offerPricingToken;

    // @notice How to scale the fixed point buyTokenAmount given differences in token decimal places.
    uint256 public immutable scalar;

    // @notice The minimum valid offer price (in order to avoid an incorrectly set/fat fingered price being set)
    uint128 public minValidOfferPrice;

    // @notice The maximum valid offer price (in order to avoid an incorrectly set/fat fingered price being set)
    uint128 public maxValidOfferPrice;

    event OfferPriceSet(uint256 _offerPrice);
    event OfferPriceRangeSet(uint128 minValidOfferPrice, uint128 maxValidOfferPrice);
    event Swap(address indexed account, address indexed fundsOwner, uint256 userSellTokenAmount, uint256 userBuyTokenAmount);
    event FundsOwnerSet(address indexed fundsOwner);

    error OfferPriceNotValid();

    constructor(
        address _userSellToken,
        address _userBuyToken,
        address _fundsOwner,
        uint256 _offerPrice,
        OfferPricingToken _offerPricingToken,
        uint128 _minValidOfferPrice,
        uint128 _maxValidOfferPrice
    ) Ownable(msg.sender) {
        userSellToken = IERC20Metadata(_userSellToken);
        userBuyToken = IERC20Metadata(_userBuyToken);
        fundsOwner = _fundsOwner;

        offerPrice = _offerPrice;
        offerPricingToken = _offerPricingToken;
        minValidOfferPrice = _minValidOfferPrice;
        maxValidOfferPrice = _maxValidOfferPrice;

        // The price is always specified in 18dp
        // Eg If selling OHM (9dp) for USDC (6dp):
        // 1000 OHM (9dp) * 11 USDC/OHM (18dp) = 11_000 USDC (6dp)
        // So this would need to get scaled down by 30dp
        uint256 scaleDecimals = offerPricingToken == OfferPricingToken.UserBuyToken
            ? OFFER_PRICE_DECIMALS + userSellToken.decimals() - userBuyToken.decimals()
            : OFFER_PRICE_DECIMALS + userBuyToken.decimals() - userSellToken.decimals();
        scalar = 10 ** scaleDecimals;
    }

    /// @notice Owner can pause user swaps from occuring
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Owner can unpause so user swaps can occur
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Owner can update where the funds are pulled from and sent to upon a swap
    function setFundsOwner(address _fundsOwner) external onlyOwner {
        if (_fundsOwner == address(0)) revert CommonEventsAndErrors.InvalidAddress();
        fundsOwner = _fundsOwner;
        emit FundsOwnerSet(_fundsOwner);
    }

    /// @notice Owner can update the offer price at which user swaps can occur
    /// @dev The new price must be within the `minValidOfferPrice` <= price <= `maxValidOfferPrice` range
    function setOfferPrice(uint256 _offerPrice) external onlyOwner {
        if (_offerPrice < minValidOfferPrice || _offerPrice > maxValidOfferPrice) revert OfferPriceNotValid();
        offerPrice = _offerPrice;
        emit OfferPriceSet(_offerPrice);
    }

    /// @notice Owner can update the threshold for when updating the offer price
    function setOfferPriceRange(uint128 _minValidOfferPrice, uint128 _maxValidOfferPrice) external onlyOwner {
        if (_minValidOfferPrice > _maxValidOfferPrice) revert CommonEventsAndErrors.InvalidParam();
        minValidOfferPrice = _minValidOfferPrice;
        maxValidOfferPrice = _maxValidOfferPrice;
        emit OfferPriceRangeSet(_minValidOfferPrice, _maxValidOfferPrice);
    }

    /// @notice Swap `userSellToken` for `userBuyToken`, at the `offerPrice`
    function swap(uint256 sellTokenAmount) external whenNotPaused returns (uint256 buyTokenAmount) {
        if (sellTokenAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();

        buyTokenAmount = quote(sellTokenAmount);

        address _fundsOwner = fundsOwner;
        emit Swap(msg.sender, _fundsOwner, sellTokenAmount, buyTokenAmount);

        userSellToken.safeTransferFrom(msg.sender, _fundsOwner, sellTokenAmount);
        userBuyToken.safeTransferFrom(_fundsOwner, msg.sender, buyTokenAmount);
    }

    /// @notice How many `userBuyToken` you would receive given an amount of `sellTokenAmount`
    function quote(uint256 sellTokenAmount) public view returns (uint256 buyTokenAmount) {
        buyTokenAmount = offerPricingToken == OfferPricingToken.UserBuyToken
            ? sellTokenAmount * offerPrice / scalar
            : sellTokenAmount * scalar / offerPrice;
    }

    /**
     * @notice The available funds for a user swap is goverend by the amount of `userBuyToken` that
     * the `fundsOwner` has available.
     * @dev The minimum of the `fundsOwner` balance of `userBuyToken`, and the spending 
     * approval from `fundsOwner` to this OtcOffer contract.
     */
    function userBuyTokenAvailable() external view returns (uint256) {
        address _fundsOwner = fundsOwner;
        uint256 _balance = userBuyToken.balanceOf(_fundsOwner);
        uint256 _allowance = userBuyToken.allowance(_fundsOwner, address(this));
        return _balance < _allowance
            ? _balance
            : _allowance;
    }
}
