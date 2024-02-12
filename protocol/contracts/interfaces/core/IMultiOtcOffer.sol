pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/IMultiOtcOffer.sol)

import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
interface IMultiOtcOffer {

    enum OfferPricingToken {
        UserBuyToken,
        UserSellToken
    }

    struct OTCMarketInfo {
        address fundsOwner;
        IERC20Metadata userBuyToken;
        IERC20Metadata userSellToken;
    }

    struct OTCMarketPriceParams {
        uint128 minValidOfferPrice;
        uint128 maxValidOfferPrice;
        uint256 scalar;
        uint256 offerPrice;
        OfferPricingToken offerPricingToken;
    }

    function addOtcMarket(
        OTCMarketInfo calldata _otcMarketInfo,
        uint128 _minValidOfferPrice,
        uint128 _maxValidOfferPrice,
        uint256 _offerPrice
    ) external virtual;

    function removeOtcMarket(bytes32 _marketId) external;
    function setMarketFundsOwner(bytes32 _marketId, address _fundsOwner) external;
    function setOfferPrice(bytes32 _marketId, uint256 _offerPrice) external virtual;
    function setOfferPriceRange(bytes32 _marketId, uint128 _minValidOfferPrice, uint128 _maxValidOfferPrice) external;
    function pause() external;
    function unpause() external;
    function swap(bytes32 marketId, uint256 sellTokenAmount) external returns (uint256);
    function quote(bytes32 marketId, uint256 sellTokenAmount) external view returns (uint256);
    function userBuyTokenAvailable(bytes32 _marketId) external view returns (uint256);
    function getOtcMarketIds() external view returns (bytes32[] memory);
    function tokenPairExists(address token0, address token1) external view returns (bool);
}