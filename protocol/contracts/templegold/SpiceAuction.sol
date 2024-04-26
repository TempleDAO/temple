pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/SpiceAuction.sol)


import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ISpiceAuction } from "contracts/interfaces/templegold/ISpiceAuction.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { ISpiceAuction } from "contracts/interfaces/templegold/ISpiceAuction.sol";
import { AuctionBase } from "contracts/templegold//AuctionBase.sol";
import { TempleMath } from "contracts/common/TempleMath.sol";

contract SpiceAuction is ISpiceAuction, AuctionBase {
    using SafeERC20 for IERC20;
    using TempleMath for uint256;

    /// @notice Spice auction contracts are set up for 2 tokens. Either can be bid or sell token for a given auction
    /// @notice uint(TOKEN_A) < uint(TOKEN_B)
    address public immutable override spiceToken;
    address public immutable override templeGold;
    /// @notice DAO contract to execute configurations update
    address public immutable override daoExecutor;

    /// @notice Auctions run for minimum 1 week
    uint32 public constant MINIMUM_AUCTION_PERIOD = 604_800;
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

    /// @notice Set config for an epoch. This enable dynamic and multiple auctions especially for vested scenarios
    /// Must be set before epoch auction starts
    function setAuctionConfig(SpiceAuctionConfig calldata _config) external onlyDAOExecutor {
        /// @dev epoch Id is only updated when auction starts. 
        /// @dev cannot set config for past or ongoing auction
        uint256 currentEpochIdCache = _currentEpochId;
        if (currentEpochIdCache > 0) {
            EpochInfo memory info = epochs[currentEpochIdCache];
            /// @notice Cannot set config for ongoing auction
            if (info.startTime <= block.timestamp && block.timestamp < info.endTime) { revert InvalidConfigOperation(); }
        }
        if (_config.duration < MINIMUM_AUCTION_PERIOD) { revert CommonEventsAndErrors.InvalidParam(); }
        // startCooldown can be zero
        if (_config.waitPeriod == 0
            || _config.minimumDistributedAuctionToken == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        if (_config.recipient == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }

        currentEpochIdCache += 1;
        auctionConfigs[currentEpochIdCache] = _config;
        emit AuctionConfigSet(currentEpochIdCache, _config);
    }

    /// @notice Remove config set for last epoch
    function removeAuctionConfig() external override onlyDAOExecutor {
        /// only delete latest epoch if auction is not started
        uint256 epochId = _currentEpochId;
        // Cannot reset an ongoing auction
        EpochInfo storage info = epochs[epochId];
        if (info.startTime <= block.timestamp && block.timestamp < info.endTime) { revert InvalidConfigOperation(); }
        // use `epochId+1` for config of auction not started
        SpiceAuctionConfig storage config = auctionConfigs[epochId+1];
        if (config.duration == 0) { revert InvalidConfigOperation(); }
        delete auctionConfigs[epochId];
        /// @dev `_currentEpochId` is only updated when auction starts
        emit AuctionConfigRemoved(epochId);
    }

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
        address auctionToken = _getAuctionTokenForEpochStorage(config);
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
        uint64 startTime = info.startTime = uint64(block.timestamp) + config.startCooldown;
        uint64 endTime = info.endTime = uint64(block.timestamp) + config.duration;
        info.totalAuctionTokenAmount = epochAuctionTokenAmount;
        // info.totalBidTokenAmount = 0;

        // Keep track of total allocation auction tokens per epoch
        _totalAuctionTokenAllocation[auctionToken] = totalAuctionTokenAllocation + epochAuctionTokenAmount;

        emit AuctionStarted(epochId, msg.sender, startTime, endTime, epochAuctionTokenAmount);
    }

    function bid(uint256 amount) external virtual override {
        if(!_canDeposit()) { revert CannotDeposit(); }
        if (amount == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }

        /// @dev Cache, gas savings
        uint256 epochId = _currentEpochId;
        (address bidToken,) = _getBidAndAuctionTokens();
        address _recipient = auctionConfigs[epochId].recipient;
        IERC20(bidToken).safeTransferFrom(msg.sender, _recipient, amount);
        depositors[msg.sender][epochId] += amount;

        EpochInfo storage info = epochs[epochId];
        info.totalBidTokenAmount += amount;
        emit Deposit(msg.sender, epochId, amount);
    }

    /// @notice Retro claim
    function claim(uint256 epochId) external virtual override {
        /// @notice cannot claim for current live epoch
        EpochInfo memory info = epochs[epochId];
        if (info.startTime == 0) { revert InvalidEpoch(); }
        if (info.endTime >= block.timestamp) { revert CannotClaim(epochId); }

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

    function getAuctionConfig(uint256 auctionId) external view override returns (SpiceAuctionConfig memory) {
        return auctionConfigs[auctionId];
    }

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
     * @dev For current epoch, function will return claimable at current time. This can change with more user deposits
     * @param depositor Address to check amount for
     * @param epochId Epoch id
     * @return Claimable amount
     */
    function getClaimableAtCurrentTimestamp(address depositor, uint256 epochId) external override view returns (uint256) {
        uint256 bidTokenAmount = depositors[depositor][epochId];
        if (bidTokenAmount == 0 || epochId > _currentEpochId) { return 0; }
        EpochInfo memory info = epochs[epochId];
        return bidTokenAmount.mulDivRound(info.totalAuctionTokenAmount, info.totalBidTokenAmount, false);
    }

    function _getBidAndAuctionTokens() private view returns (address bidToken, address auctionToken) {
        auctionToken = _getAuctionTokenForCurrentEpoch();
        bidToken = auctionToken == spiceToken ? templeGold : spiceToken;
    }

    function _getBidAndAuctionTokens(SpiceAuctionConfig storage _config) private view returns (address bidToken, address auctionToken) {
        auctionToken = _getAuctionTokenForEpochStorage(_config);
        bidToken = auctionToken == spiceToken ? templeGold : spiceToken;
    }

    function _getAuctionTokenForEpochStorage(SpiceAuctionConfig storage config) private view returns (address) {
        return config.isTempleGoldAuctionToken ? templeGold : spiceToken;
    }

    function _getAuctionTokenForCurrentEpoch() private view returns (address) {
        SpiceAuctionConfig memory config = auctionConfigs[_currentEpochId];
        // return config.auctionToken == AuctionToken.TOKEN_A ? tokenA: tokenB;
        return config.isTempleGoldAuctionToken ? templeGold : spiceToken;
    }

    modifier onlyDAOExecutor() {
        if (msg.sender != daoExecutor) { revert CommonEventsAndErrors.InvalidAccess(); }
        _;
    }
}