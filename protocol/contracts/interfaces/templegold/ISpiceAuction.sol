pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (interface/templegold/ISpiceAuction.sol)

import { IAuctionBase } from "contracts/interfaces/templegold/IAuctionBase.sol";
interface ISpiceAuction is IAuctionBase {
    event AuctionConfigSet(uint256 epoch, SpiceAuctionConfig config);
    event DaoExecutorSet(address daoExecutor);
    event AuctionConfigRemoved(uint256 configId, uint256 epochId);
    event ClaimShouldNotifyTotalRedeemedSet(bool notify);
    event LzReceiveExecutorGasSet(uint32 gas);
    event RedeemedTempleGoldBurned(uint256 epochId, uint256 amount);

    error InvalidConfigOperation();
    error NotEnoughAuctionTokens();
    error MissingAuctionTokenConfig();
    error NoConfig();
    error RemoveAuctionConfig();
    error WithdrawFailed(uint256 amount);

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
        /// @notice Is Temple Gold auction token
        bool isTempleGoldAuctionToken;
        /// @notice Auction proceeds recipient
        address recipient;
    }

    /// @notice Spice auction contracts are set up for 2 tokens. Either can be bid or sell token for a given auction
    /// @notice Temple GOLD
    function templeGold() external view returns (address);

    /// @notice Spice Token
    function spiceToken() external view returns (address);

    /// @notice DAO contract to execute configurations update
    function daoExecutor() external view returns (address);

    /// @notice Name of this Spice Bazaar auction
    function name() external view returns (string memory);

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

    /**
     * @notice Get claimable amount for an epoch
     * @dev function will return claimable for epoch. This can change with more user deposits
     * @param depositor Address to check amount for
     * @param epochId Epoch id
     * @return Claimable amount
     */
    function getClaimableForEpoch(address depositor, uint256 epochId) external view returns (uint256);

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
     * @notice Set if claim should notify total TGLD redeemed for an auction epoch
     * @param _notify Boolean if to notify when user claims
     */
    function setClaimShouldNotifyTotalRedeemed(bool _notify) external;

    function claimShouldNotifyTotalRedeemed() external view returns (bool);

    /**
     * @notice Check total bid token amount for epoch auction
     * @param epochId Epoch to check for
     */
    function checkAuctionRedeemedAmount(uint256 epochId) external view returns (uint256);

    /**
     * @notice Claim share of Temple Gold for epoch
     * Can only claim for past epochs, not current auction epoch.
     * @param epochId Id of epoch
     */
    function claim(uint256 epochId) external payable;

    /**
     * @notice Set lzReceive gas used by executor
     * @param _gas Redemption notifier
     */
    function setLzReceiveExecutorGas(uint32 _gas) external;

    /// @notice Get executor gas used for calling `lzReceive`
    function lzReceiveExecutorGas() external view returns (uint32);

    function redeemedEpochs(uint256 epochId) external view returns (bool);

    /**
     * @notice Burn redeemd TGLD and notify circulating supply
     * @param epochId Epoch Id
     * @param useContractEth If to use contract eth for layerzero send
     */
    function burnAndNotify(uint256 epochId, bool useContractEth) external payable;
}