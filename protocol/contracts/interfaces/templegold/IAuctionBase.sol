pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/core/IAuctionBase.sol)

interface IAuctionBase {
    event Deposit(address indexed depositor, uint256 epochId, uint256 amount);
    event Claim(address indexed user, uint256 epochId, uint256 bidTokenAmount, uint256 auctionTokenAmount);

    struct EpochInfo {
        /// @notice Start time for epoch
        uint64 startTime;
        /// @notice End time for epoch
        uint64 endTime;
        /// @notice Total amount of bid token deposited
        uint256 totalBidTokenAmount;
        /// @notice Total amount of auction tokens to distribute. Constant value
        uint256 totalAuctionTokenAmount;
    }

    /**
     * @notice Deposit bidding token for current running epoch auction
     * @param amount Amount of bid token to deposit
     */
    function deposit(uint256 amount) external;

    /**
     * @notice Claim share of Temple Gold for epoch
     * Can only claim for past epochs, not current auction epoch.
     * @param epochId Id of epoch
     */
    function claim(uint256 epochId) external;

    /**
     * @notice Start auction. Auction start can be triggered by anyone if `auctionStarter` not set
     * Uses up to date distributed Temple Gold tokens since last auction as total Temple Gold for distribution
     */
    function startAuction() external;

    /**
     * @notice Get current epoch
     * @return Epoch Id
     */
    function currentEpoch() external view returns (uint256);
}