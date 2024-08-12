pragma solidity ^0.8.18;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/SpiceAuctionMock.sol)


import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { ITempleGold } from "contracts/interfaces/templegold/ITempleGold.sol";
import { SendParam } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/interfaces/IOFT.sol";
import { MessagingFee } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/OFTCore.sol";
import { OptionsBuilder } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OptionsBuilder.sol";

/** 
 * @title SpiceAuction
 * @notice Temple Gold is deposited into this contract to bid on a share of distributed Spice token, 
 * or vice versa, for an epoch. Temple Gold can be the bid or auction token at any auction epoch.
 * Reward tokens acquired in past epochs can always be claimed. Once bid, users cannot
 * claim their bid token and can only claim their share of reward token for epoch after epoch finishes.
 * Bid and auction tokens could change per auction. These are set in `AuctionConfig`. 
 * Config is set before the next auction starts using `setAuctionConfig` by DAO execution.
 */
contract SpiceAuctionMock {
    using SafeERC20 for IERC20;
    using OptionsBuilder for bytes;

    /// @notice Temple GOLD
    address public immutable templeGold;

    /// @notice Auctions run for minimum 1 week
    uint32 public constant MINIMUM_AUCTION_PERIOD = 1 weeks;
    /// @notice Maximum wait period between last and next auctions
    uint32 public constant MAXIMUM_AUCTION_WAIT_PERIOD = 90 days;
    /// @notice Maximum auction duration
    uint32 public constant MAXIMUM_AUCTION_DURATION = 30 days;
    uint32 private immutable _arbitrumOneLzEid;
    uint32 private immutable _mintChainId;
    uint32 public lzReceiveExecutorGas;

    /// @notice If true, let first claim for an auction notify total TGLD redeemed
    bool public claimShouldNotifyTotalRedeemed;

    /// @notice Name of this Spice Bazaar auction
    string public name;

    /// @notice Last time auction was started. For zero auctions, it is the contract deploy timestamp
    uint256 private immutable _deployTimestamp;

    event RedeemedTempleGoldBurned(uint256 amount);
    error ExpectedNonZero();
    error WithdrawFailed(uint256 amount);

    constructor(
        address _templeGold,
        uint32 _arbEid,
        uint32 mintChainId_,
        string memory _name
    ) {
        templeGold = _templeGold;
        _arbitrumOneLzEid = _arbEid;
        _mintChainId = mintChainId_;
        name = _name;
        _deployTimestamp = block.timestamp;
        lzReceiveExecutorGas = 85_412;
    }

    /// @notice withdraw ETH used for layer zero sends
    function withdrawEth(address payable _to, uint256 _amount) external {
        (bool success,) = _to.call{ value: _amount }("");
        if (!success) { revert WithdrawFailed(_amount); }
    }

    /**
     * @notice Burn redeemd TGLD and notify circulating supply
     * @param amount Amount
     * @param useContractEth If to use contract eth for layerzero send
     */
    function burnAndNotify(uint256 amount, bool useContractEth) external payable {
        if (amount == 0) { revert ExpectedNonZero(); }
        
        emit RedeemedTempleGoldBurned(amount);
        _burnAndNotify(amount, useContractEth);
    }

    function _burnAndNotify(uint256 amount, bool useContractEth) private {
        // burn directly and call TempleGold to update circulating supply
        if (block.chainid == _mintChainId) {
            ITempleGold(templeGold).burn(amount);
            return;
        }
        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(lzReceiveExecutorGas, 0);
        SendParam memory sendParam = SendParam(
            _arbitrumOneLzEid, //<ARB_EID>,
            bytes32(uint256(uint160(address(0)))), // bytes32(address(0)) to burn
            amount,
            amount, // todo
            options,
            bytes(""), // compose message
            ""
        );
        MessagingFee memory fee = ITempleGold(templeGold).quoteSend(sendParam, false);
        if (useContractEth && address(this).balance < fee.nativeFee) {
            revert CommonEventsAndErrors.InsufficientBalance(address(0), fee.nativeFee, address(this).balance);
        } else if (!useContractEth && msg.value < fee.nativeFee) {
            revert CommonEventsAndErrors.InsufficientBalance(address(0), fee.nativeFee, msg.value); 
        }

        if (useContractEth) {
            ITempleGold(templeGold).send{ value: fee.nativeFee }(sendParam, fee, payable(address(this)));
        } else {
            ITempleGold(templeGold).send{ value: fee.nativeFee }(sendParam, fee, payable(msg.sender));
            uint256 leftover;
            unchecked {
                leftover = msg.value - fee.nativeFee;
            }
            if (leftover > 0) { 
                (bool success,) = payable(msg.sender).call{ value: leftover }("");
                if (!success) { revert WithdrawFailed(leftover); }
            }
        }
    }

    // allow this contract to receive ether
    receive() external payable {}
}