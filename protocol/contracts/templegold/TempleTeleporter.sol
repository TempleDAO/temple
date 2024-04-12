pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/TempleTeleporter.sol)


import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { IERC20 } from  "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ITempleERC20Token } from "contracts/interfaces/core/ITempleERC20Token.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { OApp } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OApp.sol";
import { MessagingReceipt, MessagingFee } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OAppSender.sol";
import { Origin } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/interfaces/IOAppReceiver.sol";

contract TempleTeleporter is OApp {

    ITempleERC20Token public immutable temple;

    event TempleTeleported(uint32 dstEid, address indexed sender, address indexed recipient, uint256 amount);
    constructor(
        address _executor,
        address _temple,
        address _endpoint
    ) Ownable(_executor) OApp(_endpoint, _executor){
        temple = ITempleERC20Token(_temple);
    }

    function teleport(
        uint32 dstEid,
        address to,
        uint256 amount,
        bytes calldata options
    ) external payable returns(MessagingReceipt memory receipt) {
        if (amount == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        if (to == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        // Encodes the message before invoking _lzSend.
        bytes memory _payload = abi.encodePacked(to, amount);
        // debit
        temple.burnFrom(msg.sender, amount);
        emit TempleTeleported(dstEid, msg.sender, to, amount);

        receipt = _lzSend(dstEid, _payload, options, MessagingFee(msg.value, 0), payable(msg.sender));
    }

    /// @dev Called when data is received from the protocol. It overrides the equivalent function in the parent contract.
    /// Protocol messages are defined as packets, comprised of the following parameters.
    /// @param _origin A struct containing information about where the packet came from.
    /// @param _payload Encoded message.
    function _lzReceive(
        Origin calldata _origin,
        bytes32 /*_guid*/,
        bytes calldata _payload,
        address /*_executor,*/,  // Executor address as specified by the OApp.
        bytes calldata /*_extraData */ // Any extra data or options to trigger on receipt.
    ) internal override {
        _origin;
        // Decode the payload to get the message
        (address _recipient, uint256 _amount) = abi.decode(_payload, (address, uint256));
        temple.mint(_recipient, _amount);

        // todo: Send a composed message[0] to a composed receiver?
        // endpoint.sendCompose(_composedAddress, _guid, 0, payload);
    }
}