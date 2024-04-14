pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/core/ITempleTeleporter.sol)

import { MessagingReceipt } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OAppSender.sol";

interface ITempleTeleporter {
    event TempleTeleported(uint32 dstEid, address indexed sender, address indexed recipient, uint256 amount);

    /**
     * @notice Teleport temple tokens cross chain
     * @dev Temple tokens are burned from source chain and minted on destination chain
     * @param dstEid Destination chain id
     * @param to Recipient
     * @param amount Amount of tokens
     */
    function teleport(
        uint32 dstEid,
        address to,
        uint256 amount,
        bytes calldata options
    ) external payable returns(MessagingReceipt memory receipt);
}