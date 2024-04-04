pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interface/templegold/ISpiceAuction.sol)


interface ISpiceAuction {
    event AuctionConfigSet(uint256 epoch, SpiceAuctionConfig config);
    event AuctionStarted(uint256 epochId, address indexed starter, uint64 startTime, uint64 endTime);
    event AuctionConfigRemoved(uint256 epochId);

    error InvalidConfigOperation(); 
    error NotEnoughAuctionTokens();
    error CannotStartAuction();
    error CannotDeposit();
    error CannotClaim(uint256 epochId);
    error MissingAuctionTokenConfig();
    error NoConfig();

    struct SpiceAuctionConfig {
        /// @notice Duration of auction
        uint32 duration;
        /// @notice Minimum time between successive auctions
        uint32 waitPeriod;
        /// @notice Cooldown after auction start is triggered, to allow deposits
        uint32 startCooldown;
        /// @notice Minimum Gold distributed to enable auction start
        uint160 minimumDistributedAuctionToken;
        /// @notice Address to start next auction when all criteria are met. Address zero means anyone can trigger start
        address starter;
        /// @notice Which token is the bid token
        AuctionToken auctionToken;
        /// @notice Mode of auction activation
        ActivationMode activationMode;
        /// @notice Auction proceeds recipient
        address recipient;
    }

    /// @notice uint(TOKEN_A) < uint(TOKEN_B)
    enum AuctionToken {
        TOKEN_A,
        TOKEN_B
    }

    enum ActivationMode {
        /// @notice Auction is enabled and awaiting start if amount of auction token is sent to contract
        AUCTION_TOKEN_BALANCE,
        /// @notice Enable auction when user bids for other volatile token
        USER_FIRST_BID
    }

    /// @notice Set config for an epoch. This enable dynamic and multiple auctions especially for vested scenarios
    /// Must be set before epoch auction starts
    function setAuctionConfig(SpiceAuctionConfig calldata _config) external;
    /// @notice Returns name of Spice Auction contract
    function NAME() external view returns (string memory);
    /// @notice Remove config set for 
    function removeAuctionConfig() external;
}