pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (core/MultiOtcOffer.sol)

import { Pausable } from "@openzeppelin/contracts/security/Pausable.sol";
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
 * This contract is set up to take care of multiple OTC markets. Contract owner can add and remove OTC markets.
 */
contract MultiOtcOffer is IMultiOtcOffer, Pausable, TempleElevatedAccess {
    using SafeERC20 for IERC20Metadata;
    using EnumerableSet for EnumerableSet.Bytes32Set;

    /// @notice The number of decimal places represented by `offerPrice`
    uint8 public constant OFFER_PRICE_DECIMALS = 18;

    mapping(bytes32 marketId => OTCMarketInfo marketInfo) public otcMarketInfo;
    
    EnumerableSet.Bytes32Set private _otcMarketIds;
    mapping(bytes32 marketId => address[] tokens) public marketIdToTokens;


    event OfferPriceSet(bytes32 marketId, uint256 _offerPrice);
    event OfferPriceRangeSet(bytes32 marketId, uint128 minValidOfferPrice, uint128 maxValidOfferPrice);
    event Swap(address indexed account, address indexed fundsOwner, uint256 userSellTokenAmount, uint256 userBuyTokenAmount);
    event FundsOwnerSet(bytes32 marketId, address indexed fundsOwner);
    event OtcMarketAdded(bytes32 marketId, address userBuyToken, address userSellToken);
    event OtcMarketRemoved(bytes32 marketId, address userBuyToken, address userSellToken);

    error OfferPriceNotValid();
    error InvalidTokenPair(address token);
    error MarketPairExists();
    error InvalidMarketId(bytes32 marketId);


    constructor(
        address _initialRescuer,
        address _initialExecutor
    )  TempleElevatedAccess(_initialRescuer, _initialExecutor) {}

    function addOtcMarket(
        OTCMarketInfo calldata _otcMarketInfo,
        uint128 _minValidOfferPrice,
        uint128 _maxValidOfferPrice,
        uint256 _offerPrice
    ) external override onlyElevatedAccess {
        if (_otcMarketInfo.fundsOwner == address(0) ||
            address(_otcMarketInfo.userBuyToken) == address(0) ||
            address(_otcMarketInfo.userSellToken) == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        if (_otcMarketInfo.userBuyToken == _otcMarketInfo.userSellToken) { revert InvalidTokenPair(address(_otcMarketInfo.userBuyToken)); }
        if (_minValidOfferPrice == 0 || _minValidOfferPrice > _maxValidOfferPrice) { revert CommonEventsAndErrors.InvalidParam(); }
        if (_offerPrice < _minValidOfferPrice || _offerPrice > _maxValidOfferPrice) { revert CommonEventsAndErrors.InvalidParam(); }

        // check existing hash for token pair
        bytes32 newHash = _createMarketHash(address(_otcMarketInfo.userBuyToken), address(_otcMarketInfo.userSellToken));
        if (!_otcMarketIds.add(newHash)) { revert MarketPairExists(); }
        address[] memory tokens = new address[](2);
        tokens[0] = address(_otcMarketInfo.userBuyToken);
        tokens[1] = address(_otcMarketInfo.userSellToken);
        marketIdToTokens[newHash] = tokens;
        otcMarketInfo[newHash] = _otcMarketInfo;

        OTCMarketInfo storage marketInfo = otcMarketInfo[newHash];
        marketInfo.minValidOfferPrice = _minValidOfferPrice;
        marketInfo.maxValidOfferPrice = _maxValidOfferPrice;
        marketInfo.offerPrice = _offerPrice;
        uint256 scaleDecimals = marketInfo.offerPricingToken == OfferPricingToken.UserBuyToken
            ? OFFER_PRICE_DECIMALS + _otcMarketInfo.userSellToken.decimals() - _otcMarketInfo.userBuyToken.decimals()
            : OFFER_PRICE_DECIMALS + _otcMarketInfo.userBuyToken.decimals() - _otcMarketInfo.userSellToken.decimals();
        marketInfo.scalar = 10 ** scaleDecimals;

        emit OtcMarketAdded(newHash, address(_otcMarketInfo.userBuyToken), address(_otcMarketInfo.userSellToken));
    }

    function removeOtcMarket(address userBuyToken, address userSellToken) external override onlyElevatedAccess {
        bytes32 _marketId = _validate(userBuyToken, userSellToken);
        /// okay to ignore return value because we already checked _marketId exists
        _otcMarketIds.remove(_marketId);
        delete otcMarketInfo[_marketId];
        delete marketIdToTokens[_marketId];

        emit OtcMarketRemoved(_marketId, userBuyToken, userSellToken);
    }

    function setMarketFundsOwner(address _userBuyToken, address _userSellToken, address _fundsOwner) external override onlyElevatedAccess {
        bytes32 _marketId = _validate(_userBuyToken, _userSellToken);
        // if (!_otcMarketIds.contains(_marketId)) { revert InvalidMarketId(_marketId); }
        if (_fundsOwner == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        OTCMarketInfo storage _otcMarketInfo = otcMarketInfo[_marketId]; 
        _otcMarketInfo.fundsOwner = _fundsOwner;
        emit FundsOwnerSet(_marketId, _fundsOwner);
    }

    function setOfferPrice(address _userBuyToken, address _userSellToken, uint256 _offerPrice) external override onlyElevatedAccess {
        bytes32 _marketId = _validate(_userBuyToken, _userSellToken);
        // if (!_otcMarketIds.contains(_marketId)) { revert InvalidMarketId(_marketId); }
        OTCMarketInfo storage marketInfo = otcMarketInfo[_marketId];
        if (_offerPrice < marketInfo.minValidOfferPrice || _offerPrice > marketInfo.maxValidOfferPrice) revert OfferPriceNotValid();
        marketInfo.offerPrice = _offerPrice;
        emit OfferPriceSet(_marketId, _offerPrice);
    }

    function setOfferPriceRange(address _userBuyToken, address _userSellToken, uint128 _minValidOfferPrice, uint128 _maxValidOfferPrice) external override onlyElevatedAccess {
        bytes32 _marketId = _validate(_userBuyToken, _userSellToken);
        if (_minValidOfferPrice > _maxValidOfferPrice) revert CommonEventsAndErrors.InvalidParam();
        OTCMarketInfo storage marketInfo = otcMarketInfo[_marketId];
        marketInfo.minValidOfferPrice = _minValidOfferPrice;
        marketInfo.maxValidOfferPrice = _maxValidOfferPrice;
        emit OfferPriceRangeSet(_marketId, _minValidOfferPrice, _maxValidOfferPrice);
    }

    /// @notice Owner can pause user swaps from occuring
    function pause() external override onlyElevatedAccess {
        _pause();
    }

    /// @notice Owner can unpause so user swaps can occur
    function unpause() external override onlyElevatedAccess {
        _unpause();
    }

    /// @notice Swap `userSellToken` for `userBuyToken`, at the `offerPrice`
    function swap(bytes32 marketId, uint256 sellTokenAmount) external override whenNotPaused returns (uint256) {
        if (!_otcMarketIds.contains(marketId)) { revert InvalidMarketId(marketId); }
        return _swap(marketId, sellTokenAmount);
    }

    function swap(
        address userBuyToken,
        address userSellToken,
        uint256 sellTokenAmount
    ) external override whenNotPaused returns (uint256) {
        bytes32 _marketId = _validate(userBuyToken, userSellToken);
        return _swap(_marketId, sellTokenAmount);
    }

    function _swap(bytes32 marketId, uint256 sellTokenAmount) private returns (uint256 buyTokenAmount) {
        if (sellTokenAmount == 0) revert CommonEventsAndErrors.ExpectedNonZero();
        OTCMarketInfo memory marketInfo = otcMarketInfo[marketId];
        buyTokenAmount = _calculateBuyTokenAmount(marketId, sellTokenAmount);
        address _fundsOwner = marketInfo.fundsOwner;
        IERC20Metadata _userSellToken = marketInfo.userSellToken;
        IERC20Metadata _userBuyToken = marketInfo.userBuyToken;
        emit Swap(msg.sender, _fundsOwner, sellTokenAmount, buyTokenAmount);

        _userSellToken.safeTransferFrom(msg.sender, _fundsOwner, sellTokenAmount);
        _userBuyToken.safeTransferFrom(_fundsOwner, msg.sender, buyTokenAmount);
    }

    /// @notice How many `userBuyToken` you would receive given an amount of `sellTokenAmount`
    function quote(bytes32 marketId, uint256 sellTokenAmount) public override view returns (uint256 buyTokenAmount) {
        if (!_otcMarketIds.contains(marketId)) { revert InvalidMarketId(marketId); }
        buyTokenAmount = _calculateBuyTokenAmount(marketId, sellTokenAmount);
    }

    function _calculateBuyTokenAmount(bytes32 marketId, uint256 sellTokenAmount) private view returns (uint256 buyTokenAmount) {
        OTCMarketInfo memory marketInfo = otcMarketInfo[marketId];
        buyTokenAmount = marketInfo.offerPricingToken == OfferPricingToken.UserBuyToken
            ? sellTokenAmount * marketInfo.offerPrice / marketInfo.scalar
            : sellTokenAmount * marketInfo.scalar / marketInfo.offerPrice;
    }

     /**
     * @notice The available funds for a user swap is goverend by the amount of `userBuyToken` that
     * the `fundsOwner` has available.
     * @dev The minimum of the `fundsOwner` balance of `userBuyToken`, and the spending 
     * approval from `fundsOwner` to this OtcOffer contract.
     */
    function userBuyTokenAvailable(address _userBuyToken, address _userSellToken) external override view returns (uint256) {
        bytes32 _marketId = _validate(_userBuyToken, _userSellToken);
        // if (!_otcMarketIds.contains(_marketId)) { revert InvalidMarketId(_marketId); }
        OTCMarketInfo memory marketInfo = otcMarketInfo[_marketId];
        address _fundsOwner = marketInfo.fundsOwner;
        uint256 _balance = marketInfo.userBuyToken.balanceOf(_fundsOwner);
        uint256 _allowance = marketInfo.userBuyToken.allowance(_fundsOwner, address(this));
        return _balance < _allowance
            ? _balance
            : _allowance;
    }

    function getOtcMarketIds() external view override returns (bytes32[] memory) {
        return _otcMarketIds.values();
    }

    function getOtcMarketTokens(bytes32 marketId) external view override returns (address[] memory) {
        return marketIdToTokens[marketId];
    }

    function _validate(address userBuyToken, address userSellToken) private view returns (bytes32 marketId) {
        marketId = _createMarketHash(userBuyToken, userSellToken);
        if (!_otcMarketIds.contains(marketId)) { revert InvalidMarketId(marketId); }
    }

    function _createMarketHash(address userBuyToken, address userSellToken) internal pure returns (bytes32) {
        /// order is important, so not checking tokenA < tokenB
        return keccak256(abi.encodePacked(userBuyToken, userSellToken));
    }

    function getMarketIdByTokens(address userBuyToken, address userSellToken) external override pure returns (bytes32) {
        return _createMarketHash(userBuyToken, userSellToken);
    }

    function tokenPairExists(address userBuyToken, address userSellToken) external override view returns (bool) {
        bytes32 marketId = _createMarketHash(userBuyToken, userSellToken);
        return _otcMarketIds.contains(marketId);
    }
}