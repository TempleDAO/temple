pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (tests/forge/nexus/BaseSacrifice.t.sol)

import { TempleTest } from "../TempleTest.sol";
import { BaseSacrifice } from "../../../contracts/nexus/BaseSacrifice.sol";
import { MockSacrifice }  from "./MockSacrifice.t.sol";
import { CommonEventsAndErrors } from "../../../contracts/common/CommonEventsAndErrors.sol";

contract BaseSacrificeTestBase is TempleTest {
    MockSacrifice public mockSacrifice;

    uint256 internal constant MINIMUM_CUSTOM_PRICE = 30 ether;
    uint256 internal constant ONE_ETHER = 1 ether;
    uint256 internal constant PRICE_MAX_PERIOD = 365 days;

    event OriginTimeSet(uint64 originTime);
    event CustomPriceSet(uint256 price);
    event PriceParamsSet(BaseSacrifice.PriceParam params);

    function setUp() public {
        mockSacrifice = new MockSacrifice(executor);
    }

    function test_initialization() public {
        assertEq(mockSacrifice.executor(), executor);
    }

    function _getPriceParams() internal pure returns (BaseSacrifice.PriceParam memory params) {
        params.minimumPrice = uint128(MINIMUM_CUSTOM_PRICE);
        params.maximumPrice = uint128(200 * ONE_ETHER);
        params.priceMaxPeriod = 365 days;
    }
}

contract BaseSacrificeAccessTest is BaseSacrificeTestBase {

    function test_access_setOriginTimeFail(address caller) public {
        vm.assume(caller != executor);
        vm.startPrank(caller);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        mockSacrifice.setOriginTime(uint64(block.timestamp));
    }

     function test_access_setOriginTimeSuccess() public {
        vm.startPrank(executor);
        mockSacrifice.setOriginTime(uint64(block.timestamp));
    }

    function test_access_setPriceParamsFail(address caller) public {
        vm.assume(caller != executor);
        vm.startPrank(caller);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        mockSacrifice.setPriceParams(_getPriceParams());
    }

    function test_access_setPriceParamsSuccess() public {
        vm.startPrank(executor);
        mockSacrifice.setPriceParams(_getPriceParams());
    }

    function test_access_setCustomPriceFail(address caller) public {
        vm.assume(caller != executor);
        vm.startPrank(caller);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        mockSacrifice.setCustomPrice(10**18);
    }

    function test_access_setCustomPriceSuccess() public {
        vm.startPrank(executor);
        mockSacrifice.setCustomPrice(20**18);
    }
}

