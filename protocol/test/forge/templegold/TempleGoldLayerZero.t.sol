pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// (tests/forge/templegold/TempleGoldLayerZero.t.sol)

// OApp imports
import { OptionsBuilder } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OptionsBuilder.sol";

// OFT imports
import { SendParam, OFTReceipt } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/interfaces/IOFT.sol";
import { MessagingFee, MessagingReceipt } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/OFTCore.sol";

// TempleGold imports
import { TempleGoldMock } from "contracts/fakes/templegold/TempleGoldMock.sol";
import { ITempleGold } from "contracts/interfaces/templegold/ITempleGold.sol";
// Spice
import { SpiceAuctionMock } from "contracts/fakes/templegold/SpiceAuctionMock.sol";

// DevTools imports -- needs to use the local version to avoid stack too deep
import { TestHelperOz5 } from "test/forge/lz-devtools/TestHelperOz5.sol";

contract TempleGoldLayerZeroTest is TestHelperOz5 {
    using OptionsBuilder for bytes;

    uint32 aEid = 1;
    uint32 bEid = 2;

    TempleGoldMock public aTempleGold;
    TempleGoldMock public bTempleGold;

    SpiceAuctionMock public aSpice;
    SpiceAuctionMock public bSpice;

    address public userA = address(0x1);
    address public userB = address(0x2);
    uint256 public initialBalance = 100 ether;

    event RedeemedTempleGoldBurned(uint256 amount);
    function setUp() public virtual override {
        vm.deal(userA, 1000 ether);
        vm.deal(userB, 1000 ether);
        
        super.setUp();
       
        setUpEndpoints(2, LibraryType.UltraLightNode);
        aTempleGold = TempleGoldMock(
            _deployOApp(type(TempleGoldMock).creationCode, abi.encode(address(endpoints[aEid]), address(this), "aTempleGold", "aTGOLD"))
        );
        bTempleGold = TempleGoldMock(
            _deployOApp(type(TempleGoldMock).creationCode, abi.encode(address(endpoints[bEid]), address(this), "bTempleGold", "bTGOLD"))
        );
        // todo check mintchainId
        uint mintChainId = aEid;
        aSpice = SpiceAuctionMock(
            payable(_deployOApp(type(SpiceAuctionMock).creationCode, abi.encode(address(aTempleGold), aEid, mintChainId, "aSpice")))
        );
        // mintChainId = bEid;
        // use aEid as source chain eid
        bSpice = SpiceAuctionMock(
            payable(_deployOApp(type(SpiceAuctionMock).creationCode, abi.encode(address(bTempleGold), aEid, mintChainId, "bSpice")))
        );

        // config and wire the ofts
        address[] memory ofts = new address[](2);
        ofts[0] = address(aTempleGold);
        ofts[1] = address(bTempleGold);
        this.wireOApps(ofts);

        // mint tokens
        aTempleGold.mint(userA, initialBalance);
        bTempleGold.mint(userB, initialBalance);
        aTempleGold.mint(address(aSpice), initialBalance);
        bTempleGold.mint(address(bSpice), initialBalance);
    }

    function test_send_tgld() public {
        uint256 tokensToSend = 1 ether;
        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(200000, 0);
        SendParam memory sendParam = SendParam(
            bEid,
            addressToBytes32(userB),
            tokensToSend,
            tokensToSend,
            options,
            bytes("something"), // compose message
            ""
        );
        MessagingFee memory fee = aTempleGold.quoteSend(sendParam, false);

        vm.startPrank(userA);
        vm.expectRevert(abi.encodeWithSelector(ITempleGold.CannotCompose.selector));
        aTempleGold.send{ value: fee.nativeFee }(sendParam, fee, payable(address(this)));
        sendParam.composeMsg = "";
        
        vm.expectRevert(abi.encodeWithSelector(ITempleGold.NonTransferrable.selector, userA, userB));
        aTempleGold.send{ value: fee.nativeFee }(sendParam, fee, payable(address(this)));

        sendParam.to = addressToBytes32(userA);

        vm.startPrank(userA);
        (MessagingReceipt memory msgReceipt,) =
             aTempleGold.send{ value: fee.nativeFee }(sendParam, fee, payable(address(this)));
        emit log_string("messaging receipt");
        emit log_bytes32(msgReceipt.guid);
        verifyPackets(bEid, addressToBytes32(address(bTempleGold)));

        assertEq(aTempleGold.balanceOf(userA), initialBalance - tokensToSend);
        assertEq(bTempleGold.balanceOf(userB), initialBalance);
        assertEq(bTempleGold.balanceOf(userA), tokensToSend);

        vm.startPrank(userB);
        sendParam.dstEid = aEid;
        vm.expectRevert(abi.encodeWithSelector(ITempleGold.NonTransferrable.selector, userB, userA));
        bTempleGold.send{ value: fee.nativeFee }(sendParam, fee, payable(address(this)));

        sendParam.to = addressToBytes32(userB);
        bTempleGold.send{ value: fee.nativeFee }(sendParam, fee, payable(address(this)));
        verifyPackets(bEid, addressToBytes32(address(bTempleGold)));
        assertEq(aTempleGold.balanceOf(userA), initialBalance - tokensToSend);
        assertEq(bTempleGold.balanceOf(userB), initialBalance - tokensToSend);
        assertEq(bTempleGold.balanceOf(userA), tokensToSend);
    }

    function test_redemption_cross_chain() public {
        uint256 amount = 10 ether;
        uint256 etherAmount = 5 ether;
        vm.deal(address(aSpice), etherAmount);
        vm.deal(address(bSpice), etherAmount);
        vm.deal(address(this), etherAmount);

        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(100_000, 0);
        SendParam memory sendParam = SendParam(
            aEid, //<ARB_EID>,
            bytes32(uint256(uint160(address(0)))), // bytes32(address(0)) to burn
            amount,
            amount,
            options,
            bytes(""), // compose message
            ""
        );
        MessagingFee memory fee = TempleGoldMock(bTempleGold).quoteSend(sendParam, false);

        // aTempleGold is source 
        uint256 circulatingSupplyBefore = aTempleGold.circulatingSupply();
        // use contract ether
        bSpice.burnAndNotify(amount, true);
        verifyPackets(aEid, addressToBytes32(address(aTempleGold)));
        assertEq(circulatingSupplyBefore-amount, aTempleGold.circulatingSupply());
        assertLt(address(bSpice).balance, etherAmount);

        // use msg.value
        circulatingSupplyBefore = aTempleGold.circulatingSupply();
        // drain eth
        bSpice.withdrawEth(payable(address(this)), address(bSpice).balance);
        uint256 balanceBefore = address(this).balance;
        uint256 spiceBalanceBefore = address(bSpice).balance;
        vm.expectEmit(address(bSpice));
        emit RedeemedTempleGoldBurned(amount);
        bSpice.burnAndNotify{value: fee.nativeFee }(amount, false);
        verifyPackets(aEid, addressToBytes32(address(aTempleGold)));

        assertEq(circulatingSupplyBefore-amount, aTempleGold.circulatingSupply());
        assertEq(spiceBalanceBefore, address(bSpice).balance);
        assertLt(address(this).balance, balanceBefore);
        assertEq(address(bSpice).balance, 0);
    }
}