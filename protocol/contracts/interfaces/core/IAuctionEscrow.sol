pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interfaces/core/IAuctionEscrow.sol)

interface IAuctionEscrow {
    event Deposit(address indexed sender, uint256 epochId, uint256 templeAmount);
    event Claim(address indexed sender, uint256 epochId, uint256 templeAmount, uint256 claimAmount);
    event AuctionStart(uint256 epochId, uint64 timestamp, uint64 endTime, uint256 totalTGoldAmount);
    event BidTokenSet(address bidToken);
    event BidForfeited(address indexed sender, uint256 epochId, uint256 amount);
    event AuctionEnded(uint256 epochId);

    error BidNotLive();
    error BidLive();
    error InvalidEpoch();
    error CannotClaim(uint256 epochId);
    error CannotStartAuction();
    error CannotDeposit();
    error CannotWithdraw();
    error LowGoldDistributed(uint256 epochGoldAmount);

    /**
     * @notice Set token used for bidding
     * @param _bidToken Bid token
     */
    function setBidToken(address _bidToken) external;

    /**
     * @notice Start auctioning of Temple Gold tokens.
     * Uses up to date distributed Temple Gold tokens since last auction as total Temple Gold for distribution
     * @param duration Duration of auction
     */
    function startAuction(uint64 duration) external;

    /**
     * @notice Deposit bidding token for current running epoch auction
     * @param amount Amount of bid token to deposit
     */
    function deposit(uint256 amount) external;

    /**
     * @notice Withdraw bid token from current running auction. User's bid token position will be reduced by `amount`
     * Can only withdraw bid token for ongoing auction. Cannot if epoch has ended.
     * @param amount Amount of bid token to withdraw
     */
    function withdraw(uint256 amount) external;

    /**
     * @notice Withdraw all bid token from current running auction. User's bid token position will be reduced to 0
     * Can only withdraw bid token for ongoing auction. Cannot if epoch has ended.
     */
    function withdrawAll() external;

    /**
     * @notice Claim share of Temple Gold for epoch
     * Can only claim for past epochs, not current auction epoch.
     * @param epochId Id of epoch
     */
    function claim(uint256 epochId) external;

    /**
     * @notice Checkpoint total Temple Gold distributed for next epoch.
     * Can only be called by Temple Gold contract
     * @param amount Amount of Temple Gold to checkpoint
     */
    function checkpointGold(uint256 amount) external;

    /**
     * @notice Checkpoint auction state. If auction has ended, bidLive is set to false.
     */
    function checkpointAuctionState() external;

    /**
     * @notice Get Temple Gold supply for epoch
     * @param epochId Epoch Id
     * @return Temple Gold supply
     */
    function epochGoldSupply(uint256 epochId) external view returns (uint256);

    /**
     * @notice Get current epoch
     * @return Epoch Id
     */
    function currentEpoch() external view returns (uint256);

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
}