contract BaseeSacrificeAccessTest is BaseSacrificeTestBase {

    function _calculatePrice(
        BaseSacrifice.PriceParam memory params
    ) private view returns (uint256 price) {
        uint256 timeDifference =  block.timestamp - mockSacrifice.originTime();
        price = (timeDifference * params.maximumPrice / params.priceMaxPeriod) + params.minimumPrice;
        if (price > params.maximumPrice) {
            price = params.maximumPrice;
        }
    }

    function test_setOriginTime() public {
        vm.startPrank(executor);
        uint64 originTime = uint64(block.timestamp - 1);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        mockSacrifice.setOriginTime(originTime);

        uint64 ts = uint64(block.timestamp);
        vm.expectEmit(address(mockSacrifice));
        emit OriginTimeSet(ts);
        mockSacrifice.setOriginTime(ts);
        assertEq(mockSacrifice.originTime(), ts);

        vm.expectEmit(address(mockSacrifice));
        ts = uint64(block.timestamp + 10);
        emit OriginTimeSet(ts);
        mockSacrifice.setOriginTime(ts);
        assertEq(mockSacrifice.originTime(), ts);
    }

    function test_setPriceParams() public {
        vm.startPrank(executor);
        BaseSacrifice.PriceParam memory params;
        params.minimumPrice = 2;
        params.maximumPrice = 1;
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        mockSacrifice.setPriceParams(params);

        params.maximumPrice = uint128(MINIMUM_CUSTOM_PRICE + 1);
        params.minimumPrice = uint128(MINIMUM_CUSTOM_PRICE - 1);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        mockSacrifice.setPriceParams(params);

        params.minimumPrice = uint128(MINIMUM_CUSTOM_PRICE);
        params.maximumPrice = uint128(MINIMUM_CUSTOM_PRICE * 2);
        // params.priceMaxPeriod = 0;
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        mockSacrifice.setPriceParams(params);

        params.priceMaxPeriod = 365 days;
        vm.expectEmit(address(mockSacrifice));
        emit PriceParamsSet(params);
        mockSacrifice.setPriceParams(params);
        (uint64 maxPeriod, uint128 minPrice, uint128 maxPrice) = mockSacrifice.priceParams();
        assertEq(maxPeriod, params.priceMaxPeriod);
        assertEq(minPrice, params.minimumPrice);
        assertEq(maxPrice, params.maximumPrice);
    }

    function test_setCustomPrice() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        mockSacrifice.setCustomPrice(MINIMUM_CUSTOM_PRICE - 1);

        uint256 customPrice = 500 * (10**18);
        vm.expectEmit(address(mockSacrifice));
        emit CustomPriceSet(customPrice);
        mockSacrifice.setCustomPrice(customPrice);
        assertEq(mockSacrifice.customPrice(), customPrice);

        // reset
        vm.expectEmit(address(mockSacrifice));
        emit CustomPriceSet(0);
        mockSacrifice.setCustomPrice(0);
        assertEq(mockSacrifice.customPrice(), 0);
    }

    function test_getPrice_baseSacrifice() public {
        vm.startPrank(executor);
        // mockSacrifice.setOriginTime(uint64(block.timestamp));
        // set params
        BaseSacrifice.PriceParam memory params = _getPriceParams();
        mockSacrifice.setPriceParams(params);
        // origin time same as block.timestamp (set in constructor)
        uint256 price = mockSacrifice.getPrice();
        assertApproxEqRel(price, MINIMUM_CUSTOM_PRICE, 0.01e18);
        // set origin time
        uint256 timestamp = block.timestamp;
        mockSacrifice.setOriginTime(uint64(timestamp + 100 seconds));
        mockSacrifice.setCustomPrice(35 * 1 ether);
        price = mockSacrifice.getPrice();
        assertEq(price, 35 * 1 ether);
        mockSacrifice.setCustomPrice(49 * 1 ether);
        price = mockSacrifice.getPrice();
        assertEq(price, 49 * 1 ether);
        // can set very high custom price
        mockSacrifice.setCustomPrice(120 * 1 ether);
        price = mockSacrifice.getPrice();
        assertEq(price, 120 * 1 ether);
        // reset custom price to 0
        mockSacrifice.setCustomPrice(0);
        price = mockSacrifice.getPrice();
        assertEq(price, type(uint256).max);

        // timestamp warps
        mockSacrifice.setOriginTime(uint64(block.timestamp + 100));
        vm.warp(block.timestamp + 99);

        // origin time same as block timestamp
        vm.warp(block.timestamp + 1);
        price = mockSacrifice.getPrice();
        assertApproxEqRel(price, MINIMUM_CUSTOM_PRICE, 0.01e18);
        // 3 months
        vm.warp(block.timestamp + 91.25 days);
        price = mockSacrifice.getPrice();
        assertEq(price, _calculatePrice(params));
        // 9 months
        vm.warp(block.timestamp + 182.5 days);
        price = mockSacrifice.getPrice();
        assertEq(price, _calculatePrice(params));
        // 1 year
        vm.warp(block.timestamp + 91.25 days);
        price = mockSacrifice.getPrice();
        assertEq(price, _calculatePrice(params));
        // 1 year + 1 second
        vm.warp(block.timestamp + 1);
        price = mockSacrifice.getPrice();
        assertEq(price, _calculatePrice(params));
        // 2 years. price does not go over maximum set price
        vm.warp(block.timestamp + 365 days);
        price = mockSacrifice.getPrice();
        assertLe(price, params.maximumPrice);
    }
}