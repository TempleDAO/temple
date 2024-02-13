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
        OfferPricingToken offerPricingToken;
        uint128 minValidOfferPrice;
        uint128 maxValidOfferPrice;
        uint256 scalar;
        uint256 offerPrice;
    }

    function addOtcMarket(
        OTCMarketInfo calldata _otcMarketInfo,
        uint128 _minValidOfferPrice,
        uint128 _maxValidOfferPrice,
        uint256 _offerPrice
    ) external;

    function removeOtcMarket(address userBuyToken, address userSellToken) external;
    function setMarketFundsOwner(address userBuyToken, address userSellToken, address _fundsOwner) external;
    function setOfferPrice(address userBuyToken, address userSellToken, uint256 _offerPrice) external;
    function setOfferPriceRange(address userBuyToken, address userSellToken, uint128 _minValidOfferPrice, uint128 _maxValidOfferPrice) external;
    function pause() external;
    function unpause() external;
    function swap(bytes32 marketId, uint256 sellTokenAmount) external returns (uint256);
    function swap(
        address userBuyToken,
        address userSellToken,
        uint256 sellTokenAmount
    ) external returns (uint256);
    function quote(bytes32 marketId, uint256 sellTokenAmount) external view returns (uint256);
    function userBuyTokenAvailable(address userBuyToken, address userSellToken) external view returns (uint256);
    function getOtcMarketIds() external view returns (bytes32[] memory);
    function tokenPairExists(address token0, address token1) external view returns (bool);
    function getMarketIdByTokens(address userBuyToken, address userSellToken) external view returns (bytes32);
    function getOtcMarketTokens(bytes32 marketId) external view returns (address[] memory);
}