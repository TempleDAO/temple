pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// (tests/forge/core/MultiOtcOffer.t.sol)

import { TempleTest } from "../TempleTest.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { OtcOffer } from "contracts/core/OtcOffer.sol";
import { MultiOtcOffer } from "contracts/core/MultiOtcOffer.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { IMultiOtcOffer } from "contracts/interfaces/core/IMultiOtcOffer.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";

contract MultiOtcOfferTestBase is TempleTest {
    MultiOtcOffer public otcOffer;

    address public fundsOwner = makeAddr("fundsOwner");
    address public owner = makeAddr("owner");

    IERC20Metadata public ohmToken = IERC20Metadata(0x64aa3364F17a4D01c6f1751Fd97C2BD3D7e7f1D5); // 9dp
    IERC20Metadata public daiToken = IERC20Metadata(0x6B175474E89094C44Da98b954EedeAC495271d0F); // 18dp
    IERC20Metadata public usdcToken = IERC20Metadata(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48); // 6dp

    uint256 public constant OFFER_PRICE_ONE = 11.4e18;
    uint256 public constant OFFER_PRICE_TWO = 12.4e18;
    uint256 public constant OFFER_PRICE_THREE = 13.4e18;
    uint256 public constant OFFER_PRICE_DECIMALS = 18;
    uint128 public constant MIN_PRICE = 11e18;
    uint128 public constant MAX_PRICE = 12e18;

    event OfferPriceSet(bytes32 marketId, uint256 _offerPrice);
    event OfferPriceRangeSet(bytes32 marketId, uint128 minValidOfferPrice, uint128 maxValidOfferPrice);
    event Swap(address indexed account, address indexed fundsOwner, bytes32 marketId, uint256 userSellTokenAmount, uint256 userBuyTokenAmount);
    event FundsOwnerSet(bytes32 marketId, address indexed fundsOwner);
    event OtcMarketAdded(bytes32 marketId, address userBuyToken, address userSellToken);
    event OtcMarketRemoved(bytes32 marketId, address userBuyToken, address userSellToken);
    event Paused(address executor);
    event Unpaused(address executor);

    function setUp() public {
        fork("mainnet", 18210210);

        otcOffer = new MultiOtcOffer(rescuer, executor);
    }

    function test_initialization() public {
        assertEq(rescuer, otcOffer.rescuer());
        assertEq(executor, otcOffer.executor());
    }

    function _getMarketInfoOne() internal view returns (IMultiOtcOffer.OTCMarketInfo memory marketInfo) {
        marketInfo.fundsOwner = fundsOwner;
        marketInfo.userBuyToken = ohmToken;
        marketInfo.userSellToken = daiToken;
        marketInfo.offerPricingToken = IMultiOtcOffer.OfferPricingToken.UserBuyToken;
        marketInfo.minValidOfferPrice = MIN_PRICE;
        marketInfo.maxValidOfferPrice = MAX_PRICE;
        //marketInfo.scalar = 0; default
        marketInfo.offerPrice = OFFER_PRICE_ONE;
    }

    function _addOtcMarketOne() internal returns (bytes32 marketId) {
        marketId = _addOtcMarket(ohmToken, daiToken, IMultiOtcOffer.OfferPricingToken.UserSellToken);
    }

    function _addOtcMarketTwo() internal returns (bytes32 marketId) {
        marketId = _addOtcMarket(daiToken, ohmToken, IMultiOtcOffer.OfferPricingToken.UserBuyToken);
    }

    function _addOtcMarketThree() internal returns (bytes32 marketId) {
        marketId = _addOtcMarket(usdcToken, ohmToken, IMultiOtcOffer.OfferPricingToken.UserBuyToken);
    }

    function _fundFundsOwner(address _token, address _fundsOwner, uint256 _amount) internal {
        IERC20Metadata(_token).transfer(_fundsOwner, _amount);
    }

    function _swap(address user, bytes32 marketId, uint256 sellAmount, uint256 expectedBuyAmount) internal {
        // Fund the user with sell tokens
        IMultiOtcOffer.OTCMarketInfo memory info = otcOffer.getOtcMarketInfo(marketId);
        deal(address(info.userSellToken), user, sellAmount, true);

        // Fund the fundsOwner with buy token
        deal(address(info.userBuyToken), info.fundsOwner, expectedBuyAmount, true);
        vm.prank(fundsOwner);
        info.userBuyToken.approve(address(otcOffer), expectedBuyAmount);

        vm.startPrank(user);
        info.userSellToken.approve(address(otcOffer), sellAmount);
        otcOffer.swap(marketId, sellAmount);
        vm.stopPrank();
    }

    function _addOtcMarket(
        IERC20Metadata userBuyToken,
        IERC20Metadata userSellToken,
        IMultiOtcOffer.OfferPricingToken offerPricingToken
    ) private returns (bytes32 marketId) {
        IMultiOtcOffer.OTCMarketInfo memory marketInfo;
        marketInfo.userBuyToken = userBuyToken;
        marketInfo.userSellToken = userSellToken;
        marketInfo.fundsOwner = fundsOwner;
        marketInfo.minValidOfferPrice = MIN_PRICE;
        marketInfo.maxValidOfferPrice = MAX_PRICE;
        marketInfo.offerPrice = OFFER_PRICE_ONE;
        marketInfo.offerPricingToken = offerPricingToken;
        marketId = otcOffer.addOtcMarket(marketInfo);
    }
}

