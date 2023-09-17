pragma solidity 0.8.18;
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TempleTest } from "../TempleTest.sol";
import { Relic } from "../../../contracts/nexus/Relic.sol";
import { Shard } from "../../../contracts/nexus/Shard.sol";
import { TempleSacrifice } from "../../../contracts/nexus/TempleSacrifice.sol";
import { TempleERC20Token } from "../../../contracts/core/TempleERC20Token.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { IERC1155Receiver } from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import { IRelic } from "contracts/interfaces/nexus/IRelic.sol";


contract TempleSacrificeTestBase is TempleTest {

    Relic public relic;
    Shard public shard;
    TempleSacrifice public templeSacrifice;
    TempleERC20Token public templeToken; 


    string private constant name = "RELIC";
    string private constant symbol = "REL";

    uint256 internal constant MINIMUM_CUSTOM_PRICE = 30 ether;
    uint256 internal constant ONE_ETHER = 1 ether;
    uint256 internal constant PRICE_MAX_PERIOD = 365 days;

    event OriginTimeSet(uint64 originTime);
    event CustomPriceSet(uint256 price);
    event TempleSacrificed(address account, uint256 amount);
    event PriceParamsSet(TempleSacrifice.PriceParam params);


    function setUp() public {
        relic = new Relic(name, symbol, rescuer, executor);
        shard = new Shard(address(relic), rescuer, executor, "http://example.com");
        templeToken = new TempleERC20Token();
        templeToken.addMinter(bob);
        templeToken.addMinter(alice);
        templeToken.addMinter(address(this));
        templeSacrifice = new TempleSacrifice(address(relic), address(templeToken));
        vm.startPrank(executor);
        relic.setRelicMinter(address(templeSacrifice), true);
        vm.stopPrank();
    }

    function test_initialization() public {
        assertEq(address(templeSacrifice.templeToken()), address(templeToken));
        assertEq(address(templeSacrifice.relic()), address(relic));
        assertEq(address(templeSacrifice.owner()), address(this));
        assertEq(relic.relicMinters(address(templeSacrifice)), true);
    }

    function _mintTemple(address to, uint256 amount) internal {
        templeToken.mint(to, amount);
    }

    function _getPriceParams() internal view returns (TempleSacrifice.PriceParam memory params) {
        params.minimumPrice = uint128(MINIMUM_CUSTOM_PRICE);
        params.maximumPrice = uint128(200 * ONE_ETHER);
        params.priceMaxPeriod = 365 days;
    }
}

contract TempleSacrificeAccessTest is TempleSacrificeTestBase {

    function test_access_setOriginTimetFail(address caller) public {
        vm.assume(caller != address(this));
        vm.startPrank(caller);
        vm.expectRevert("Ownable: caller is not the owner");
        templeSacrifice.setOriginTime(uint64(block.timestamp));
    }

    function test_access_setOriginTimetSuccess() public {
        templeSacrifice.setOriginTime(uint64(block.timestamp));
    }

    function test_access_setPriceParamsFail(address caller) public {
        vm.assume(caller != address(this));
        vm.startPrank(caller);
        vm.expectRevert("Ownable: caller is not the owner");
        templeSacrifice.setPriceParams(_getPriceParams());
    }

    function test_access_setPriceParamsSuccess() public {
        templeSacrifice.setPriceParams(_getPriceParams());
    }

    function test_access_setCustomPriceFail(address caller) public {
        vm.assume(caller != address(this));
        vm.startPrank(caller);
        vm.expectRevert("Ownable: caller is not the owner");
        templeSacrifice.setCustomPrice(10**18);
    }

    function test_access_setCustomPriceSuccess() public {
        templeSacrifice.setCustomPrice(20**18);
    }
}

