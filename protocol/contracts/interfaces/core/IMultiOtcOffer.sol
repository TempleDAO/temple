pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/core/IMultiOtcOffer.sol)

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

    struct MarketTokens {
        address userBuyToken;
        address userSellToken;
    }

    event OfferPriceSet(bytes32 marketId, uint256 _offerPrice);
    event OfferPriceRangeSet(bytes32 marketId, uint128 minValidOfferPrice, uint128 maxValidOfferPrice);
    event Swap(address indexed account, address indexed fundsOwner, bytes32 marketId, uint256 userSellTokenAmount, uint256 userBuyTokenAmount);
    event FundsOwnerSet(bytes32 marketId, address indexed fundsOwner);
    event OtcMarketAdded(bytes32 marketId, address userBuyToken, address userSellToken);
    event OtcMarketRemoved(bytes32 marketId, address userBuyToken, address userSellToken);

    error OfferPriceNotValid();
    error InvalidTokenPair(address token0, address token1);
    error MarketPairExists();
    error InvalidMarketId(bytes32 marketId);

    /**
     * @notice Add new OTC market.
     * @param _otcMarketInfo OTC Market details
     * @return Bytes32 Market Id
     */
    function addOtcMarket(
        OTCMarketInfo calldata _otcMarketInfo
    ) external returns (bytes32);
    /**
     * @notice Remove OTC market.
     * @param userBuyToken Address of user buy token
     * @param userSellToken Address of user sell token
     */
    function removeOtcMarket(address userBuyToken, address userSellToken) external;
    /**
     * @notice Set funds owner of OTC market. Market must already exist.
     * @param userBuyToken Address of user buy token
     * @param userSellToken Address of user sell token
     * @param fundsOwner OWner of the funds to buy
     */
    function setMarketFundsOwner(address userBuyToken, address userSellToken, address fundsOwner) external;
    /**
     * @notice Set offer price of OTC market. Market must already exist.
     * @param userBuyToken Address of user buy token
     * @param userSellToken Address of user sell token
     * @param offerPrice The offer price
     */
    function setOfferPrice(address userBuyToken, address userSellToken, uint256 offerPrice) external;
    /**
     * @notice Set offer price range of OTC market. Market must already exist.
     * @param userBuyToken Address of user buy token
     * @param userSellToken Address of user sell token
     * @param minValidOfferPrice Minimum valid price of offer
     * @param maxValidOfferPrice Maximum valid price of offer
     */
    function setOfferPriceRange(address userBuyToken, address userSellToken, uint128 minValidOfferPrice, uint128 maxValidOfferPrice) external;
    /// @notice Owner can pause user swaps from occuring
    function pause() external;
    /// @notice Owner can unpause so user swaps can occur
    function unpause() external;
    /**
     * @notice Swap `userSellToken` for `userBuyToken`, at the `offerPrice` 
     * @param marketId OTC market Id
     * @param sellTokenAmount Amount of userSellToken to sell
     * @return buyTokenAmount Amount of `userBuyToken` bought
     */
    function swap(bytes32 marketId, uint256 sellTokenAmount) external returns (uint256);
    /**
     * @notice Swap `userSellToken` for `userBuyToken`, at the `offerPrice` 
     * @param userBuyToken Address of user buy token
     * @param userSellToken Address of user sell token
     * @param sellTokenAmount Amount of userSellToken to sell
     * @return buyTokenAmount Amount of `userBuyToken` bought
     */
    function swap(
        address userBuyToken,
        address userSellToken,
        uint256 sellTokenAmount
    ) external returns (uint256);
    /**
     * @notice How many `userBuyToken` you would receive given an amount of `sellTokenAmount`` 
     * @param marketId OTC Market Id
     * @param sellTokenAmount Amount of userSellToken to sell
     * @return buyTokenAmount Amount of `userBuyToken` bought
     */
    function quote(bytes32 marketId, uint256 sellTokenAmount) external view returns (uint256);
     /** 
     * @notice How many `userBuyToken` you would receive given an amount of `sellTokenAmount`` 
     * @param userBuyToken Address of user buy token
     * @param userSellToken Address of user sell token
     * @param sellTokenAmount Amount of userSellToken to sell
     * @return buyTokenAmount Amount of `userBuyToken` bought
     */
    function quote(
        address userBuyToken,
        address userSellToken,
        uint256 sellTokenAmount
    ) external view returns (uint256);
    /**
     * @notice The available funds for a user swap is goverend by the amount of `userBuyToken` that
     * the `fundsOwner` has available.
     * @dev The minimum of the `fundsOwner` balance of `userBuyToken`, and the spending 
     * approval from `fundsOwner` to this OtcOffer contract.
     */
    function userBuyTokenAvailable(address userBuyToken, address userSellToken) external view returns (uint256);
    /**
     * @notice Get OTC Market Ids
     * @return Array of `OTC Market Ids
     */
    function getOtcMarketIds() external view returns (bytes32[] memory);
    /**
     * @notice Check if OTC market for buy and sell tokens (in that order) exists
     * @param userBuyToken Address of user buy token
     * @param userSellToken Address of user sell token
     * @return Bool if exists or not
     */
    function tokenPairExists(address userBuyToken, address userSellToken) external view returns (bool);
    /**
     * @notice Get OTC Market Id from given buy and sell tokens
     * @param userBuyToken Address of user buy token
     * @param userSellToken Address of user sell token
     * @return Bytes32 Id of OTC Market
     */
    function getMarketIdByTokens(address userBuyToken, address userSellToken) external view returns (bytes32);
    /**
     * @notice Get OTC Market Tokens
     * @param marketId OTC Market Id
     * @return Array of buy and sell tokens in that order
     */
    function getOtcMarketTokens(bytes32 marketId) external view returns (MarketTokens memory);
    /**
     * @notice Get OTC Market Information
     * @param marketId OTC Market Id
     * @return OTC Market info struct
     */
    function getOtcMarketInfo(bytes32 marketId) external view returns (OTCMarketInfo memory); 
    /**
     * @notice Get OTC Market Information
     * @param userBuyToken Address of user buy token
     * @param userSellToken Address of user sell token
     * @return OTC Market info struct
     */
    function getOtcMarketInfo(address userBuyToken, address userSellToken) external view returns (OTCMarketInfo memory);
}