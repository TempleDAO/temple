pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TempleTest } from "../TempleTest.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { OtcOffer } from "contracts/core/OtcOffer.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";

contract OtcOfferTestBase is TempleTest {
    // user sells OHM and buys DAI
    OtcOffer public otcOfferDaiOhm;

    // user sells DAI and buys OHM
    OtcOffer public otcOfferOhmDai;

    // user sells OHM and buys USDC
    OtcOffer public otcOfferUsdcOhm;

    address public fundsOwner = makeAddr("fundsOwner");
    address public owner = makeAddr("owner");

    IERC20Metadata public ohmToken = IERC20Metadata(0x64aa3364F17a4D01c6f1751Fd97C2BD3D7e7f1D5); // 9dp
    IERC20Metadata public daiToken = IERC20Metadata(0x6B175474E89094C44Da98b954EedeAC495271d0F); // 18dp
    IERC20Metadata public usdcToken = IERC20Metadata(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48); // 6dp

    uint256 public constant offerPrice = 11.4e18;
    uint128 public constant minPrice = 11e18;
    uint128 public constant maxPrice = 12e18;

    function setUp() public {
        fork("mainnet", 18210210);

        otcOfferDaiOhm = new OtcOffer(address(ohmToken), address(daiToken), fundsOwner, offerPrice, OtcOffer.OfferPricingToken.UserBuyToken, minPrice, maxPrice);
        otcOfferDaiOhm.transferOwnership(owner);

        otcOfferOhmDai = new OtcOffer(address(daiToken), address(ohmToken), fundsOwner, offerPrice, OtcOffer.OfferPricingToken.UserSellToken, minPrice, maxPrice);
        otcOfferOhmDai.transferOwnership(owner);

        otcOfferUsdcOhm = new OtcOffer(address(ohmToken), address(usdcToken), fundsOwner, offerPrice, OtcOffer.OfferPricingToken.UserBuyToken, minPrice, maxPrice);
        otcOfferUsdcOhm.transferOwnership(owner);
    }

    function swap(address user, OtcOffer otcOffer, uint256 sellAmount, uint256 expectedBuyAmount) internal {
        // Fund the user with sell tokens
        IERC20Metadata sellToken = otcOffer.userSellToken();
        deal(address(sellToken), user, sellAmount, true);

        // Fund the fundsOwner with buy tokens
        IERC20Metadata buyToken = otcOffer.userBuyToken();
        address _fundsOwner = otcOffer.fundsOwner();
        deal(address(buyToken), _fundsOwner, expectedBuyAmount, true);
        vm.prank(_fundsOwner);
        buyToken.approve(address(otcOffer), expectedBuyAmount);

        vm.startPrank(user);
        sellToken.approve(address(otcOffer), sellAmount);
        otcOffer.swap(sellAmount);
        vm.stopPrank();
    }
}

