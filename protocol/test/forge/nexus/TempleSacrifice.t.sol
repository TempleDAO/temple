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
import "forge-std/console.sol";


contract TempleSacrificeTestBase is TempleTest {

    Relic public relic;
    Shard public shard;
    TempleSacrifice public templeSacrifice;
    TempleERC20Token public templeToken; 


    string private constant name = "RELIC";
    string private constant symbol = "REL";

    event OriginTimeSet(uint64 originTime);
    event CustomPriceSet(uint256 price);
    event TempleSacrificed(address account, uint256 amount);


    function setUp() public {
        relic = new Relic(name, symbol, rescuer, executor);
        shard = new Shard(address(relic), rescuer, executor, "http://example.com");
        templeToken = new TempleERC20Token();
        templeToken.addMinter(bob);
        templeToken.addMinter(alice);
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
    uint256 private constant MINIMUM_CUSTOM_PRICE = 30 ether;

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
        uint64 originTime = uint64(block.timestamp + 100_000);
        templeSacrifice.setOriginTime(originTime);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        templeSacrifice.sacrifice(alice, IRelic.Enclave.Chaos);

        vm.expectRevert(abi.encodeWithSelector(TempleSacrifice.FutureOriginTime.selector, originTime));
        templeSacrifice.sacrifice(alice, IRelic.Enclave.Chaos);

        vm.warp(originTime - 1);
        vm.expectRevert(abi.encodeWithSelector(TempleSacrifice.FutureOriginTime.selector, originTime));
        templeSacrifice.sacrifice(alice, IRelic.Enclave.Chaos);

        // ERC20: insufficient allowance
        // vm.expectRevert("ERC20: insufficient allowance");
        // templeSacrifice.sacrifice(alice, IRelic.Enclave.Chaos);
        changePrank(alice);
        _mintTemple(alice, 1_000 ether);
        templeToken.approve(address(templeSacrifice), 1_000 ether);
        changePrank(bob);
        uint256 price = templeSacrifice.getPrice();
        vm.warp(originTime);
        vm.expectEmit(address(templeSacrifice));
        emit TempleSacrificed(alice, price);
        templeSacrifice.sacrifice(alice, IRelic.Enclave.Chaos);
    }

    function test_getPrice() public {
        uint256 timestamp = block.timestamp;
        templeSacrifice.setOriginTime(uint64(timestamp + 100 seconds));
        templeSacrifice.setCustomPrice(25**18);
        uint256 price = templeSacrifice.getPrice();
        console.logString("PRICE, AT");
        console.logUint(price);
        console.logUint(timestamp);
        assertEq(price, 50*10**18);
        templeSacrifice.setCustomPrice(49 * 10**18);
        assertEq(templeSacrifice.getPrice(), 49 * 10**18);
        // reset custom price to 0
    }
}