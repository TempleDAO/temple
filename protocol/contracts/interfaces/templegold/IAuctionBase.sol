pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/templegold/IAuctionBase.sol)


interface IAuctionBase {
    event Deposit(address indexed depositor, uint256 epochId, uint256 amount);
    event Claim(address indexed user, uint256 epochId, uint256 bidTokenAmount, uint256 auctionTokenAmount);
    event AuctionStarted(uint256 epochId, address indexed starter, uint128 startTime, uint128 endTime, uint256 auctionTokenAmount);
    
    error CannotDeposit();
    error CannotClaim(uint256 epochId);
    error CannotStartAuction();
    error InvalidEpoch();
    error AuctionActive();
    error InvalidOperation();
    error AuctionEnded();
    error AlreadyClaimed();
    error AlreadyRecovered();

    struct EpochInfo {
        /// @notice Start time for epoch
        uint128 startTime;
        /// @notice End time for epoch
        uint128 endTime;
        /// @notice Total amount of bid token deposited
        uint256 totalBidTokenAmount;
        /// @notice Total amount of auction tokens to distribute. Constant value
        uint256 totalAuctionTokenAmount;
    }

    /// @notice Keep track of epochs details
    function getEpochInfo(uint256 epochId) external returns (EpochInfo memory);
    /// @notice Keep track of depositors for each epoch
    function depositors(address depositor, uint256 epochId) external returns (uint256);
    /// @notice Keep track of claimed accounts per epoch
    function claimed(address depositor, uint256 epochId) external returns (bool);
    /// @notice claimed amounts
    function claimedAmount(address depositor, uint256 epochId) external returns (uint256);

    /**
     * @notice Deposit bid token for current running epoch auction
     * @param amount Amount of bid token to deposit
     */
    function bid(uint256 amount) external;

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

    /**
     * @notice Recover auction tokens for last but not started auction
     * @param token Token to recover
     * @param to Recipient
     * @param amount Amount to auction tokens
     */
    function recoverToken(address token, address to, uint256 amount) external;

    /// @notice Check if TGLD for epoch without bid is recovered
    function epochsWithoutBidsRecovered(uint256 epochId) external view returns (bool);
}