contract OtcOfferTestAdmin is OtcOfferTestBase {
    event Paused(address account);
    event Unpaused(address account);

    event OfferPriceSet(uint256 _offerPrice);
    event OfferPriceRangeSet(uint128 minValidOfferPrice, uint128 maxValidOfferPrice);
    event FundsOwnerSet(address indexed fundsOwner);

    function test_init() public {
        // OHM=>DAI
        { 
            assertEq(address(otcOfferDaiOhm.userSellToken()), address(ohmToken));
            assertEq(address(otcOfferDaiOhm.userBuyToken()), address(daiToken));
            assertEq(otcOfferDaiOhm.fundsOwner(), fundsOwner);
            assertEq(otcOfferDaiOhm.OFFER_PRICE_DECIMALS(), 18);
            assertEq(otcOfferDaiOhm.offerPrice(), offerPrice);
            assertEq(uint256(otcOfferDaiOhm.offerPricingToken()), uint256(OtcOffer.OfferPricingToken.UserBuyToken));
            assertEq(otcOfferDaiOhm.scalar(), 1e9);
            assertEq(otcOfferDaiOhm.minValidOfferPrice(), minPrice);
            assertEq(otcOfferDaiOhm.maxValidOfferPrice(), maxPrice);
        }

        // DAI=>OHM
        { 
            assertEq(address(otcOfferOhmDai.userSellToken()), address(daiToken));
            assertEq(address(otcOfferOhmDai.userBuyToken()), address(ohmToken));
            assertEq(otcOfferOhmDai.fundsOwner(), fundsOwner);
            assertEq(otcOfferOhmDai.OFFER_PRICE_DECIMALS(), 18);
            assertEq(otcOfferOhmDai.offerPrice(), offerPrice);
            assertEq(uint256(otcOfferOhmDai.offerPricingToken()), uint256(OtcOffer.OfferPricingToken.UserSellToken));
            assertEq(otcOfferOhmDai.scalar(), 1e9);
            assertEq(otcOfferOhmDai.minValidOfferPrice(), minPrice);
            assertEq(otcOfferOhmDai.maxValidOfferPrice(), maxPrice);
        }

        // OHM=>USDC
        {
            assertEq(address(otcOfferUsdcOhm.userSellToken()), address(ohmToken));
            assertEq(address(otcOfferUsdcOhm.userBuyToken()), address(usdcToken));
            assertEq(otcOfferUsdcOhm.fundsOwner(), fundsOwner);
            assertEq(otcOfferUsdcOhm.OFFER_PRICE_DECIMALS(), 18);
            assertEq(otcOfferUsdcOhm.offerPrice(), offerPrice);
            assertEq(uint256(otcOfferUsdcOhm.offerPricingToken()), uint256(OtcOffer.OfferPricingToken.UserBuyToken));
            assertEq(otcOfferUsdcOhm.scalar(), 1e21);
            assertEq(otcOfferUsdcOhm.minValidOfferPrice(), minPrice);
            assertEq(otcOfferUsdcOhm.maxValidOfferPrice(), maxPrice);
        }
    }

    function test_pause() public {
        swap(alice, otcOfferDaiOhm, 100e9, 11_400e18);

        // Pause
        {
            vm.prank(owner);
            vm.expectEmit(address(otcOfferDaiOhm));
            emit Paused(owner);
            otcOfferDaiOhm.pause();
        }

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Pausable.EnforcedPause.selector));
        otcOfferDaiOhm.swap(100e9);

        // Unpause
        {
            vm.prank(owner);
            vm.expectEmit(address(otcOfferDaiOhm));
            emit Unpaused(owner);
            otcOfferDaiOhm.unpause();
        }
        swap(alice, otcOfferDaiOhm, 100e9, 11_400e18);
    }

    function test_setFundsOwner() public {
        vm.startPrank(owner);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        otcOfferDaiOhm.setFundsOwner(address(0));

        vm.expectEmit(address(otcOfferDaiOhm));
        emit FundsOwnerSet(alice);
        otcOfferDaiOhm.setFundsOwner(alice);
        assertEq(otcOfferDaiOhm.fundsOwner(), alice);
    }

    function test_setOfferPriceRange() public {
        vm.startPrank(owner);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        otcOfferDaiOhm.setOfferPriceRange(12, 11);

        vm.expectEmit(address(otcOfferDaiOhm));
        emit OfferPriceRangeSet(1e18, 100e18);
        otcOfferDaiOhm.setOfferPriceRange(1e18, 100e18);
        assertEq(otcOfferDaiOhm.minValidOfferPrice(), 1e18);
        assertEq(otcOfferDaiOhm.maxValidOfferPrice(), 100e18);
    }

    function test_setOfferPrice_failDeltaAbove() public {
        vm.startPrank(owner);

        uint256 newPrice = 12e18+1; // just above the threshold
        vm.expectRevert(abi.encodeWithSelector(OtcOffer.OfferPriceNotValid.selector));
        otcOfferDaiOhm.setOfferPrice(newPrice);
    }

    function test_setOfferPrice_failDeltaBelow() public {
        vm.startPrank(owner);

        uint256 newPrice = 11e18-1; // just below the threshold
        vm.expectRevert(abi.encodeWithSelector(OtcOffer.OfferPriceNotValid.selector));
        otcOfferDaiOhm.setOfferPrice(newPrice);
    }

    function test_setOfferPrice_success() public {
        vm.startPrank(owner);

        // Right on the threshold above
        uint256 newPrice = 12e18;
        vm.expectEmit(address(otcOfferDaiOhm));
        emit OfferPriceSet(newPrice);
        otcOfferDaiOhm.setOfferPrice(newPrice);
        assertEq(otcOfferDaiOhm.offerPrice(), newPrice);

        // reset
        otcOfferDaiOhm.setOfferPrice(offerPrice);

        // Right on the threshold below
        newPrice = 11e18;
        vm.expectEmit(address(otcOfferDaiOhm));
        emit OfferPriceSet(newPrice);
        otcOfferDaiOhm.setOfferPrice(newPrice);
        assertEq(otcOfferDaiOhm.offerPrice(), newPrice);
    }
}

