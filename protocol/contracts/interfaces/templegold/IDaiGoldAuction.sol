pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/core/IDaiGoldAuction.sol)

interface IDaiGoldAuction {
    event AuctionStart(uint256 epochId, uint64 timestamp, uint64 endTime, uint256 totalTGoldAmount);
    event BidTokenSet(address bidToken);
    event BidForfeited(address indexed sender, uint256 epochId, uint256 amount);
    event AuctionEnded(uint256 epochId);
    event AuctionStartCooldownSet(uint256 cooldown);
    event AuctionMinimumDistributedGoldSet(uint256 minGold);
    event AuctionMinimumWaitPeriodSet(uint256 watPeriod);
    event GoldDistributionNotified(uint256 amount, uint256 timestamp);
    event AuctionConfigSet(AuctionConfig config);

    error BidNotLive();
    error BidLive();
    error InvalidEpoch();
    error CannotClaim(uint256 epochId);
    error CannotStartAuction();
    error CannotDeposit();
    error CannotWithdraw();
    error LowGoldDistributed(uint256 epochGoldAmount);

    struct AuctionConfig {
        /// @notice Duration of auction
        uint32 auctionDuration; // todo make deterministic. same time to start and end, bi weekly and lasts for 1 week each auction
        /// @notice Minimum time between successive auctions
        uint32 auctionMinimumWaitPeriod; // todo should be a regular occurence eg. every week, etc
        /// @notice Cooldown after auction start is triggered, to allow deposits
        uint32 auctionStartCooldown;
        /// @notice Minimum Gold distributed to enable auction start
        uint160 auctionMinimumDistributedGold;
    }

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
}