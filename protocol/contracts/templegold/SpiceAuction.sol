pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/SpiceAuction.sol)


import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ISpiceAuction } from "contracts/interfaces/templegold/ISpiceAuction.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { AuctionBase } from "contracts/templegold//AuctionBase.sol";
import { TempleMath } from "contracts/common/TempleMath.sol";
import { EpochLib } from "contracts/templegold/EpochLib.sol";
import { IAuctionBase } from "contracts/interfaces/templegold/IAuctionBase.sol";

/** 
 * @title SpiceAuction
 * @notice Temple Gold is deposited into this contract to bid on a share of distributed Spice token, 
 * or vice versa, for an epoch. Temple Gold can be the bid or auction token at any auction epoch.
 * Reward tokens acquired in past epochs can always be claimed. Once bid, users cannot
 * claim their bid token and can only claim their share of reward token for epoch after epoch finishes.
 * Bid and auction tokens could change per auction. These are set in `AuctionConfig`. 
 * Config is set before the next auction starts using `setAuctionConfig` by DAO execution.
 */
contract SpiceAuction is ISpiceAuction, AuctionBase {
    using SafeERC20 for IERC20;
    using TempleMath for uint256;
    using EpochLib for IAuctionBase.EpochInfo;

    /// @notice Spice auction contracts are set up for 2 tokens. Either token can be bid or sell token for a given auction
    address public immutable override spiceToken;
    /// @notice Temple GOLD
    address public immutable override templeGold;
    /// @notice DAO contract to execute configurations update
    address public override daoExecutor;

    /// @notice Auctions run for minimum 1 week
    uint32 public constant MINIMUM_AUCTION_PERIOD = 1 weeks;
    /// @notice Maximum wait period between last and next auctions
    uint32 public constant MAXIMUM_AUCTION_WAIT_PERIOD = 90 days;
    /// @notice Maximum auction duration
    uint32 public constant MAXIMUM_AUCTION_DURATION = 30 days;

    /// @notice Name of this Spice Bazaar auction
    string public override name;

    /// @notice Last time auction was started. For zero auctions, it is the contract deploy timestamp
    uint256 private immutable _deployTimestamp;

    /// @notice Keep track of the different configurations for each auction
    mapping(uint256 auctionId => SpiceAuctionConfig config) public auctionConfigs;
    /// @notice Keep track of claimed amounts per auction token. This helps calculate amount of auction tokens for next epoch.
    mapping(address token => uint256 amount) private _claimedAuctionTokens;
    /// @notice Keep track of total allocation per auction token
    mapping(address token => uint256 amount) private _totalAuctionTokenAllocation;

    constructor(
        address _templeGold,
        address _spiceToken,
        address _daoExecutor,
        string memory _name
    ) {
        spiceToken = _spiceToken;
        daoExecutor = _daoExecutor;
        templeGold = _templeGold;
        name = _name;
        _deployTimestamp = block.timestamp;
    }

    /**
     * @notice Set DAO executor for DAO actions
     * @param _daoExecutor New dao executor
     */
    function setDaoExecutor(address _daoExecutor) external onlyDAOExecutor {
        if (_daoExecutor == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        daoExecutor = _daoExecutor;
        emit DaoExecutorSet(_daoExecutor);
    }

    /**
     * @notice Set config for an epoch. This enables dynamic and multiple auctions especially for vested scenarios
     * @dev Must be set before epoch auction starts
     * @param _config Config to set
     */
    function setAuctionConfig(SpiceAuctionConfig calldata _config) external onlyDAOExecutor {
        /// @dev epoch Id is only updated when auction starts. 
        /// @dev cannot set config for past or ongoing auction
        uint256 currentEpochIdCache = _currentEpochId;
        if (currentEpochIdCache > 0) {
            EpochInfo storage info = epochs[currentEpochIdCache];
            /// Cannot set config for ongoing auction
            if (info.isActive()) { revert InvalidConfigOperation(); }
        }
        if (_config.duration < MINIMUM_AUCTION_PERIOD 
            || _config.duration > MAXIMUM_AUCTION_DURATION
            || _config.waitPeriod > MAXIMUM_AUCTION_WAIT_PERIOD) { revert CommonEventsAndErrors.InvalidParam(); }
        /// @dev startCooldown can be zero
        if (_config.waitPeriod == 0
            || _config.minimumDistributedAuctionToken == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        if (_config.recipient == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }

        currentEpochIdCache += 1;
        auctionConfigs[currentEpochIdCache] = _config;
        emit AuctionConfigSet(currentEpochIdCache, _config);
    }

    /// @notice Remove auction config set for last epoch
    function removeAuctionConfig() external override onlyDAOExecutor {
        /// only delete latest epoch if auction is not started
        uint256 id = _currentEpochId;
        
        EpochInfo storage info = epochs[id];
        // _currentEpochId = 0
        if (info.startTime == 0) { revert InvalidConfigOperation(); }
        // Cannot reset an ongoing auction
        if (info.isActive()) { revert InvalidConfigOperation(); }
        /// @dev could be that `auctionStart` is triggered but there's cooldown, which is not reached (so can delete epochInfo for _currentEpochId)
        // or `auctionStart` is not triggered but `auctionConfig` is set (where _currentEpochId is not updated yet)
        bool configSetButAuctionStartNotCalled = auctionConfigs[id+1].duration > 0;
        if (!configSetButAuctionStartNotCalled) {
            /// @dev unlikely because this is a DAO execution, but avoid deleting old ended auctions
            if (info.hasEnded()) { revert AuctionEnded(); }
            /// auction was started but cooldown has not passed yet
            delete auctionConfigs[id];
            delete epochs[id];
            _currentEpochId = id - 1;
            emit AuctionConfigRemoved(id, id);
        } else {
            // `auctionStart` is not triggered but `auctionConfig` is set
            id += 1;
            delete auctionConfigs[id];
            emit AuctionConfigRemoved(id, 0);
        }
    }

    /**
     * @notice Start auction. Checks caller is set config starter. Address zero for anyone to call
     */
    function startAuction() external override {
        uint256 epochId = _currentEpochId;
        /// @dev config is always set for next auction
        /// @notice Configuration is set before auctions so configId = currentEpochId + 1;
        SpiceAuctionConfig storage config = auctionConfigs[epochId+1];
        if (config.duration == 0) { revert CannotStartAuction(); }
        /// @notice only starter
        if (config.starter != address(0) && msg.sender != config.starter) { revert CommonEventsAndErrors.InvalidAccess(); }
        /// @notice enough wait period since last auction
        if (epochId > 0) {
            /// @dev `_currentEpochId` is still last epoch
            EpochInfo memory lastEpochInfo = epochs[epochId];
            /// use waitperiod from last auction config
            uint64 _waitPeriod = auctionConfigs[epochId].waitPeriod;
            if (lastEpochInfo.endTime + _waitPeriod > block.timestamp) { revert CannotStartAuction(); }
        } else {
            /// For first auction
            if (_deployTimestamp + config.waitPeriod > block.timestamp) { revert CannotStartAuction(); }
        }
        (,address auctionToken) = _getBidAndAuctionTokens(config);
        uint256 totalAuctionTokenAllocation = _totalAuctionTokenAllocation[auctionToken];
        uint256 balance = IERC20(auctionToken).balanceOf(address(this));
        uint256 epochAuctionTokenAmount = balance - (totalAuctionTokenAllocation - _claimedAuctionTokens[auctionToken]);
        if (config.activationMode == ActivationMode.AUCTION_TOKEN_BALANCE) {
            if (config.minimumDistributedAuctionToken == 0) { revert MissingAuctionTokenConfig(); }
        }
        if (epochAuctionTokenAmount < config.minimumDistributedAuctionToken) { revert NotEnoughAuctionTokens(); }
        // epoch start settings
        // now update currentEpochId
        epochId = _currentEpochId = _currentEpochId + 1;
        EpochInfo storage info = epochs[epochId];
        uint128 startTime = info.startTime = uint128(block.timestamp) + config.startCooldown;
        uint128 endTime = info.endTime = startTime + config.duration;
        info.totalAuctionTokenAmount = epochAuctionTokenAmount;
        // Keep track of total allocation auction tokens per epoch
        _totalAuctionTokenAllocation[auctionToken] = totalAuctionTokenAllocation + epochAuctionTokenAmount;

        emit AuctionStarted(epochId, msg.sender, startTime, endTime, epochAuctionTokenAmount);
    }

    /**
     * @notice Bid using `bidToken` for `auctionToken`
     * Once a bid is placed for an auction, user cannot withdraw or cancel bid.
     * @param amount Amount of `bidToken` to bid
     */
    function bid(uint256 amount) external virtual override {
        /// @dev Cache, gas savings
        uint256 epochId = _currentEpochId;
        EpochInfo storage info = epochs[epochId];

        if(!info.isActive()) { revert CannotDeposit(); }
        if (amount == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }

        SpiceAuctionConfig storage config = auctionConfigs[epochId];
        (address bidToken,) = _getBidAndAuctionTokens(config);
        address _recipient = config.recipient;
        uint256 _bidTokenAmountBefore = IERC20(bidToken).balanceOf(_recipient);
        IERC20(bidToken).safeTransferFrom(msg.sender, _recipient, amount);
        uint256 _bidTokenAmountAfter = IERC20(bidToken).balanceOf(_recipient);
        // fee on transfer tokens
        if (amount != _bidTokenAmountAfter - _bidTokenAmountBefore) { revert CommonEventsAndErrors.InvalidParam(); }
        depositors[msg.sender][epochId] += amount;

        info.totalBidTokenAmount += amount;
        emit Deposit(msg.sender, epochId, amount);
    }

    /**
     * @notice Claim (retro) rewards for an epoch . Cannot claim for a live epoch auction
     * @param epochId Epoch to claim for
     */
    function claim(uint256 epochId) external virtual override {
        /// @notice cannot claim for current live epoch
        EpochInfo storage info = epochs[epochId];
        if (info.startTime == 0) { revert InvalidEpoch(); }
        if (!info.hasEnded()) { revert CannotClaim(epochId); }

        uint256 bidTokenAmount = depositors[msg.sender][epochId];
        if (bidTokenAmount == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        delete depositors[msg.sender][epochId];
        SpiceAuctionConfig storage config = auctionConfigs[epochId];
        (, address auctionToken) = _getBidAndAuctionTokens(config);

        uint256 claimAmount = bidTokenAmount.mulDivRound(info.totalAuctionTokenAmount, info.totalBidTokenAmount, false);
        /// checkpoint claim for auction token
        _claimedAuctionTokens[auctionToken] += claimAmount;
        IERC20(auctionToken).safeTransfer(msg.sender, claimAmount);
        emit Claim(msg.sender, epochId, bidTokenAmount, claimAmount);
    }

    /**
     * @notice Recover auction tokens for last but not started auction
     * @param token Token to recover
     * @param to Recipient
     * @param amount Amount to auction tokens
     */
    function recoverToken(
        address token,
        address to,
        uint256 amount
    ) external override onlyDAOExecutor {
        if (to == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        if (amount == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }

        if (token != spiceToken && token != templeGold) {
            emit CommonEventsAndErrors.TokenRecovered(to, token, amount);
            IERC20(token).safeTransfer(to, amount);
            return;
        }

        uint256 epochId = _currentEpochId;
        EpochInfo storage info = epochs[epochId];
        /// @dev use `removeAuctionConfig` for case where `auctionStart` is called and cooldown is still pending
        if (info.startTime == 0) { revert InvalidConfigOperation(); }
        if (!info.hasEnded() && auctionConfigs[epochId+1].duration == 0) { revert RemoveAuctionConfig(); }
        

        /// @dev Now `auctionStart` is not triggered but `auctionConfig` is set (where _currentEpochId is not updated yet)
    
        // check to not take away intended tokens for claims
        // calculate auction token amount
        uint256 totalAuctionTokenAllocation = _totalAuctionTokenAllocation[token];
        uint256 balance = IERC20(token).balanceOf(address(this));
        uint256 maxRecoverAmount = balance - (totalAuctionTokenAllocation - _claimedAuctionTokens[token]);
        
        if (amount > maxRecoverAmount) { revert CommonEventsAndErrors.InvalidParam(); }
        
        IERC20(token).safeTransfer(to, amount);

        emit CommonEventsAndErrors.TokenRecovered(to, token, amount);
    }

    /**
     * @notice Recover auction tokens for epoch with zero bids
     * @param epochId Epoch Id
     * @param to Recipient
     */
    function recoverAuctionTokenForZeroBidAuction(uint256 epochId, address to) external override onlyDAOExecutor {
        if (to == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        // has to be valid epoch
        if (epochId > _currentEpochId) { revert InvalidEpoch(); }
        // epoch has to be ended
        EpochInfo storage epochInfo = epochs[epochId];
        if (!epochInfo.hasEnded()) { revert AuctionActive(); }
        // bid token amount for epoch has to be 0
        if (epochInfo.totalBidTokenAmount > 0) { revert InvalidOperation(); }

        SpiceAuctionConfig storage config = auctionConfigs[epochId];
        (, address auctionToken) = _getBidAndAuctionTokens(config);
        uint256 amount = epochInfo.totalAuctionTokenAmount;
        _totalAuctionTokenAllocation[auctionToken] -= amount;

        emit CommonEventsAndErrors.TokenRecovered(to, auctionToken, amount);
        IERC20(auctionToken).safeTransfer(to, amount);
    }

    /**
     * @notice Get spice auction config for an auction
     * @param auctionId Id of auction
     */
    function getAuctionConfig(uint256 auctionId) external view override returns (SpiceAuctionConfig memory) {
        return auctionConfigs[auctionId];
    }

    /**
     * @notice Get auction token for current epoch
     * @return Auction token
     */
    function getAuctionTokenForCurrentEpoch() external override view returns (address) {
        SpiceAuctionConfig memory config = auctionConfigs[_currentEpochId];
        return config.isTempleGoldAuctionToken ? templeGold : spiceToken;
    }

    /**
     * @notice Get current epoch
     * @return Epoch Id
     */
    function currentEpoch() external view override returns (uint256) {
        return _currentEpochId;
    }

    /**
     * @notice Get claimable amount for an epoch
     * @dev function will return claimable for epoch. This can change with more user deposits
     * @param depositor Address to check amount for
     * @param epochId Epoch id
     * @return Claimable amount
     */
    function getClaimableForEpoch(address depositor, uint256 epochId) external override view returns (uint256) {
        uint256 bidTokenAmount = depositors[depositor][epochId];
        if (bidTokenAmount == 0 || epochId > _currentEpochId) { return 0; }
        EpochInfo memory info = epochs[epochId];
        return bidTokenAmount.mulDivRound(info.totalAuctionTokenAmount, info.totalBidTokenAmount, false);
    }

    function _getBidAndAuctionTokens(
        SpiceAuctionConfig storage _config
    ) private view returns (address bidToken, address auctionToken) {
        (bidToken, auctionToken) = _config.isTempleGoldAuctionToken
            ? (spiceToken, templeGold)
            : (templeGold, spiceToken);
    }

    /// @notice modifier to allow execution by only DAO executor
    modifier onlyDAOExecutor() {
        if (msg.sender != daoExecutor) { revert CommonEventsAndErrors.InvalidAccess(); }
        _;
    }
}