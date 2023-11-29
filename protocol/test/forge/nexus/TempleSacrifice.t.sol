pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (tests/forge/nexus/TempleSacrifice.t.sol)

import { NexusTestBase } from "./Nexus.t.sol";
import { Relic } from "../../../contracts/nexus/Relic.sol";
import { Shard } from "../../../contracts/nexus/Shard.sol";
import { NexusCommon } from "../../../contracts/nexus/NexusCommon.sol";
import { TempleSacrifice } from "../../../contracts/nexus/TempleSacrifice.sol";
import { TempleERC20Token } from "../../../contracts/core/TempleERC20Token.sol";
import { CommonEventsAndErrors } from "../../../contracts/common/CommonEventsAndErrors.sol";
import { ISacrifice } from "../../../contracts/interfaces/nexus/IBaseSacrifice.sol";


contract TempleSacrificeTestBase is NexusTestBase {

    Relic public relic;
    Shard public shard;
    NexusCommon public nexusCommon;
    TempleSacrifice public templeSacrifice;
    TempleERC20Token public sacrificeToken; 

    uint256 internal constant MINIMUM_CUSTOM_PRICE = 30 ether;
    uint256 internal constant ONE_ETHER = 1 ether;
    uint256 internal constant PRICE_MAX_PERIOD = 365 days;

    event OriginTimeSet(uint64 originTime);
    event CustomPriceSet(uint256 price);
    event TokenSacrificed(address indexed fromAccount, address indexed token, uint256 amount);
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
    event RelicMinted(address indexed to, uint256 relicId, uint256 enclaveId);

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
        address to = alice;

        vm.expectRevert(abi.encodeWithSelector(ISacrifice.FutureOriginTime.selector, originTime));
        templeSacrifice.sacrifice(CHAOS_ID, to);
        
        vm.warp(originTime - 1);
        vm.expectRevert(abi.encodeWithSelector(ISacrifice.FutureOriginTime.selector, originTime));
        templeSacrifice.sacrifice(CHAOS_ID, to);

        vm.warp(originTime + 1);
        TempleSacrifice.PriceParam memory params = _getPriceParams();
        templeSacrifice.setPriceParams(params);

        // address(0)
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        templeSacrifice.sacrifice(CHAOS_ID, address(0));

        // ERC20: insufficient allowance
        vm.expectRevert("ERC20: insufficient allowance");
        templeSacrifice.sacrifice(CHAOS_ID, to);
        vm.startPrank(bob);
        _mintTemple(alice, 1_000 ether);
        vm.startPrank(executor);
        templeSacrifice.setSacrificedTokenRecipient(bob);
        vm.startPrank(alice);
        sacrificeToken.approve(address(templeSacrifice), 1_000 ether);
        uint256 aliceTempleBalanceBefore = sacrificeToken.balanceOf(alice);
        uint256 recipientBalanceBefore = sacrificeToken.balanceOf(bob);

        uint256 relicId = relic.nextTokenId();
        vm.warp(originTime);
        uint256 price = templeSacrifice.getPrice();
        vm.expectEmit(address(relic));
        emit RelicMinted(to, relicId, CHAOS_ID);
        vm.expectEmit(address(templeSacrifice));
        emit TokenSacrificed(alice, address(sacrificeToken), price);
        uint256 actualRelicId = templeSacrifice.sacrifice(CHAOS_ID, to);
        assertEq(actualRelicId, relicId);
        assertEq(price, _calculatePrice(params));
        assertEq(sacrificeToken.balanceOf(alice), aliceTempleBalanceBefore - price);
        assertEq(sacrificeToken.balanceOf(bob), recipientBalanceBefore + price);
        assertEq(relic.ownerOf(relicId), to);
    }
}