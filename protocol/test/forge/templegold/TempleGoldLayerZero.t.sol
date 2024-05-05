pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// (tests/forge/templegold/TempleGoldLayerZero.t.sol)

import { Packet } from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ISendLib.sol";
import { OptionsBuilder } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OptionsBuilder.sol";
import { MessagingFee } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OApp.sol";
import { MessagingReceipt } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OAppSender.sol";
// The unique path location of your OApp
// import { MyOApp } from "../../contracts/MyOApp.sol";
import { TempleGold } from "contracts/templegold/TempleGold.sol";
import { TestHelperOz5 } from "@layerzerolabs/test-devtools-evm-foundry/contracts/TestHelperOz5.sol";

import "forge-std/console.sol";

contract TempleGoldLayerZeroTestBase is TestHelperOz5 {
    using OptionsBuilder for bytes;

    // Declaration of mock endpoint IDs.
    uint16 aEid = 1;
    uint16 bEid = 2;

    // Declaration of mock contracts.
    TempleGold public aTempleGold; // OApp A
    TempleGold public bTempleGold; // OApp B


    /// @notice Calls setUp from TestHelper and initializes contract instances for testing.
    function setUp() public virtual override {
        super.setUp();

        // Setup function to initialize 2 Mock Endpoints with Mock MessageLib.
        setUpEndpoints(2, LibraryType.UltraLightNode);

        // Initializes 2 OApps; one on chain A, one on chain B.
        address[] memory sender = setupOApps(type(TempleGold).creationCode, 1, 2);
        aMyOApp = TempleGold(payable(sender[0]));
        bMyOApp = TempleGold(payable(sender[1]));
    }

    /// @notice Tests the send and multi-compose functionality of MyOApp.
    /// @dev Simulates message passing from A -> B and checks for data integrity.
    function test_send() public {
        // Setup variable for data values before calling send().
        string memory dataBefore = aTempleGold.data();

        // Generates 1 lzReceive execution option via the OptionsBuilder library.
        // STEP 0: Estimating message gas fees via the quote function.
        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(150000, 0);
        MessagingFee memory fee = aTempleGold.quote(bEid, "test message", options, false);

        // STEP 1: Sending a message via the _lzSend() method.
        MessagingReceipt memory receipt = aTempleGold.send{ value: fee.nativeFee }(bEid, "test message", options);

        // Asserting that the receiving OApps have NOT had data manipulated.
        assertEq(bTempleGold.data(), dataBefore, "shouldn't be changed until lzReceive packet is verified");

        // STEP 2 & 3: Deliver packet to bTempleGold manually.
        verifyPackets(bEid, addressToBytes32(address(bMyOApp)));

        // Asserting that the data variable has updated in the receiving OApp.
        assertEq(bMyOApp.data(), "test message", "lzReceive data assertion failure");
    }
}