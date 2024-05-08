pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (core/MultiOtcOffer.sol)

import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { IMultiOtcOffer } from "contracts/interfaces/core/IMultiOtcOffer.sol";


/**
 * @title Multi OTC Offer
 *
 * @notice Temple offers OTC purchases to users on certain tokens - slippage and price impact free.
 * Temple sets the offer price and users can swap tokens for any arbitrary size at this price, up to some
 * max amount of treasury funds (determined by the `fundsOwner` balance and ERC20 approvals). 
 * This contract is set up to take care of multiple OTC markets. Elevated access address can add and remove OTC markets.
 */
contract MultiOtcOffer is IMultiOtcOffer, Pausable, TempleElevatedAccess {
    using SafeERC20 for IERC20Metadata;
    using EnumerableSet for EnumerableSet.Bytes32Set;

    /// @notice The number of decimal places represented by `offerPrice`
    uint8 public constant OFFER_PRICE_DECIMALS = 18;

    /// @notice Mapping of OTC market Ids to details 
    mapping(bytes32 marketId => OTCMarketInfo marketInfo) private otcMarketInfo;
    /// @notice keep track of all OTC Market Ids
    EnumerableSet.Bytes32Set private _otcMarketIds;
    /// @notice Reverse map market Ids to buy and sell tokens
    mapping(bytes32 marketId => MarketTokens) private marketIdToTokens;

    constructor(
        address _initialRescuer,
        address _initialExecutor
    )  TempleElevatedAccess(_initialRescuer, _initialExecutor) {}

    /**
     * @notice Add new OTC market.
     * @param _otcMarketInfo OTC Market details
     * @return marketId Bytes32 Market Id
     */
    function addOtcMarket(
        OTCMarketInfo calldata _otcMarketInfo
    ) external override onlyElevatedAccess returns (bytes32 marketId) {
        if (_otcMarketInfo.fundsOwner == address(0) ||
            address(_otcMarketInfo.userBuyToken) == address(0) ||
            address(_otcMarketInfo.userSellToken) == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        if (_otcMarketInfo.userBuyToken == _otcMarketInfo.userSellToken) 
            { revert InvalidTokenPair(address(_otcMarketInfo.userBuyToken), address(_otcMarketInfo.userSellToken)); }
        if (_otcMarketInfo.minValidOfferPrice == 0 || _otcMarketInfo.minValidOfferPrice > _otcMarketInfo.maxValidOfferPrice) 
            { revert CommonEventsAndErrors.InvalidParam(); }
        if (_otcMarketInfo.offerPrice < _otcMarketInfo.minValidOfferPrice || _otcMarketInfo.offerPrice > _otcMarketInfo.maxValidOfferPrice) 
            { revert CommonEventsAndErrors.InvalidParam(); }

        // check existing hash for token pair
        marketId = _createMarketHash(address(_otcMarketInfo.userBuyToken), address(_otcMarketInfo.userSellToken));
        if (!_otcMarketIds.add(marketId)) { revert MarketPairExists(); }
        MarketTokens storage tokens = marketIdToTokens[marketId];
        tokens.userBuyToken = address(_otcMarketInfo.userBuyToken);
        tokens.userSellToken = address(_otcMarketInfo.userSellToken);
        otcMarketInfo[marketId] = _otcMarketInfo;

        OTCMarketInfo storage marketInfo = otcMarketInfo[marketId];
        uint256 scaleDecimals = marketInfo.offerPricingToken == OfferPricingToken.UserBuyToken
            ? OFFER_PRICE_DECIMALS + _otcMarketInfo.userSellToken.decimals() - _otcMarketInfo.userBuyToken.decimals()
            : OFFER_PRICE_DECIMALS + _otcMarketInfo.userBuyToken.decimals() - _otcMarketInfo.userSellToken.decimals();
        marketInfo.scalar = 10 ** scaleDecimals;

        emit OtcMarketAdded(marketId, address(_otcMarketInfo.userBuyToken), address(_otcMarketInfo.userSellToken));
    }

    /**
     * @notice Remove OTC market.
     * @param userBuyToken Address of user buy token
     * @param userSellToken Address of user sell token
     */
    function removeOtcMarket(address userBuyToken, address userSellToken) external override onlyElevatedAccess {
        bytes32 _marketId = _validate(userBuyToken, userSellToken);
        /// okay to ignore return value because we already checked _marketId exists
        _otcMarketIds.remove(_marketId);
        delete otcMarketInfo[_marketId];
        delete marketIdToTokens[_marketId];

        emit OtcMarketRemoved(_marketId, userBuyToken, userSellToken);
    }

    /**
     * @notice Set funds owner of OTC market. Market must already exist.
     * @param _userBuyToken Address of user buy token
     * @param _userSellToken Address of user sell token
     * @param _fundsOwner OWner of the funds to buy
     */
    function setMarketFundsOwner(address _userBuyToken, address _userSellToken, address _fundsOwner) external override onlyElevatedAccess {
        bytes32 _marketId = _validate(_userBuyToken, _userSellToken);
        if (_fundsOwner == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        OTCMarketInfo storage _otcMarketInfo = otcMarketInfo[_marketId]; 
        _otcMarketInfo.fundsOwner = _fundsOwner;
        emit FundsOwnerSet(_marketId, _fundsOwner);
    }

    /**
     * @notice Set offer price of OTC market. Market must already exist.
     * @param _userBuyToken Address of user buy token
     * @param _userSellToken Address of user sell token
     * @param _offerPrice The offer price
     */
    function setOfferPrice(address _userBuyToken, address _userSellToken, uint256 _offerPrice) external override onlyElevatedAccess {
        bytes32 _marketId = _validate(_userBuyToken, _userSellToken);
        OTCMarketInfo storage marketInfo = otcMarketInfo[_marketId];
        if (_offerPrice < marketInfo.minValidOfferPrice || _offerPrice > marketInfo.maxValidOfferPrice) revert OfferPriceNotValid();
        marketInfo.offerPrice = _offerPrice;
        emit OfferPriceSet(_marketId, _offerPrice);
    }

    /**
     * @notice Set offer price range of OTC market. Market must already exist.
     * @param userBuyToken Address of user buy token
     * @param userSellToken Address of user sell token
     * @param minValidOfferPrice Minimum valid price of offer
     * @param maxValidOfferPrice Maximum valid price of offer
     */
    function setOfferPriceRange(
        address userBuyToken,
        address userSellToken,
        uint128 minValidOfferPrice,
        uint128 maxValidOfferPrice
    ) external override onlyElevatedAccess {
        bytes32 _marketId = _validate(userBuyToken, userSellToken);
        if (minValidOfferPrice > maxValidOfferPrice) revert CommonEventsAndErrors.InvalidParam();
        OTCMarketInfo storage marketInfo = otcMarketInfo[_marketId];
        marketInfo.minValidOfferPrice = minValidOfferPrice;
        marketInfo.maxValidOfferPrice = maxValidOfferPrice;
        emit OfferPriceRangeSet(_marketId, minValidOfferPrice, maxValidOfferPrice);
    }

    /// @notice Owner can pause user swaps from occuring
    function pause() external override onlyElevatedAccess {
        _pause();
    }

    /// @notice Owner can unpause so user swaps can occur
    function unpause() external override onlyElevatedAccess {
        _unpause();
    }

    /**
     * @notice Swap `userSellToken` for `userBuyToken`, at the `offerPrice` 
     * @param marketId OTC market Id
     * @param sellTokenAmount Amount of userSellToken to sell
     * @return buyTokenAmount Amount of `userBuyToken` bought
     */
    function swap(bytes32 marketId, uint256 sellTokenAmount) external override whenNotPaused returns (uint256) {
        if (!_otcMarketIds.contains(marketId)) { revert InvalidMarketId(marketId); }
        return _swap(marketId, sellTokenAmount);
    }

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
    ) external override whenNotPaused returns (uint256) {
        bytes32 _marketId = _validate(userBuyToken, userSellToken);
        return _swap(_marketId, sellTokenAmount);
    }

    /**
     * @notice How many `userBuyToken` you would receive given an amount of `sellTokenAmount`` 
     * @param marketId OTC Market Id
     * @param sellTokenAmount Amount of userSellToken to sell
     * @return buyTokenAmount Amount of `userBuyToken` bought
     */
    function quote(bytes32 marketId, uint256 sellTokenAmount) public override view returns (uint256 buyTokenAmount) {
        if (!_otcMarketIds.contains(marketId)) { revert InvalidMarketId(marketId); }
        buyTokenAmount = _calculateBuyTokenAmount(marketId, sellTokenAmount);
    }

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
    ) public override view returns (uint256 buyTokenAmount) {
        bytes32 marketId = _validate(userBuyToken, userSellToken);
        buyTokenAmount = _calculateBuyTokenAmount(marketId, sellTokenAmount);
    }

    /**
     * @notice The available funds for a user swap is goverend by the amount of `userBuyToken` that
     * the `fundsOwner` has available.
     * @dev The minimum of the `fundsOwner` balance of `userBuyToken`, and the spending 
     * approval from `fundsOwner` to this OtcOffer contract.
     */
    function userBuyTokenAvailable(address _userBuyToken, address _userSellToken) external override view returns (uint256) {
        bytes32 _marketId = _validate(_userBuyToken, _userSellToken);
        OTCMarketInfo memory marketInfo = otcMarketInfo[_marketId];
        address _fundsOwner = marketInfo.fundsOwner;
        uint256 _balance = marketInfo.userBuyToken.balanceOf(_fundsOwner);
        uint256 _allowance = marketInfo.userBuyToken.allowance(_fundsOwner, address(this));
        return _balance < _allowance
            ? _balance
            : _allowance;
    }

    /**
     * @notice Get OTC Market Ids
     * @return Array of `OTC Market Ids
     */
    function getOtcMarketIds() external view override returns (bytes32[] memory) {
        return _otcMarketIds.values();
    }

    /**
     * @notice Get OTC Market Tokens
     * @param marketId OTC Market Id
     * @return tokens Array of buy and sell tokens in that order
     */
    function getOtcMarketTokens(bytes32 marketId) external view override returns (MarketTokens memory tokens) {
        tokens = marketIdToTokens[marketId];
    }

    /**
     * @notice Get OTC Market Id from given buy and sell tokens
     * @param userBuyToken Address of user buy token
     * @param userSellToken Address of user sell token
     * @return Bytes32 Id of OTC Market
     */
    function getMarketIdByTokens(address userBuyToken, address userSellToken) external override pure returns (bytes32) {
        return _createMarketHash(userBuyToken, userSellToken);
    }

    /**
     * @notice Check if OTC market for buy and sell tokens (in that order) exists
     * @param userBuyToken Address of user buy token
     * @param userSellToken Address of user sell token
     * @return Bool if exists or not
     */
    function tokenPairExists(address userBuyToken, address userSellToken) external override view returns (bool) {
        bytes32 marketId = _createMarketHash(userBuyToken, userSellToken);
        return _otcMarketIds.contains(marketId);
    }

    /**
     * @notice Get OTC Market Information
     * @param marketId OTC Market Id
     * @return OTC Market info struct
     */
    function getOtcMarketInfo(bytes32 marketId) external override view returns (OTCMarketInfo memory) {
        return otcMarketInfo[marketId];
    }

    /**
     * @notice Get OTC Market Information
     * @param userBuyToken Address of user buy token
     * @param userSellToken Address of user sell token
     * @return OTC Market info struct
     */
    function getOtcMarketInfo(address userBuyToken, address userSellToken) external override view returns (OTCMarketInfo memory) {
        bytes32 marketId = _createMarketHash(userBuyToken, userSellToken);
        return otcMarketInfo[marketId];
    }

    function _validate(address userBuyToken, address userSellToken) private view returns (bytes32 marketId) {
        marketId = _createMarketHash(userBuyToken, userSellToken);
        if (!_otcMarketIds.contains(marketId)) { revert InvalidMarketId(marketId); }
    }

    function _createMarketHash(address userBuyToken, address userSellToken) internal pure returns (bytes32) {
        /// order is important, so not checking tokenA < tokenB
        return keccak256(abi.encodePacked(userBuyToken, userSellToken));
    }

    function _calculateBuyTokenAmount(bytes32 marketId, uint256 sellTokenAmount) private view returns (uint256 buyTokenAmount) {
        OTCMarketInfo storage marketInfo = otcMarketInfo[marketId];
        buyTokenAmount = marketInfo.offerPricingToken == OfferPricingToken.UserBuyToken
            ? sellTokenAmount * marketInfo.offerPrice / marketInfo.scalar
            : sellTokenAmount * marketInfo.scalar / marketInfo.offerPrice;
    }

    function _swap(bytes32 marketId, uint256 sellTokenAmount) private returns (uint256 buyTokenAmount) {
        if (sellTokenAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        OTCMarketInfo memory marketInfo = otcMarketInfo[marketId];
        buyTokenAmount = _calculateBuyTokenAmount(marketId, sellTokenAmount);
        address _fundsOwner = marketInfo.fundsOwner;
        IERC20Metadata _userSellToken = marketInfo.userSellToken;
        IERC20Metadata _userBuyToken = marketInfo.userBuyToken;
        emit Swap(msg.sender, _fundsOwner, marketId, sellTokenAmount, buyTokenAmount);

        _userSellToken.safeTransferFrom(msg.sender, _fundsOwner, sellTokenAmount);
        _userBuyToken.safeTransferFrom(_fundsOwner, msg.sender, buyTokenAmount);
    }
}