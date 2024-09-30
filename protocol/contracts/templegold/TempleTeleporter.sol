pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/TempleTeleporter.sol)


import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { ITempleERC20Token } from "contracts/interfaces/core/ITempleERC20Token.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { OApp } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OApp.sol";
import { MessagingReceipt, MessagingFee } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OAppSender.sol";
import { Origin } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/interfaces/IOAppReceiver.sol";
import { ITempleTeleporter } from "contracts/interfaces/templegold/ITempleTeleporter.sol";
import { OFTMsgCodec } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/libs/OFTMsgCodec.sol";

/** 
 * @title Temple Teleporter
 * @notice Temple Teleporter transfers Temple token cross-chain with layer zero integration.
 */
contract TempleTeleporter is ITempleTeleporter, OApp {
    using OFTMsgCodec for address;

    /// @notice Temple token
    ITempleERC20Token public immutable override temple;

    constructor(
        address _executor,
        address _temple,
        address _endpoint
    ) Ownable(_executor) OApp(_endpoint, _executor){
        temple = ITempleERC20Token(_temple);
    }

    /**
     * @notice Teleport temple tokens cross chain
     * Enough msg.value needs to be sent through to cover completing execution and the transfer by endpoint and on the destination chain. 
     * This value can be estimated via the `quote()` function.
     * @dev Temple tokens are burned from source chain and minted on destination chain
     * @param dstEid Destination chain id
     * @param to Recipient
     * @param amount Amount of tokens
     * @param options LZ extra options
     */
    function teleport(
        uint32 dstEid,
        address to,
        uint256 amount,
        bytes calldata options
    ) external payable override returns(MessagingReceipt memory receipt) {
        if (amount == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        if (to == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        // Encodes the message before invoking _lzSend.
        bytes memory _payload = abi.encodePacked(to.addressToBytes32(), amount);
        // debit
        temple.burnFrom(msg.sender, amount);
        emit TempleTeleported(dstEid, msg.sender, to, amount);

        receipt = _lzSend(dstEid, _payload, options, MessagingFee(msg.value, 0), payable(msg.sender));
    }

    /**
     * @dev External function to interact with the LayerZero EndpointV2.quote() for fee calculation.
     * @param _dstEid The destination endpoint ID.
     * @param _message The message payload.
     * @param _options Additional options for the message.
     * @return fee The calculated MessagingFee for the message.
     *      - nativeFee: The native fee for the message.
     *      - lzTokenFee: The LZ token fee for the message.
     */
    function quote(
        uint32 _dstEid,
        bytes memory _message,
        bytes memory _options
    ) external view returns (MessagingFee memory fee) {
        return _quote(_dstEid, _message, _options, false);
    }

    /**
     * @dev External function to interact with the LayerZero EndpointV2.quote() for fee calculation.
     * @param _dstEid The destination endpoint ID.
     * @param _to Recipient
     * @param _amount Amount to send
     * @param _options Additional options for the message.
     * @return fee The calculated MessagingFee for the message.
     *      - nativeFee: The native fee for the message.
     *      - lzTokenFee: The LZ token fee for the message.
     */
    function quote(
        uint32 _dstEid,
        address _to,
        uint256 _amount,
        bytes memory _options
    ) external view returns (MessagingFee memory fee) {
        return _quote(_dstEid, abi.encodePacked(_to.addressToBytes32(), _amount), _options, false);
    }

    /// @dev Called when data is received from the protocol. It overrides the equivalent function in the parent contract.
    /// Protocol messages are defined as packets, comprised of the following parameters.
    /// @param _payload Encoded message.
    function _lzReceive(
        Origin calldata /*_origin*/,
        bytes32 /*_guid*/,
        bytes calldata _payload,
        address /*_executor,*/,  // Executor address as specified by the OApp.
        bytes calldata /*_extraData */ // Any extra data or options to trigger on receipt.
    ) internal override {
        // Decode the payload to get the message
        (address _recipient, uint256 _amount) = abi.decode(_payload, (address, uint256));
        temple.mint(_recipient, _amount);
    }
}