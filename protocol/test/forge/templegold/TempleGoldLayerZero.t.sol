pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// (tests/forge/templegold/TempleGoldLayerZero.t.sol)

// OApp imports
import { OptionsBuilder } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OptionsBuilder.sol";

// OFT imports
import { SendParam } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/interfaces/IOFT.sol";
import { MessagingFee } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/OFTCore.sol";

// TempleGold imports
import { TempleGoldMock } from "contracts/fakes/templegold/TempleGoldMock.sol";
import { ITempleGold } from "contracts/interfaces/templegold/ITempleGold.sol";

// DevTools imports -- needs to use the local version to avoid stack too deep
import { TestHelperOz5 } from "test/forge/lz-devtools/TestHelperOz5.sol";

contract TempleGoldLayerZeroTest is TestHelperOz5 {
    using OptionsBuilder for bytes;

    uint32 aEid = 1;
    uint32 bEid = 2;

    TempleGoldMock public aTempleGold;
    TempleGoldMock public bTempleGold;

    address public userA = address(0x1);
    address public userB = address(0x2);
    uint256 public initialBalance = 100 ether;
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

        // config and wire the ofts
        address[] memory ofts = new address[](2);
        ofts[0] = address(aTempleGold);
        ofts[1] = address(bTempleGold);
        this.wireOApps(ofts);

        // mint tokens
        aTempleGold.mint(userA, initialBalance);
        bTempleGold.mint(userB, initialBalance);
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
        aTempleGold.send{ value: fee.nativeFee }(sendParam, fee, payable(address(this)));
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
}