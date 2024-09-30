pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/templegold/IDaiGoldAuction.sol)

import { IAuctionBase } from "contracts/interfaces/templegold/IAuctionBase.sol";
import { ITempleGold } from "contracts/interfaces/templegold/ITempleGold.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
interface IDaiGoldAuction is IAuctionBase {
    event BidTokenSet(address bidToken);
    event GoldDistributionNotified(uint256 amount, uint256 timestamp);
    event AuctionConfigSet(uint256 epochId, AuctionConfig config);
    event AuctionStarterSet(address indexed starter);

    error LowGoldDistributed(uint256 epochGoldAmount);

    struct AuctionConfig {
        /// @notice Time diff between two auctions. Usually 2 weeks
        uint32 auctionsTimeDiff;
        /// @notice Cooldown after auction start is triggered, to allow deposits
        uint32 auctionStartCooldown;
        /// @notice Minimum Gold distributed to enable auction start
        uint192 auctionMinimumDistributedGold;
    }

    /// @notice Temple Gold address
    function templeGold() external view returns (ITempleGold);

    /// @notice Token to bid for Temple GOLD
    function bidToken() external view returns (IERC20);

    /// @notice Destination address for proceeds of auctions
    function treasury() external view returns (address);

    /// @notice Address that can trigger start of auction. address(0) means anyone
    function auctionStarter() external view returns (address);

    /// @notice Keep track of next epoch auction Temple Gold amount
    function nextAuctionGoldAmount() external view returns (uint256);

    /**
     * @notice Recover auction tokens for epoch with zero bids
     * @param epochId Epoch Id
     * @param to Recipient
     */
    function recoverTempleGoldForZeroBidAuction(uint256 epochId, address to) external;

    /**
     * @notice Get auction configuration
     * @return Auction configuration
     */
    function getAuctionConfig() external view returns (AuctionConfig memory);

    /**
     * @notice Set auction configuration
     * @param _config Auction configuration
     */
    function setAuctionConfig(AuctionConfig calldata _config) external;

    /**
     * @notice Set token used for bidding
     * @param _bidToken Bid token
     */
    function setBidToken(address _bidToken) external;

    /**
     * @notice Set address to trigger auction start. Zero address accepted
     * @param _starter Auction starter
     */
    function setAuctionStarter(address _starter) external;

    /**
     * @notice Get Temple Gold supply for epoch
     * @param epochId Epoch Id
     * @return Temple Gold supply
     */
    function epochGoldSupply(uint256 epochId) external view returns (uint256);

    /**
     * @notice Get next epoch
     * @return Next epoch Id
     */
    function nextEpoch() external view returns (uint256);

    /**
     * @notice Check if current epoch ended. That is, if current auction ended.
     * @return Bool if epoch ended
     */
    function isCurrentEpochEnded() external view returns (bool);

     /**
     * @notice Checkpoint total Temple Gold distributed for next epoch.
     * Can only be called by Temple Gold contract
     * @param amount Amount of Temple Gold to checkpoint
     */
    function notifyDistribution(uint256 amount) external;

    /**
     * @notice Check if current auction epoch is allowing bid deposits
     * @return Bool if allowing deposit
     */
    function canDeposit() external view returns (bool);

    /**
     * @notice Mint and distribute TGLD 
     */
    function distributeGold() external;

    /**
     * @notice Get claimable amount for current epoch
     * @dev For current epoch, function will return claimable at current time. This can change with more user deposits
     * @param depositor Address to check amount for
     * @return Claimable amount
     */
    function getClaimableAtCurrentEpoch(address depositor) external view returns (uint256);

    /**
     * @notice Get claimable amount for an epoch
     * @dev For current epoch, function will return claimable at current time. This can change with more user deposits
     * @param depositor Address to check amount for
     * @param epochId Epoch id
     * @return Claimable amount
     */
    function getClaimableAtEpoch(address depositor, uint256 epochId) external view returns (uint256);

    /**
     * @notice Claim share of Temple Gold for epoch
     * Can only claim for past epochs, not current auction epoch.
     * @param epochId Id of epoch
     */
    function claim(uint256 epochId) external;
}