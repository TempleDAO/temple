pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// (tests/forge/templegold/TempleTeleporter.t.sol)

// OFT imports
import { MessagingFee } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/OFTCore.sol";

// OApp imports
import { OptionsBuilder } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OptionsBuilder.sol";

// Temple Gold imports
import { TempleTeleporter } from "contracts/templegold/TempleTeleporter.sol";
import { TempleERC20Token } from "contracts/core/TempleERC20Token.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";

// DevTools imports -- needs to use the local version to avoid stack too deep
import { TestHelperOz5 } from "test/forge/lz-devtools/TestHelperOz5.sol";

contract TempleTeleporterTest is TestHelperOz5 {
    using OptionsBuilder for bytes;

    uint32 aEid = 1;
    uint32 bEid = 2;

    TempleTeleporter public aTT;
    TempleTeleporter public bTT;
    TempleERC20Token public aTemple;
    TempleERC20Token public bTemple;


    address public userA = address(0x1);
    address public userB = address(0x2);
    uint256 public initialBalance = 100 ether;

    function setUp() public virtual override {
        aTemple = new TempleERC20Token();
        bTemple = new TempleERC20Token();

        vm.deal(userA, 1000 ether);
        vm.deal(userB, 1000 ether);

        super.setUp();
        setUpEndpoints(2, LibraryType.UltraLightNode);
        aTT = TempleTeleporter(
            payable(_deployOApp(type(TempleTeleporter).creationCode, abi.encode(address(this), address(aTemple), address(endpoints[aEid]))))
        );
        bTT = TempleTeleporter(
            payable(_deployOApp(type(TempleTeleporter).creationCode, abi.encode(address(this), address(bTemple), address(endpoints[bEid]))))
        );

        // config and wire the ofts
        address[] memory ofts = new address[](2);
        ofts[0] = address(aTT);
        ofts[1] = address(bTT);
        this.wireOApps(ofts);

        // mint tokens
        aTemple.addMinter(address(this));
        bTemple.addMinter(address(this));
        aTemple.addMinter(address(aTT));
        bTemple.addMinter(address(bTT));
        aTemple.mint(userA, initialBalance);
        bTemple.mint(userB, initialBalance);
    }

    function test_teleport() public {
        uint256 tokensToSend = 1 ether;
        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(200000, 0);
        MessagingFee memory fee = aTT.quote(bEid, abi.encode(userB, tokensToSend), options);
        vm.startPrank(userA);
        aTemple.approve(address(aTT), type(uint).max);
        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.InvalidAddress.selector));
        aTT.teleport{ value: fee.nativeFee }(bEid, address(0), tokensToSend, options);

        vm.expectRevert(abi.encodeWithSelector(CommonEventsAndErrors.ExpectedNonZero.selector));
        aTT.teleport{ value: fee.nativeFee }(bEid, userB, 0, options);

        aTT.teleport{ value: fee.nativeFee }(bEid, userB, tokensToSend, options);
        verifyPackets(bEid, addressToBytes32(address(bTT)));

        assertEq(bTemple.balanceOf(userB), initialBalance + tokensToSend);
        assertEq(aTemple.balanceOf(userA), initialBalance - tokensToSend);

        // using quoteRaw gives same fee
        MessagingFee memory feeRaw = aTT.quote(bEid, userB, tokensToSend, options);
        assertEq(feeRaw.lzTokenFee, fee.lzTokenFee);
        assertApproxEqAbs(feeRaw.nativeFee, fee.nativeFee, 20);

        // user A teleports to self
        aTT.teleport{ value: fee.nativeFee }(bEid, userA, tokensToSend, options);
        verifyPackets(bEid, addressToBytes32(address(bTT)));
        assertEq(bTemple.balanceOf(userA), tokensToSend);
        assertEq(aTemple.balanceOf(userA), initialBalance - 2 * tokensToSend);
    }
}