contract MultiOtcOfferAccessTest is MultiOtcOfferTestBase {

    function test_access_addOtcMarket() public {
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        IMultiOtcOffer.OTCMarketInfo memory marketInfo = _getMarketInfoOne();
        otcOffer.addOtcMarket(marketInfo);
    }
    function test_access_fuzz_addOtcMarket(address caller) public {
        vm.assume(caller != rescuer && caller != executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        IMultiOtcOffer.OTCMarketInfo memory marketInfo = _getMarketInfoOne();
        otcOffer.addOtcMarket(marketInfo);
    }
    function test_access_removeOtcMarket() public {
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        otcOffer.removeOtcMarket(address(daiToken), address(ohmToken));
    }

    function test_access_fuzz_removeOtcMarket(address caller) public {
        vm.assume(caller != rescuer && caller != executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        otcOffer.removeOtcMarket(address(daiToken), address(ohmToken));
    }

    function test_access_setMarketFundsOwner() public {
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        otcOffer.setMarketFundsOwner(address(daiToken), address(ohmToken), alice);
    }

    function test_access_fuzz_setMarketFundsOwner(address caller) public {
        vm.assume(caller != rescuer && caller != executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        otcOffer.setMarketFundsOwner(address(daiToken), address(ohmToken), alice);
    }

    function test_access_setOfferPrice() public {
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        otcOffer.setOfferPrice(address(daiToken), address(ohmToken), OFFER_PRICE_ONE);
    }

    function test_access_fuzz_setOfferPrice(address caller) public {
        vm.assume(caller != rescuer && caller != executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        otcOffer.setOfferPrice(address(daiToken), address(ohmToken), OFFER_PRICE_ONE);
    }

    function test_access_setOfferPriceRange() public {
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        otcOffer.setOfferPriceRange(address(daiToken), address(ohmToken), MIN_PRICE, MAX_PRICE);
    }

    function test_access_fuzz_setOfferPriceRange(address caller) public {
        vm.assume(caller != rescuer && caller != executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        otcOffer.setOfferPriceRange(address(daiToken), address(ohmToken), MIN_PRICE, MAX_PRICE);
    }

    /// Success
    function test_access_success_addOtcMarket() public {
        vm.startPrank(executor);
        _addOtcMarketOne();
    }

    function test_access_success_removeOtcMarket() public {
        vm.startPrank(executor);
        _addOtcMarketTwo();
        otcOffer.removeOtcMarket(address(daiToken), address(ohmToken));
    }

    function test_access_success_setMarketFundsOwner() public {
        vm.startPrank(executor);
        _addOtcMarketTwo();
        otcOffer.setMarketFundsOwner(address(daiToken), address(ohmToken), alice);
    }

    function test_access_success_setOfferPrice() public {
        vm.startPrank(executor);
        _addOtcMarketTwo();
        otcOffer.setOfferPrice(address(daiToken), address(ohmToken), OFFER_PRICE_ONE);
    }

    function test_access_success_setOfferPriceRange() public {
        vm.startPrank(executor);
        _addOtcMarketTwo();
        otcOffer.setOfferPriceRange(address(daiToken), address(ohmToken), MIN_PRICE, MAX_PRICE);
    }
}

contract MultiOtcOfferViewTest is MultiOtcOfferTestBase {
    function test_quote() public {
        vm.startPrank(executor);
        _addOtcMarketOne();
        _addOtcMarketTwo();
        bytes32 marketId3 = _addOtcMarketThree();

        // User sells OHM for DAI
        // Price defined as 11.4 DAI/OHM
        {
            uint256 sellAmount = 100e9;
            uint256 expectedBuyAmount = 1_140e18;
            assertEq(otcOffer.quote(address(daiToken), address(ohmToken), sellAmount), expectedBuyAmount);
        }

        // User sells DAI for OHM
        // Price still defined as 11.4 DAI/OHM
        {
            uint256 sellAmount = 1_140e18; // DAI
            uint256 expectedBuyAmount = 100e9; // OHM
            assertEq(otcOffer.quote(address(ohmToken), address(daiToken), sellAmount), expectedBuyAmount);
        }

        // User sells OHM for USDC
        // Price defined as 11.4 USDC/OHM
        {
            uint256 sellAmount = 100e9;
            uint256 expectedBuyAmount = 1_140e6;
            /// use marketId for getting quote 
            assertEq(otcOffer.quote(marketId3, sellAmount), expectedBuyAmount);
        }
    }

    function test_userBuyTokensAvailable() public {
        vm.prank(executor);
        _addOtcMarketOne();
        assertEq(otcOffer.userBuyTokenAvailable(address(ohmToken), address(daiToken)), 0);

        uint256 expectedAmount = 10e18;
        deal(address(ohmToken), fundsOwner, expectedAmount, true);
        /// no approval
        assertEq(otcOffer.userBuyTokenAvailable(address(ohmToken), address(daiToken)), 0);

        vm.prank(fundsOwner);
        ohmToken.approve(address(otcOffer), type(uint).max);
        assertEq(otcOffer.userBuyTokenAvailable(address(ohmToken), address(daiToken)), expectedAmount);

        /// test for usdc/ohm market
        vm.prank(executor);
        bytes32 marketId3 = _addOtcMarketThree();
        deal(address(usdcToken), fundsOwner, expectedAmount, true);
        /// no approval yet
        assertEq(otcOffer.userBuyTokenAvailable(address(usdcToken), address(ohmToken)), 0);
        vm.prank(fundsOwner);
        uint256 approvalAmount = 1_140e7;
        usdcToken.approve(address(otcOffer), approvalAmount);
        assertEq(otcOffer.userBuyTokenAvailable(address(usdcToken), address(ohmToken)), approvalAmount);

        /// do a swap and check quote. expect unused approval
        uint256 sellAmount = 100e9;
        uint256 expectedBuyAmount = 1_140e6;
        vm.prank(executor);
        deal(address(ohmToken), alice, sellAmount, true);
        
        vm.startPrank(alice);
        ohmToken.approve(address(otcOffer), sellAmount);
        otcOffer.swap(marketId3, sellAmount);
        assertEq(otcOffer.userBuyTokenAvailable(address(usdcToken), address(ohmToken)), approvalAmount - expectedBuyAmount);
    }

    function test_getOtcMarketIds() public {
        vm.startPrank(executor);
        bytes32 marketId1 = _addOtcMarketOne();
        bytes32[] memory marketIds = new bytes32[](1);
        marketIds = otcOffer.getOtcMarketIds();
        assertEq(marketIds.length, 1);
        assertEq(marketIds[0], marketId1);

        bytes32 marketId2 = _addOtcMarketTwo();   
        marketIds = new bytes32[](2);
        marketIds = otcOffer.getOtcMarketIds();
        assertEq(marketIds.length, 2);
        assertEq(marketIds[1], marketId2);
    }

    function test_getOtcMarketTokens() public {
        vm.startPrank(executor);
        bytes32 marketId1 = _addOtcMarketOne();
        IMultiOtcOffer.MarketTokens memory marketTokens;
        marketTokens = otcOffer.getOtcMarketTokens(marketId1);
        assertEq(marketTokens.userBuyToken, address(ohmToken));
        assertEq(marketTokens.userSellToken, address(daiToken));

        bytes32 marketId3 = _addOtcMarketThree();
        marketTokens = otcOffer.getOtcMarketTokens(marketId3);
        assertEq(marketTokens.userBuyToken, address(usdcToken));
        assertEq(marketTokens.userSellToken, address(ohmToken));
    }

    function test_getMarketIdByTokens() public {
        vm.startPrank(executor);
        bytes32 marketId = _addOtcMarketOne();
        bytes32 id = otcOffer.getMarketIdByTokens(address(ohmToken), address(daiToken));
        assertEq(id, marketId);
    }

    function test_tokenPairExists() public {
        assertEq(otcOffer.tokenPairExists(address(usdcToken), address(ohmToken)), false);
        vm.startPrank(executor);
         _addOtcMarketThree();
        assertEq(otcOffer.tokenPairExists(address(usdcToken), address(ohmToken)), true);
    }

    function test_getOtcMarketInfo() public {
        vm.startPrank(executor);
        bytes32 marketId = _addOtcMarketTwo();
        IMultiOtcOffer.OTCMarketInfo memory info = otcOffer.getOtcMarketInfo(marketId);
        assertEq(address(info.userBuyToken), address(daiToken));
        assertEq(address(info.userSellToken), address(ohmToken));
        
        _addOtcMarketThree();
        info = otcOffer.getOtcMarketInfo(address(usdcToken), address(ohmToken));
        assertEq(address(info.userBuyToken), address(usdcToken));
        assertEq(address(info.userSellToken), address(ohmToken));
    }
}

contract MultiOtcOfferTest is MultiOtcOfferTestBase {
    
    function test_addOtcMarket() public {
        vm.startPrank(executor);
        IMultiOtcOffer.OTCMarketInfo memory marketInfo;
        marketInfo.fundsOwner = address(0); // just stating explicitly although default value is 0
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        otcOffer.addOtcMarket(marketInfo);
        marketInfo.fundsOwner = alice;
        /// userBuyToken address(0) error
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        otcOffer.addOtcMarket(marketInfo);
        marketInfo.userBuyToken = usdcToken;
        /// userSellToken address(0) error
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        otcOffer.addOtcMarket(marketInfo);
        /// invalid token pair
        marketInfo.userSellToken = usdcToken;
        vm.expectRevert(abi.encodeWithSelector(IMultiOtcOffer.InvalidTokenPair.selector, address(usdcToken), address(usdcToken)));
        otcOffer.addOtcMarket(marketInfo);
        marketInfo.userSellToken = ohmToken;
        /// minValidOfferPrice == 0
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        otcOffer.addOtcMarket(marketInfo);
        /// minPrice > maxPrice
        marketInfo.minValidOfferPrice = MIN_PRICE;
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        otcOffer.addOtcMarket(marketInfo);
        marketInfo.maxValidOfferPrice = MAX_PRICE;
        /// offerPrice < min price
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        otcOffer.addOtcMarket(marketInfo);
        /// offerPrice > max price
        marketInfo.offerPrice = MAX_PRICE + 1;
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        otcOffer.addOtcMarket(marketInfo);
        marketInfo.offerPrice = OFFER_PRICE_ONE;
        marketInfo.offerPricingToken = IMultiOtcOffer.OfferPricingToken.UserBuyToken;

        bytes32 marketId = otcOffer.getMarketIdByTokens(address(usdcToken), address(ohmToken));
        vm.expectEmit(address(otcOffer));
        emit OtcMarketAdded(marketId, address(usdcToken), address(ohmToken));
        otcOffer.addOtcMarket(marketInfo);

        IMultiOtcOffer.OTCMarketInfo memory info = otcOffer.getOtcMarketInfo(marketId);
        assertEq(info.fundsOwner, alice);
        assertEq(address(info.userBuyToken), address(usdcToken));
        assertEq(address(info.userSellToken), address(ohmToken));
        assertEq(uint8(info.offerPricingToken), uint8(IMultiOtcOffer.OfferPricingToken.UserBuyToken));
        assertEq(info.minValidOfferPrice, MIN_PRICE);
        assertEq(info.maxValidOfferPrice, MAX_PRICE);
        uint256 scaleDecimals = marketInfo.offerPricingToken == IMultiOtcOffer.OfferPricingToken.UserBuyToken
            ? OFFER_PRICE_DECIMALS + ohmToken.decimals() - usdcToken.decimals()
            : OFFER_PRICE_DECIMALS + usdcToken.decimals() - ohmToken.decimals();
        uint256 _scalar = 10 ** scaleDecimals;
        assertEq(info.scalar, _scalar);
        assertEq(info.offerPrice, OFFER_PRICE_ONE);
        /// market IDs to tokens
        bytes32[] memory marketIds = otcOffer.getOtcMarketIds();
        assertEq(marketIds[0], marketId);
        IMultiOtcOffer.MarketTokens memory tokens = otcOffer.getOtcMarketTokens(marketId);
        assertEq(tokens.userBuyToken, address(usdcToken));
        assertEq(tokens.userSellToken, address(ohmToken));
        assertEq(otcOffer.tokenPairExists(address(usdcToken), address(ohmToken)), true);
    }

    function test_removeOtcMarket() public {
        vm.startPrank(executor);
        bytes32 marketId = otcOffer.getMarketIdByTokens(address(ohmToken), address(ohmToken));
        vm.expectRevert(abi.encodeWithSelector(IMultiOtcOffer.InvalidMarketId.selector, marketId));
        otcOffer.removeOtcMarket(address(ohmToken), address(ohmToken));
        marketId = _addOtcMarketThree();
        vm.expectEmit(address(otcOffer));
        emit OtcMarketRemoved(marketId, address(usdcToken), address(ohmToken));
        otcOffer.removeOtcMarket(address(usdcToken), address(ohmToken));

        bytes32[] memory marketIds = otcOffer.getOtcMarketIds();
        assertEq(marketIds.length, 0);
        assertEq(otcOffer.tokenPairExists(address(usdcToken), address(ohmToken)), false);
    }

    function test_setMarketFundsOwner() public {
        vm.startPrank(executor);
        bytes32 marketId = otcOffer.getMarketIdByTokens(address(ohmToken), address(ohmToken));
        vm.expectRevert(abi.encodeWithSelector(IMultiOtcOffer.InvalidMarketId.selector, marketId));
        otcOffer.setMarketFundsOwner(address(ohmToken), address(ohmToken), alice);
        marketId = _addOtcMarketThree();
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        otcOffer.setMarketFundsOwner(address(usdcToken), address(ohmToken), address(0));
        vm.expectEmit(address(otcOffer));
        emit FundsOwnerSet(marketId, fundsOwner);
        otcOffer.setMarketFundsOwner(address(usdcToken), address(ohmToken), fundsOwner);
        IMultiOtcOffer.OTCMarketInfo memory info = otcOffer.getOtcMarketInfo(marketId);
        assertEq(info.fundsOwner, fundsOwner);
    }

    function test_setOfferPrice() public {
        vm.startPrank(executor);
        bytes32 marketId = otcOffer.getMarketIdByTokens(address(ohmToken), address(ohmToken));
        vm.expectRevert(abi.encodeWithSelector(IMultiOtcOffer.InvalidMarketId.selector, marketId));
        otcOffer.setOfferPrice(address(ohmToken), address(ohmToken), OFFER_PRICE_ONE);
        marketId = _addOtcMarketThree();
        /// offerPrice < min price
        vm.expectRevert(abi.encodeWithSelector(IMultiOtcOffer.OfferPriceNotValid.selector));
        otcOffer.setOfferPrice(address(usdcToken), address(ohmToken), MIN_PRICE - 1);
        /// offerPrice > max price
        vm.expectRevert(abi.encodeWithSelector(IMultiOtcOffer.OfferPriceNotValid.selector));
        otcOffer.setOfferPrice(address(usdcToken), address(ohmToken), MAX_PRICE + 1);
        vm.expectEmit(address(otcOffer));
        uint256 offerPrice = 11.5e18;
        emit OfferPriceSet(marketId, offerPrice);
        otcOffer.setOfferPrice(address(usdcToken), address(ohmToken), offerPrice);
        IMultiOtcOffer.OTCMarketInfo memory info = otcOffer.getOtcMarketInfo(marketId);
        assertEq(info.offerPrice, offerPrice);
    }

    function test_setOfferPriceRange() public {
        vm.startPrank(executor);
        bytes32 marketId = otcOffer.getMarketIdByTokens(address(ohmToken), address(ohmToken));
        vm.expectRevert(abi.encodeWithSelector(IMultiOtcOffer.InvalidMarketId.selector, marketId));
        otcOffer.setOfferPriceRange(address(ohmToken), address(ohmToken), MIN_PRICE, MAX_PRICE);
        marketId = _addOtcMarketThree();
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        otcOffer.setOfferPriceRange(address(usdcToken), address(ohmToken), MAX_PRICE, MIN_PRICE);
        vm.expectEmit(address(otcOffer));
        emit OfferPriceRangeSet(marketId, MIN_PRICE, MAX_PRICE);
        otcOffer.setOfferPriceRange(address(usdcToken), address(ohmToken), MIN_PRICE, MAX_PRICE);

        IMultiOtcOffer.OTCMarketInfo memory info = otcOffer.getOtcMarketInfo(marketId);
        assertEq(info.minValidOfferPrice, MIN_PRICE);
        assertEq(info.maxValidOfferPrice, MAX_PRICE);
    }

    function test_market_pause() public {
        vm.prank(executor);
        bytes32 marketId = _addOtcMarketOne();

        _swap(alice, marketId, 100e9, 11_400e18);

        // Pause
        {
            vm.prank(executor);
            vm.expectEmit(address(otcOffer));
            emit Paused(executor);
            otcOffer.pause();
        }

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Pausable.EnforcedPause.selector));
        otcOffer.swap(marketId, 100e9);

        // Unpause
        {
            vm.prank(executor);
            vm.expectEmit(address(otcOffer));
            emit Unpaused(executor);
            otcOffer.unpause();
        }
        _swap(alice, marketId, 100e9, 11_400e18);
    }

    function test_swap_fail() public {
        vm.startPrank(executor);
        bytes32 marketId = _addOtcMarketTwo();
        vm.startPrank(alice);

        uint256 sellAmount = 100e9;
        uint256 expectedBuyAmount = 1_140e18;

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        otcOffer.swap(marketId, 0);

        vm.expectRevert("ERC20: transfer amount exceeds balance");
        otcOffer.swap(marketId, sellAmount);

        deal(address(ohmToken), alice, sellAmount, true);
        vm.expectRevert("ERC20: transfer amount exceeds allowance");
        otcOffer.swap(marketId, sellAmount);

        ohmToken.approve(address(otcOffer), sellAmount);
        vm.expectRevert("Dai/insufficient-balance");
        otcOffer.swap(marketId, sellAmount);

        deal(address(daiToken), fundsOwner, expectedBuyAmount, true);
        vm.expectRevert("Dai/insufficient-allowance");
        otcOffer.swap(marketId, sellAmount);

        vm.startPrank(fundsOwner);
        daiToken.approve(address(otcOffer), expectedBuyAmount);

        // Finally succeeds
        vm.startPrank(alice);
        otcOffer.swap(marketId, sellAmount);
    }

    function test_swap_dai_ohm() public {
        vm.prank(executor);
        bytes32 marketId = _addOtcMarketOne();
        uint256 sellAmount = 1_140e18; // DAI 18 dp's
        uint256 expectedBuyAmount = 100e9; // OHM 9 dp's

        deal(address(ohmToken), fundsOwner, expectedBuyAmount, true);
        vm.prank(fundsOwner);
        ohmToken.approve(address(otcOffer), expectedBuyAmount);

        deal(address(daiToken), alice, sellAmount, true);
        vm.startPrank(alice);
        daiToken.approve(address(otcOffer), sellAmount);

        vm.expectEmit(address(otcOffer));
        emit Swap(alice, fundsOwner, marketId, sellAmount, expectedBuyAmount);
        otcOffer.swap(marketId, sellAmount);

        assertEq(daiToken.balanceOf(alice), 0);
        assertEq(daiToken.balanceOf(fundsOwner), sellAmount);
        assertEq(ohmToken.balanceOf(alice), expectedBuyAmount);
        assertEq(ohmToken.balanceOf(fundsOwner), 0);
    }

    function test_swap_ohm_dai() public {
        vm.prank(executor);
        _addOtcMarketTwo();
        uint256 sellAmount = 100e9; // OHM 9 dp's
        uint256 expectedBuyAmount = 1_140e18; // DAI 18 dp's

        deal(address(daiToken), fundsOwner, expectedBuyAmount, true);
        vm.prank(fundsOwner);
        daiToken.approve(address(otcOffer), expectedBuyAmount);

        deal(address(ohmToken), alice, sellAmount, true);
        vm.startPrank(alice);
        ohmToken.approve(address(otcOffer), sellAmount);
        bytes32 marketId = otcOffer.getMarketIdByTokens(address(daiToken), address(ohmToken));
        vm.expectEmit(address(otcOffer));
        emit Swap(alice, fundsOwner, marketId, sellAmount, expectedBuyAmount);

        otcOffer.swap(address(daiToken), address(ohmToken), sellAmount);

        assertEq(ohmToken.balanceOf(alice), 0);
        assertEq(ohmToken.balanceOf(fundsOwner), sellAmount);
        assertEq(daiToken.balanceOf(alice), expectedBuyAmount);
        assertEq(daiToken.balanceOf(fundsOwner), 0);
    }

    function test_swap_ohm_usdc() public {
        vm.prank(executor);
        _addOtcMarketThree();

        uint256 sellAmount = 100e9; // OHM 9 dp's
        uint256 expectedBuyAmount = 1_140e6; // USDC 6 dp's

        deal(address(usdcToken), fundsOwner, expectedBuyAmount, true);
        vm.prank(fundsOwner);
        usdcToken.approve(address(otcOffer), expectedBuyAmount);

        deal(address(ohmToken), alice, sellAmount, true);
        vm.startPrank(alice);
        ohmToken.approve(address(otcOffer), sellAmount);
        bytes32 marketId = otcOffer.getMarketIdByTokens(address(usdcToken), address(ohmToken));
        vm.expectEmit(address(otcOffer));
        emit Swap(alice, fundsOwner, marketId, sellAmount, expectedBuyAmount);

        otcOffer.swap(address(usdcToken), address(ohmToken), sellAmount);

        assertEq(ohmToken.balanceOf(alice), 0);
        assertEq(ohmToken.balanceOf(fundsOwner), sellAmount);
        assertEq(usdcToken.balanceOf(alice), expectedBuyAmount);
        assertEq(usdcToken.balanceOf(fundsOwner), 0);
    }

}