contract TempleSacrificeTest is TempleSacrificeAccessTest {

    function _calculatePrice(
        TempleSacrifice.PriceParam memory params
    ) private view returns (uint256 price) {
        uint256 timeDifference =  block.timestamp - templeSacrifice.originTime();
        price = (timeDifference * params.maximumPrice / params.priceMaxPeriod) + params.minimumPrice;
        if (price > params.maximumPrice) {
            price = params.maximumPrice;
        }
    }

    function test_setOriginTime() public {
        uint64 originTime = uint64(block.timestamp - 1);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        templeSacrifice.setOriginTime(originTime);

        uint64 ts = uint64(block.timestamp);
        vm.expectEmit(address(templeSacrifice));
        emit OriginTimeSet(ts);
        templeSacrifice.setOriginTime(ts);
        assertEq(templeSacrifice.originTime(), ts);

        vm.expectEmit(address(templeSacrifice));
        ts = uint64(block.timestamp + 10);
        emit OriginTimeSet(ts);
        templeSacrifice.setOriginTime(ts);
        assertEq(templeSacrifice.originTime(), ts);
    }

    function test_setPriceParams() public {
        TempleSacrifice.PriceParam memory params;
        params.minimumPrice = 2;
        params.maximumPrice = 1;
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        templeSacrifice.setPriceParams(params);

        params.maximumPrice = uint128(MINIMUM_CUSTOM_PRICE + 1);
        params.minimumPrice = uint128(MINIMUM_CUSTOM_PRICE - 1);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        templeSacrifice.setPriceParams(params);

        params.minimumPrice = uint128(MINIMUM_CUSTOM_PRICE);
        params.maximumPrice = uint128(MINIMUM_CUSTOM_PRICE * 2);
        // params.priceMaxPeriod = 0;
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        templeSacrifice.setPriceParams(params);

        params.priceMaxPeriod = 365 days;
        vm.expectEmit(address(templeSacrifice));
        emit PriceParamsSet(params);
        templeSacrifice.setPriceParams(params);
        (uint64 maxPeriod, uint128 minPrice, uint128 maxPrice) = templeSacrifice.priceParams();
        assertEq(maxPeriod, params.priceMaxPeriod);
        assertEq(minPrice, params.minimumPrice);
        assertEq(maxPrice, params.maximumPrice);
    }

    function test_setCustomPrice() public {
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        templeSacrifice.setCustomPrice(MINIMUM_CUSTOM_PRICE - 1);

        uint256 customPrice = 500 * (10**18);
        vm.expectEmit(address(templeSacrifice));
        emit CustomPriceSet(customPrice);
        templeSacrifice.setCustomPrice(customPrice);
        assertEq(templeSacrifice.customPrice(), customPrice);
    }

    function test_sacrifice() public {
        uint64 originTime = uint64(block.timestamp + 100);
        templeSacrifice.setOriginTime(originTime);

        vm.expectRevert(abi.encodeWithSelector(TempleSacrifice.FutureOriginTime.selector, originTime));
        templeSacrifice.sacrifice(IRelic.Enclave.Chaos);
        
        vm.warp(originTime - 1);
        vm.expectRevert(abi.encodeWithSelector(TempleSacrifice.FutureOriginTime.selector, originTime));
        templeSacrifice.sacrifice(IRelic.Enclave.Chaos);

        vm.warp(originTime + 1);
        TempleSacrifice.PriceParam memory params = _getPriceParams();
        templeSacrifice.setPriceParams(params);

        // ERC20: insufficient allowance
        vm.expectRevert("ERC20: insufficient allowance");
        templeSacrifice.sacrifice(IRelic.Enclave.Chaos);

        _mintTemple(alice, 1_000 ether);
        vm.startPrank(alice);
        templeToken.approve(address(templeSacrifice), 1_000 ether);
        uint256 aliceTempleBalanceBefore = templeToken.balanceOf(alice);

        vm.warp(originTime);
        uint256 price = templeSacrifice.getPrice();
        vm.expectEmit(address(templeSacrifice));
        emit TempleSacrificed(alice, price);
        templeSacrifice.sacrifice(IRelic.Enclave.Chaos);
        assertEq(price, _calculatePrice(params));
        assertEq(templeToken.balanceOf(alice), aliceTempleBalanceBefore - price);
    }

    function test_getPrice() public {
        // set params
        TempleSacrifice.PriceParam memory params = _getPriceParams();
        templeSacrifice.setPriceParams(params);
        // origin time same as block.timestamp (set in constructor)
        uint256 price = templeSacrifice.getPrice();
        assertEq(price, MINIMUM_CUSTOM_PRICE);
        // set origin time
        uint256 timestamp = block.timestamp;
        templeSacrifice.setOriginTime(uint64(timestamp + 100 seconds));
        price = templeSacrifice.getPrice();
        assertEq(price, type(uint256).max);
        templeSacrifice.setCustomPrice(35 * 1 ether);
        price = templeSacrifice.getPrice();
        assertEq(price, 35 * 1 ether);
        templeSacrifice.setCustomPrice(49 * 1 ether);
        price = templeSacrifice.getPrice();
        assertEq(price, 49 * 1 ether);
        // can set very high custom price
        templeSacrifice.setCustomPrice(120 * 1 ether);
        price = templeSacrifice.getPrice();
        assertEq(price, 120 * 1 ether);
        // reset custom price to 0
        templeSacrifice.setCustomPrice(0);
        price = templeSacrifice.getPrice();
        assertEq(price, type(uint256).max);

        // timestamp warps
        templeSacrifice.setOriginTime(uint64(block.timestamp + 100));
        vm.warp(block.timestamp + 99);
        price = templeSacrifice.getPrice();
        assertEq(price, type(uint256).max);
        // origin time same as block timestamp
        vm.warp(block.timestamp + 1);
        price = templeSacrifice.getPrice();
        assertEq(price, MINIMUM_CUSTOM_PRICE);
        // 3 months
        vm.warp(block.timestamp + 91.25 days);
        price = templeSacrifice.getPrice();
        assertEq(price, _calculatePrice(params));
        // 9 months
        vm.warp(block.timestamp + 182.5 days);
        price = templeSacrifice.getPrice();
        assertEq(price, _calculatePrice(params));
        // 1 year
        vm.warp(block.timestamp + 91.25 days);
        price = templeSacrifice.getPrice();
        assertEq(price, _calculatePrice(params));
        // 1 year + 1 second
        vm.warp(block.timestamp + 1);
        price = templeSacrifice.getPrice();
        assertEq(price, _calculatePrice(params));
        // 2 years. price does not go over maximum set price
        vm.warp(block.timestamp + 365 days);
        price = templeSacrifice.getPrice();
        assertLe(price, params.maximumPrice);
    }
}