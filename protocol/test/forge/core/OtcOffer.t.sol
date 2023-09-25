pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TempleTest } from "../TempleTest.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { OtcOffer } from "contracts/core/OtcOffer.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

contract OtcOfferTestBase is TempleTest {
    OtcOffer public otcOfferDaiOhm;
    OtcOffer public otcOfferUsdcOhm;

    address public fundsOwner = makeAddr("fundsOwner");
    address public owner = makeAddr("owner");

    IERC20Metadata public ohmToken = IERC20Metadata(0x64aa3364F17a4D01c6f1751Fd97C2BD3D7e7f1D5); // 9dp
    IERC20Metadata public daiToken = IERC20Metadata(0x6B175474E89094C44Da98b954EedeAC495271d0F); // 18dp
    IERC20Metadata public usdcToken = IERC20Metadata(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48); // 6dp

    uint256 public constant offerPrice = 11.4e18;
    uint256 public constant maxDelta = 2_000; // 20%

    function setUp() public {
        fork("mainnet", 18210210);

        otcOfferDaiOhm = new OtcOffer(address(ohmToken), address(daiToken), fundsOwner, offerPrice, maxDelta);
        otcOfferDaiOhm.transferOwnership(owner);
        otcOfferUsdcOhm = new OtcOffer(address(ohmToken), address(usdcToken), fundsOwner, offerPrice, maxDelta);
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
    event OfferPriceUpdateThresholdBpsSet(uint256 offerPriceUpdateThresholdBps);
    event FundsOwnerSet(address indexed fundsOwner);

    function test_init() public {
        // DAI/OHM
        { 
            assertEq(address(otcOfferDaiOhm.userSellToken()), address(ohmToken));
            assertEq(address(otcOfferDaiOhm.userBuyToken()), address(daiToken));
            assertEq(otcOfferDaiOhm.fundsOwner(), fundsOwner);
            assertEq(otcOfferDaiOhm.OFFER_PRICE_DECIMALS(), 18);
            assertEq(otcOfferDaiOhm.offerPrice(), offerPrice);
            assertEq(otcOfferDaiOhm.scalar(), 1e9);
            assertEq(otcOfferDaiOhm.offerPriceUpdateThresholdBps(), maxDelta);
            assertEq(otcOfferDaiOhm.BPS_100_PCT(), 10_000);
        }

        // USDC/OHM
        {
            assertEq(address(otcOfferUsdcOhm.userSellToken()), address(ohmToken));
            assertEq(address(otcOfferUsdcOhm.userBuyToken()), address(usdcToken));
            assertEq(otcOfferUsdcOhm.fundsOwner(), fundsOwner);
            assertEq(otcOfferUsdcOhm.OFFER_PRICE_DECIMALS(), 18);
            assertEq(otcOfferUsdcOhm.offerPrice(), offerPrice);
            assertEq(otcOfferUsdcOhm.scalar(), 1e21);
            assertEq(otcOfferUsdcOhm.offerPriceUpdateThresholdBps(), maxDelta);
            assertEq(otcOfferUsdcOhm.BPS_100_PCT(), 10_000);
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
        vm.expectRevert("Pausable: paused");
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

    function test_setOfferPriceUpdateThresholdBps() public {
        vm.startPrank(owner);

        vm.expectEmit(address(otcOfferDaiOhm));
        emit OfferPriceUpdateThresholdBpsSet(100);
        otcOfferDaiOhm.setOfferPriceUpdateThresholdBps(100);
        assertEq(otcOfferDaiOhm.offerPriceUpdateThresholdBps(), 100);
    }

    function test_setOfferPrice_failZero() public {
        vm.startPrank(owner);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        otcOfferDaiOhm.setOfferPrice(0);
    }

    function test_setOfferPrice_failDeltaAbove() public {
        vm.startPrank(owner);

        uint256 newPrice = offerPrice*120/100+1; // just above the threshold
        vm.expectRevert(abi.encodeWithSelector(OtcOffer.OfferPriceDeltaTooBig.selector, newPrice, offerPrice*120/100));
        otcOfferDaiOhm.setOfferPrice(newPrice);
    }

    function test_setOfferPrice_failDeltaBelow() public {
        vm.startPrank(owner);

        uint256 newPrice = offerPrice*80/100-1; // just below the threshold
        vm.expectRevert(abi.encodeWithSelector(OtcOffer.OfferPriceDeltaTooBig.selector, newPrice, offerPrice*80/100));
        otcOfferDaiOhm.setOfferPrice(newPrice);
    }

    function test_setOfferPrice_success() public {
        vm.startPrank(owner);

        // Right on the threshold above
        uint256 newPrice = offerPrice*120/100;
        vm.expectEmit(address(otcOfferDaiOhm));
        emit OfferPriceSet(newPrice);
        otcOfferDaiOhm.setOfferPrice(newPrice);
        assertEq(otcOfferDaiOhm.offerPrice(), newPrice);

        // reset
        otcOfferDaiOhm.setOfferPrice(offerPrice);

        // Right on the threshold below
        newPrice = offerPrice*80/100;
        vm.expectEmit(address(otcOfferDaiOhm));
        emit OfferPriceSet(newPrice);
        otcOfferDaiOhm.setOfferPrice(newPrice);
        assertEq(otcOfferDaiOhm.offerPrice(), newPrice);
    }

    function test_setOfferPrice_bigNegativeDelta() public {
        vm.startPrank(owner);
        otcOfferDaiOhm.setOfferPriceUpdateThresholdBps(15_000); // 150%

        // Right on the threshold above
        uint256 newPrice = offerPrice*250/100;
        vm.expectEmit(address(otcOfferDaiOhm));
        emit OfferPriceSet(newPrice);
        otcOfferDaiOhm.setOfferPrice(newPrice);
        assertEq(otcOfferDaiOhm.offerPrice(), newPrice);

        // Floored at 1 (0 not possible because of guard)
        newPrice = 1;
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

    function test_access_setOfferPriceUpdateThresholdBps() public {
        expectOnlyOwner();
        otcOfferDaiOhm.setOfferPriceUpdateThresholdBps(100);
    }
}

contract OtcOfferTestSwap is OtcOfferTestBase {
    event Swap(address indexed account, address indexed fundsOwner, uint256 userSellTokenAmount, uint256 userBuyTokenAmount);

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

        changePrank(fundsOwner);
        daiToken.approve(address(otcOfferDaiOhm), expectedBuyAmount);

        // Finally succeeds
        changePrank(alice);
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