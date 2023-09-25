pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (core/OtcOffer.sol)

import { Pausable } from "@openzeppelin/contracts/security/Pausable.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

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

    /// @notice The offer price, in terms of `userBuyToken/userSellToken` - eg 11 DAI/OHM when user selling OHM => DAI
    /// @dev offerPrice is always specified in 1e18 precision
    uint256 public offerPrice;

    // @notice How to scale when calculating the `buyTokenAmount == sellTokenAmount * offerPrice / scalar`
    uint256 public immutable scalar;

    /// @notice Any update to the `offerPrice` must be within this percentage (as basis points. 20% = 2_000) 
    /// of the existing `offerPrice`.
    uint256 public offerPriceUpdateThresholdBps;

    /// @notice 100% represented as basis points.
    uint256 public constant BPS_100_PCT = 10_000;

    event OfferPriceSet(uint256 _offerPrice);
    event OfferPriceUpdateThresholdBpsSet(uint256 offerPriceUpdateThresholdBps);
    event Swap(address indexed account, address indexed fundsOwner, uint256 userSellTokenAmount, uint256 userBuyTokenAmount);
    event FundsOwnerSet(address indexed fundsOwner);

    error OfferPriceDeltaTooBig(uint256 newOfferPrice, uint256 maxPriceAllowed);

    constructor(
        address _userSellToken,
        address _userBuyToken,
        address _fundsOwner,
        uint256 _offerPrice,
        uint256 _offerPriceUpdateThresholdBps
    ) {
        userSellToken = IERC20Metadata(_userSellToken);
        userBuyToken = IERC20Metadata(_userBuyToken);
        fundsOwner = _fundsOwner;

        offerPrice = _offerPrice;
        offerPriceUpdateThresholdBps = _offerPriceUpdateThresholdBps;

        // The price is always specified in 18dp
        // Eg If selling OHM (9dp) for USDC (6dp):
        // 1000 OHM (9dp) * 11 USDC/OHM (18dp) = 11_000 USDC (6dp)
        // So this would need to get scaled down by 30dp
        uint256 scaleDownDecimals = OFFER_PRICE_DECIMALS + userSellToken.decimals() - userBuyToken.decimals();
        scalar = 10 ** scaleDownDecimals;
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
    /// @dev The new price must be within the `offerPriceUpdateThresholdBps` threshold of
    /// the existing price
    function setOfferPrice(uint256 _offerPrice) external onlyOwner {
        if (_offerPrice == 0) revert CommonEventsAndErrors.ExpectedNonZero();

        uint256 existingOfferPrice = offerPrice;
        uint256 absMaxDelta = existingOfferPrice * offerPriceUpdateThresholdBps / BPS_100_PCT;
        if (_offerPrice > existingOfferPrice) {
            uint256 maxValid = existingOfferPrice + absMaxDelta;
            if (_offerPrice > maxValid) revert OfferPriceDeltaTooBig(_offerPrice, maxValid);
        } else {
            uint256 minValid = existingOfferPrice > absMaxDelta
                ? existingOfferPrice - absMaxDelta
                : 0;
            if (_offerPrice < minValid) revert OfferPriceDeltaTooBig(_offerPrice, minValid);
        }

        offerPrice = _offerPrice;
        emit OfferPriceSet(_offerPrice);
    }

    /// @notice Owner can update the threshold for when updating the offer price
    function setOfferPriceUpdateThresholdBps(uint256 _offerPriceUpdateThresholdBps) external onlyOwner {
        offerPriceUpdateThresholdBps = _offerPriceUpdateThresholdBps;
        emit OfferPriceUpdateThresholdBpsSet(_offerPriceUpdateThresholdBps);
    }

    /// @notice Swap `userSellToken` for `userBuyToken`, at the `offerPrice`
    function swap(uint256 sellTokenAmount) external whenNotPaused returns (uint256 buyTokenAmount) {
        if (sellTokenAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();

        // eg 1000 OHM * 11.4 DAI/OHM == 11_400 DAI
        buyTokenAmount = sellTokenAmount * offerPrice / scalar;

        address _fundsOwner = fundsOwner;
        emit Swap(msg.sender, _fundsOwner, sellTokenAmount, buyTokenAmount);

        userSellToken.safeTransferFrom(msg.sender, _fundsOwner, sellTokenAmount);
        userBuyToken.safeTransferFrom(_fundsOwner, msg.sender, buyTokenAmount);
    }
}
