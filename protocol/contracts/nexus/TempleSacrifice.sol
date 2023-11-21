pragma solidity 0.8.19;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (nexus/TempleSacrifice.sol)

import { IRelic } from "../interfaces/nexus/IRelic.sol";
import { ITempleSacrifice } from "../interfaces/nexus/ITempleSacrifice.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ElevatedAccess } from "./access/ElevatedAccess.sol";
import { BaseSacrifice } from "./BaseSacrifice.sol";
import { CommonEventsAndErrors } from "../common/CommonEventsAndErrors.sol";

/**
 * @notice A user sacrifices Tokens in order to mint a Relic
 * The amount required to sacrifice is based on a time increasing rate unless
 * otherwise overridden
 */
contract TempleSacrifice is ITempleSacrifice, BaseSacrifice {
    using SafeERC20 for IERC20;
    /// @notice the Relic ERC721A token
    IRelic public immutable relic;
    /// @notice the temple token used for payment in minting a relic
    IERC20 public immutable sacrificeToken;
    /// @notice send sacrificed temple to this address
    address public sacrificedTokenRecipient;

    constructor(
        address _relic,
        address _token,
        address _sacrificedTokenRecipient,
        address _executor
    ) ElevatedAccess(_executor) {
        relic = IRelic(_relic);
        sacrificeToken = IERC20(_token);
        sacrificedTokenRecipient = _sacrificedTokenRecipient;
    }

    /*
     * @notice Set sacrificed temple recipient.
     * @param recipient Recipient
     */
    function setSacrificedTokenRecipient(address recipient) external override onlyElevatedAccess {
        if (recipient == address(0)) { revert CommonEventsAndErrors.InvalidParam(); }
        sacrificedTokenRecipient = recipient;
        emit TokenRecipientSet(recipient);
    }

    /*
     * @notice Sacrifice tokens to mint a Relic
     * Caller must approve contract to spend tokens.
     * @param enclaveId Enclave ID 
     * @param to Destination address
     */
    function sacrifice(uint256 enclaveId, address to) external override returns (uint256 relicId) {
        if (block.timestamp < originTime) { revert FutureOriginTime(originTime); }
        if (to == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }

        uint256 amount = _getPrice(customPrice, originTime);
        sacrificeToken.safeTransferFrom(msg.sender, sacrificedTokenRecipient, amount);

        relicId = relic.mintRelic(to, enclaveId);
        emit TokenSacrificed(msg.sender, address(sacrificeToken), amount);
    }
}