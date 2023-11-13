pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (tests/forge/nexus/TempleSacrifice.t.sol)

import { TempleTest } from "../TempleTest.sol";
import { Relic } from "../../../contracts/nexus/Relic.sol";
import { Shard } from "../../../contracts/nexus/Shard.sol";
import { NexusCommon } from "../../../contracts/nexus/NexusCommon.sol";
import { TempleSacrifice } from "../../../contracts/nexus/TempleSacrifice.sol";
import { TempleERC20Token } from "../../../contracts/core/TempleERC20Token.sol";
import { CommonEventsAndErrors } from "../../../contracts/common/CommonEventsAndErrors.sol";
import { IERC1155Receiver } from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import { IRelic } from "../../../contracts/interfaces/nexus/IRelic.sol";
import { IBaseSacrifice } from "../../../contracts/interfaces/nexus/IBaseSacrifice.sol";


contract TempleSacrificeTestBase is TempleTest {

    Relic public relic;
    Shard public shard;
    NexusCommon public nexusCommon;
    TempleSacrifice public templeSacrifice;
    TempleERC20Token public sacrificeToken; 


    string private constant NAME = "RELIC";
    string private constant SYMBOL = "REL";
    string internal constant BASE_URI = "http://example.com/";

    uint256 internal constant MINIMUM_CUSTOM_PRICE = 30 ether;
    uint256 internal constant ONE_ETHER = 1 ether;
    uint256 internal constant PRICE_MAX_PERIOD = 365 days;

    // todo import into common class NexusTestBase
    uint256 internal constant MYSTERY_ID = 0x01;
    uint256 internal constant CHAOS_ID = 0x02;
    uint256 internal constant ORDER_ID = 0x03;
    uint256 internal constant STRUCTURE_ID = 0x04;
    uint256 internal constant LOGIC_ID = 0x05;

    event OriginTimeSet(uint64 originTime);
    event CustomPriceSet(uint256 price);
    event TokenSacrificed(address account, uint256 amount);
    event PriceParamsSet(TempleSacrifice.PriceParam params);
    event TokenRecipientSet(address recipient);


    function setUp() public {
        nexusCommon = new NexusCommon(executor);
        relic = new Relic(NAME, SYMBOL, address(nexusCommon), executor);
        shard = new Shard(address(relic), address(nexusCommon), executor, BASE_URI);
        vm.startPrank(executor);
        nexusCommon.setEnclaveName(CHAOS_ID, "CHAOS");
        sacrificeToken = new TempleERC20Token();
        sacrificeToken.addMinter(bob);
        sacrificeToken.addMinter(alice);
        templeSacrifice = new TempleSacrifice(address(relic), address(sacrificeToken), bob, executor);
        uint256[] memory enclaveIds = new uint256[](5);
        bool[] memory allow = new bool[](5);
        enclaveIds[0] = MYSTERY_ID;
        enclaveIds[1] = CHAOS_ID;
        enclaveIds[2] = STRUCTURE_ID;
        enclaveIds[3] = LOGIC_ID;
        enclaveIds[4] = ORDER_ID;
        allow[0] = allow[1] = allow[2] = allow[3] = allow[4] = true;
        relic.setRelicMinterEnclaveIds(address(templeSacrifice), enclaveIds, allow);
        vm.stopPrank();
    }

    function test_initialization() public {
        assertEq(address(templeSacrifice.sacrificeToken()), address(sacrificeToken));
        assertEq(address(templeSacrifice.relic()), address(relic));
        assertEq(address(templeSacrifice.executor()), executor);
        assertEq(templeSacrifice.sacrificedTokenRecipient(), bob);
        assertEq(relic.isRelicMinter(address(templeSacrifice), MYSTERY_ID), true);
        assertEq(relic.isRelicMinter(address(templeSacrifice), LOGIC_ID), true);
        assertEq(relic.isRelicMinter(address(templeSacrifice), CHAOS_ID), true);
        assertEq(relic.isRelicMinter(address(templeSacrifice), STRUCTURE_ID), true);
        assertEq(relic.isRelicMinter(address(templeSacrifice), ORDER_ID), true);
    }

    function _mintTemple(address to, uint256 amount) internal {
        sacrificeToken.mint(to, amount);
    }

    function _getPriceParams() internal pure returns (TempleSacrifice.PriceParam memory params) {
        params.minimumPrice = uint128(MINIMUM_CUSTOM_PRICE);
        params.maximumPrice = uint128(200 * ONE_ETHER);
        params.priceMaxPeriod = 365 days;
    }
}