contract OtcOfferTestAccess is OtcOfferTestBase {
    function test_access_pause() public {
        expectOnlyOwner();
        otcOfferDaiOhm.pause();
    }

    function test_access_unpause() public {
        expectOnlyOwner();
        otcOfferDaiOhm.unpause();
    }

    function test_access_setFundsOwner() public {
        expectOnlyOwner();
        otcOfferDaiOhm.setFundsOwner(alice);
    }

    function test_access_setOfferPrice() public {
        expectOnlyOwner();
        otcOfferDaiOhm.setOfferPrice(100e18);
    }

    function test_access_setOfferPriceRange() public {
        expectOnlyOwner();
        otcOfferDaiOhm.setOfferPriceRange(100, 100);
    }
}

contract OtcOfferTestSwap is OtcOfferTestBase {
    event Swap(address indexed account, address indexed fundsOwner, uint256 userSellTokenAmount, uint256 userBuyTokenAmount);

    function test_quote() public {
        // User sells OHM for DAI
        // Price defined as 11.4 DAI/OHM
        {
            uint256 sellAmount = 100e9;
            uint256 expectedBuyAmount = 1_140e18;
            assertEq(otcOfferDaiOhm.quote(sellAmount), expectedBuyAmount);
        }

        // User sells DAI for OHM
        // Price still defined as 11.4 DAI/OHM
        {
            uint256 sellAmount = 1_140e18; // DAI
            uint256 expectedBuyAmount = 100e9; // OHM
            assertEq(otcOfferOhmDai.quote(sellAmount), expectedBuyAmount);
        }

        // User sells OHM for USDC
        // Price defined as 11.4 USDC/OHM
        {
            uint256 sellAmount = 100e9;
            uint256 expectedBuyAmount = 1_140e6;
            assertEq(otcOfferUsdcOhm.quote(sellAmount), expectedBuyAmount);
        }
    }

    function test_userBuyTokenAvailable() public {
        // No buy token funds available by default
        assertEq(otcOfferDaiOhm.userBuyTokenAvailable(), 0);

        // Deal funds but no approvals - still 0
        deal(address(daiToken), fundsOwner, 100e18, true);
        assertEq(otcOfferDaiOhm.userBuyTokenAvailable(), 0);

        // Approve some - now the min
        vm.startPrank(fundsOwner);
        daiToken.approve(address(otcOfferDaiOhm), 25e18);
        assertEq(otcOfferDaiOhm.userBuyTokenAvailable(), 25e18);

        // Still the min of both
        daiToken.approve(address(otcOfferDaiOhm), 125e18);
        assertEq(otcOfferDaiOhm.userBuyTokenAvailable(), 100e18);

        // Alice sells 1 OHM
        {
            deal(address(ohmToken), alice, 1e9, true);
            vm.startPrank(alice);
            ohmToken.approve(address(otcOfferDaiOhm), 1e9);
            otcOfferDaiOhm.swap(1e9);
        }

        // Now decreases by this amount
        assertEq(otcOfferDaiOhm.userBuyTokenAvailable(), 100e18 - 11.4e18);
        deal(address(daiToken), fundsOwner, 200e18, true);
        assertEq(otcOfferDaiOhm.userBuyTokenAvailable(), 125e18 - 11.4e18);
    }

    function test_swap_fail() public {
        vm.startPrank(alice);

        uint256 sellAmount = 100e9;
        uint256 expectedBuyAmount = 1_140e18;

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        otcOfferDaiOhm.swap(0);

        vm.expectRevert("ERC20: transfer amount exceeds balance");
        otcOfferDaiOhm.swap(sellAmount);

        deal(address(ohmToken), alice, sellAmount, true);
        vm.expectRevert("ERC20: transfer amount exceeds allowance");
        otcOfferDaiOhm.swap(sellAmount);

        ohmToken.approve(address(otcOfferDaiOhm), sellAmount);
        vm.expectRevert("Dai/insufficient-balance");
        otcOfferDaiOhm.swap(sellAmount);

        deal(address(daiToken), fundsOwner, expectedBuyAmount, true);
        vm.expectRevert("Dai/insufficient-allowance");
        otcOfferDaiOhm.swap(sellAmount);

        vm.startPrank(fundsOwner);
        daiToken.approve(address(otcOfferDaiOhm), expectedBuyAmount);

        // Finally succeeds
        vm.startPrank(alice);
        otcOfferDaiOhm.swap(sellAmount);
    }

    function test_swap_ohmdai_success() public {
        uint256 sellAmount = 100e9; // OHM 9 dp's
        uint256 expectedBuyAmount = 1_140e18; // DAI 18 dp's

        deal(address(daiToken), fundsOwner, expectedBuyAmount, true);
        vm.prank(fundsOwner);
        daiToken.approve(address(otcOfferDaiOhm), expectedBuyAmount);

        deal(address(ohmToken), alice, sellAmount, true);
        vm.startPrank(alice);
        ohmToken.approve(address(otcOfferDaiOhm), sellAmount);

        vm.expectEmit(address(otcOfferDaiOhm));
        emit Swap(alice, fundsOwner, sellAmount, expectedBuyAmount);

        otcOfferDaiOhm.swap(sellAmount);

        assertEq(ohmToken.balanceOf(alice), 0);
        assertEq(ohmToken.balanceOf(fundsOwner), sellAmount);
        assertEq(daiToken.balanceOf(alice), expectedBuyAmount);
        assertEq(daiToken.balanceOf(fundsOwner), 0);
    }

    function test_swap_daiohm_success() public {
        uint256 sellAmount = 1_140e18; // DAI 18 dp's
        uint256 expectedBuyAmount = 100e9; // OHM 9 dp's

        deal(address(ohmToken), fundsOwner, expectedBuyAmount, true);
        vm.prank(fundsOwner);
        ohmToken.approve(address(otcOfferOhmDai), expectedBuyAmount);

        deal(address(daiToken), alice, sellAmount, true);
        vm.startPrank(alice);
        daiToken.approve(address(otcOfferOhmDai), sellAmount);

        vm.expectEmit(address(otcOfferOhmDai));
        emit Swap(alice, fundsOwner, sellAmount, expectedBuyAmount);

        otcOfferOhmDai.swap(sellAmount);

        assertEq(daiToken.balanceOf(alice), 0);
        assertEq(daiToken.balanceOf(fundsOwner), sellAmount);
        assertEq(ohmToken.balanceOf(alice), expectedBuyAmount);
        assertEq(ohmToken.balanceOf(fundsOwner), 0);
    }

    function test_swap_ohmusdc_success() public {
        uint256 sellAmount = 100e9; // OHM 9 dp's
        uint256 expectedBuyAmount = 1_140e6; // USDC 6 dp's

        deal(address(usdcToken), fundsOwner, expectedBuyAmount, true);
        vm.prank(fundsOwner);
        usdcToken.approve(address(otcOfferUsdcOhm), expectedBuyAmount);

        deal(address(ohmToken), alice, sellAmount, true);
        vm.startPrank(alice);
        ohmToken.approve(address(otcOfferUsdcOhm), sellAmount);

        vm.expectEmit(address(otcOfferUsdcOhm));
        emit Swap(alice, fundsOwner, sellAmount, expectedBuyAmount);

        otcOfferUsdcOhm.swap(sellAmount);

        assertEq(ohmToken.balanceOf(alice), 0);
        assertEq(ohmToken.balanceOf(fundsOwner), sellAmount);
        assertEq(usdcToken.balanceOf(alice), expectedBuyAmount);
        assertEq(usdcToken.balanceOf(fundsOwner), 0);
    }
}