pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interface/templegold/ISpiceAuction.sol)

import { IAuctionBase } from "contracts/interfaces/templegold/IAuctionBase.sol";
interface ISpiceAuction is IAuctionBase {
    event AuctionConfigSet(uint256 epoch, SpiceAuctionConfig config);
    event DaoExecutorSet(address daoExecutor);
    event AuctionConfigRemoved(uint256 configId, uint256 epochId);
    event LzReceiveExecutorGasSet(uint32 gas);
    event RedeemedTempleGoldBurned(uint256 epochId, uint256 amount);
    event OperatorSet(address indexed operator);
    event SpiceAuctionEpochSet(uint256 epoch, address auctionToken, uint128 startTime, uint128 endTime, uint256 amount);

    error InvalidConfigOperation();
    error NotEnoughAuctionTokens();
    error WithdrawFailed(uint256 amount);
    error EtherNotNeeded();
    error MissingAuctionConfig(uint256 epochId);
    error AuctionFunded();
    error WaitPeriod();
    error Unimplemented();

    struct SpiceAuctionConfig {
        /// @notice Duration of auction
        uint32 duration;
        /// @notice Minimum time between successive auctions
        /// @dev For first auction, set this to 0 or a reasonable `startTime - deployTime = waitPeriod` value
        uint32 waitPeriod;
        /// @notice Minimum Gold distributed to enable auction start
        uint160 minimumDistributedAuctionToken;
        /// @notice Is Temple Gold auction token
        bool isTempleGoldAuctionToken;
        /// @notice Auction proceeds recipient
        address recipient;
    }

    /// @notice Struct for dapp to query epoch claimable or claimed 
    struct TokenAmount {
        /// @notice Either spice token or TGLD
        address token;
        /// @notice Amount of token
        uint256 amount;
    }

    /// @notice Spice auction contracts are set up for 2 tokens. Either can be bid or sell token for a given auction
    /// @notice Temple GOLD
    function templeGold() external view returns (address);

    /// @notice Spice Token
    function spiceToken() external view returns (address);

    /// @notice DAO contract to execute configurations update
    function daoExecutor() external view returns (address);

    /// @notice Strategy Gnosis address which funds spice auctions
    function strategyGnosis() external view returns (address);

    /// @notice Operator
    function operator() external view returns (address);

    /// @notice Name of this Spice Bazaar auction
    function name() external view returns (string memory);

    /// @notice Keep track of total claimed token per account
    function accountTotalClaimed(address account, address token) external view returns (uint256);

    /**
     * @notice Set config for an epoch. This enables dynamic and multiple auctions especially for vested scenarios
     * @dev Must be set before epoch auction starts
     * @param _config Config to set
     */
    function setAuctionConfig(SpiceAuctionConfig calldata _config) external;

    /// @notice Remove auction config set for last epoch
    function removeAuctionConfig() external;

    /**
     * @notice Get auction token for current epoch
     * @return Auction token
     */
    function getAuctionTokenForCurrentEpoch() external view returns (address);

    /**
     * @notice Get spice auction config for an auction
     * @param auctionId Id of auction
     */
    function getAuctionConfig(uint256 auctionId) external view returns (SpiceAuctionConfig memory);

    // /**
    //  * @notice Get claimable amount for an epoch
    //  * @dev function will return claimable for epoch. This can change with more user deposits
    //  * @param depositor Address to check amount for
    //  * @param epochId Epoch id
    //  * @return tokenAmount Claimable represented by TokenAmount struct
    //  */
    // function getClaimableForEpoch(
    //     address depositor,
    //     uint256 epochId
    // ) external view returns (TokenAmount memory tokenAmount);

    // /**
    //  * @notice Get claimed amount for an epoch and also the address of the auction token
    //  * @param depositor Address to check amount for
    //  * @param epochId Epoch Id
    //  * @return tokenAmount TokenAmount claimable struct
    //  */
    // function getClaimedForEpoch(
    //     address depositor,
    //     uint256 epochId
    // ) external view returns (TokenAmount memory tokenAmount);

    /**
     * @notice Get claimed amounts for an array of epochs
     * @param depositor Address to check amount for
     * @param epochIds Array of epoch ids
     * @return tokenAmounts Array of claimed TokenAmount structs
     */
    function getClaimedForEpochs(
        address depositor,
        uint256[] calldata epochIds
    ) external view returns (TokenAmount[] memory tokenAmounts);

    /**
     * @notice Get claimable amount for an array of epochs
     * @dev If the epochs contains a current epoch, function will return claimable at current time.
     * @param depositor Address to check amount for
     * @param epochIds Array of epoch ids
     * @return tokenAmounts Array of TokenAmount claimable struct
     */
    function getClaimableForEpochs(
        address depositor,
        uint256[] memory epochIds
    ) external view returns (TokenAmount[] memory tokenAmounts);

    /**
     * @notice Set DAO executor for DAO actions
     * @param _daoExecutor New dao executor
     */
    function setDaoExecutor(address _daoExecutor) external;

    /**
     * @notice Recover auction tokens for epoch with zero bids
     * @param epochId Epoch Id
     * @param to Recipient
     */
    function recoverAuctionTokenForZeroBidAuction(uint256 epochId, address to) external;

    /**
     * @notice Get total auction token amount for epoch auction
     * @param epochId Epoch to get for
     */
    function getAuctionTokenAmount(uint256 epochId) external view returns (uint256);

    /**
     * @notice Get total bid token amount for epoch auction
     * @param epochId Epoch to get for
     */
    function getAuctionBidAmount(uint256 epochId) external view returns (uint256);

    /**
     * @notice Claim share of Temple Gold for epoch
     * Can only claim for past epochs, not current auction epoch.
     * @param epochId Id of epoch
     */
    function claim(uint256 epochId) external;

    /**
     * @notice Set lzReceive gas used by executor
     * @param _gas Redemption notifier
     */
    function setLzReceiveExecutorGas(uint32 _gas) external;

    /// @notice Max gas limit used by layer zero executor for calling `lzReceive`
    function lzReceiveExecutorGas() external view returns (uint32);

    /// @notice Epochs which have redemption called to update circulating supply.
    function redeemedEpochs(uint256 epochId) external view returns (bool);

    /**
     * @notice Check if current epoch is active
     * @return Bool for active status
     */
    function isActive() external view returns (bool);

    /**
     * @notice Burn redeemd TGLD and notify circulating supply
     * @param epochId Epoch Id
     * @param useContractEth If to use contract eth for layerzero send
     */
    function burnAndNotify(uint256 epochId, bool useContractEth) external payable;

    /// @notice withdraw ETH used for layer zero sends
    function withdrawEth(address payable _to, uint256 _amount) external;

    /**
     * @notice Set operator
     * @param _operator operator to set
     */
    function setOperator(address _operator) external;

    /**
     * @notice Set next auction start and end times.
     * Transfers auction token for next auction and updates epoch time params
     * @dev Must be called by `strategyGnosis()`
     * @param amount Amount of auction tokens to transfer
     * @param startTime Start time of next auction
     */
    function fundNextAuction(uint256 amount, uint128 startTime) external;
}