contract TempleSacrificeAccessTest is TempleSacrificeTestBase {

    function test_access_setSacrificedTokenRecipientFail(address caller) public {
        vm.assume(caller != executor);
        vm.startPrank(caller);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAccess.selector));
        templeSacrifice.setSacrificedTokenRecipient(alice);
    }

    function test_access_setSacrificedTokenRecipientSuccess() public {
        vm.startPrank(executor);
        templeSacrifice.setSacrificedTokenRecipient(alice);
    }
}

contract TempleSacrificeTest is TempleSacrificeTestBase {

    function _calculatePrice(
        TempleSacrifice.PriceParam memory params
    ) private view returns (uint256 price) {
        uint256 timeDifference =  block.timestamp - templeSacrifice.originTime();
        price = (timeDifference * params.maximumPrice / params.priceMaxPeriod) + params.minimumPrice;
        if (price > params.maximumPrice) {
            price = params.maximumPrice;
        }
    }

    function test_setSacrificedTokenRecipient() public {
        vm.startPrank(executor);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidParam.selector));
        templeSacrifice.setSacrificedTokenRecipient(address(0));
        vm.expectEmit(address(templeSacrifice));
        emit TokenRecipientSet(bob);
        templeSacrifice.setSacrificedTokenRecipient(bob);
        assertEq(templeSacrifice.sacrificedTokenRecipient(), bob);
    }

    function test_sacrifice() public {
        vm.startPrank(executor);
        uint64 originTime = uint64(block.timestamp + 100);
        templeSacrifice.setOriginTime(originTime);

        vm.expectRevert(abi.encodeWithSelector(IBaseSacrifice.FutureOriginTime.selector, originTime));
        templeSacrifice.sacrifice(CHAOS_ID);
        
        vm.warp(originTime - 1);
        vm.expectRevert(abi.encodeWithSelector(IBaseSacrifice.FutureOriginTime.selector, originTime));
        templeSacrifice.sacrifice(CHAOS_ID);

        vm.warp(originTime + 1);
        TempleSacrifice.PriceParam memory params = _getPriceParams();
        templeSacrifice.setPriceParams(params);

        // ERC20: insufficient allowance
        vm.expectRevert("ERC20: insufficient allowance");
        templeSacrifice.sacrifice(CHAOS_ID);
        changePrank(bob);
        _mintTemple(alice, 1_000 ether);
        changePrank(executor);
        templeSacrifice.setSacrificedTokenRecipient(bob);
        changePrank(alice);
        sacrificeToken.approve(address(templeSacrifice), 1_000 ether);
        uint256 aliceTempleBalanceBefore = sacrificeToken.balanceOf(alice);
        uint256 recipientBalanceBefore = sacrificeToken.balanceOf(bob);

        vm.warp(originTime);
        uint256 price = templeSacrifice.getPrice();
        vm.expectEmit(address(templeSacrifice));
        emit TokenSacrificed(alice, price);
        templeSacrifice.sacrifice(CHAOS_ID);
        assertEq(price, _calculatePrice(params));
        assertEq(sacrificeToken.balanceOf(alice), aliceTempleBalanceBefore - price);
        assertEq(sacrificeToken.balanceOf(bob), recipientBalanceBefore + price);
    }
}