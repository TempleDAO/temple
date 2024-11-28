pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/templegold/ITempleTeleporter.sol)

import { MessagingReceipt, MessagingFee } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OAppSender.sol";
import { ITempleERC20Token } from "contracts/interfaces/core/ITempleERC20Token.sol";

interface ITempleTeleporter {
    event TempleTeleported(uint32 dstEid, address indexed sender, address indexed recipient, uint256 amount);

    /// @notice Temple token
    function temple() external view returns (ITempleERC20Token);

    /**
     * @notice Teleport temple tokens cross chain
     * @dev Temple tokens are burned from source chain and minted on destination chain
     * @param dstEid Destination chain id
     * @param to Recipient
     * @param amount Amount of tokens
     * @param options Additional options for the message
     */
    function teleport(
        uint32 dstEid,
        address to,
        uint256 amount,
        bytes calldata options
    ) external payable returns(MessagingReceipt memory receipt);

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
    ) external view returns (MessagingFee memory fee);

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
    ) external view returns (MessagingFee memory fee);
}