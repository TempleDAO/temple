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
    address public immutable override tokenA;
    address public immutable override tokenB;
    /// @notice DAO contract to execute configurations update
    address public immutable override daoExecutor;

    /// @notice Auctions run for minimum 1 week
    uint32 public constant MINIMUM_AUCTION_PERIOD = 604_800;
    /// @notice Name of this Spice Bazaar auction
    string public override name;

    /// @notice Last time auction was started. For zero auctions, it is the contract deploy timestamp
    uint256 private immutable _deoloyTimestamp;

    /// @notice Keep track of the different configurations for each auction
    mapping(uint256 auctionId => SpiceAuctionConfig config) public auctionConfigs;
    /// @notice Keep track of claimed amounts per auction token. This helps calculate amount of auction tokens for next epoch.
    mapping(address token => uint256 amount) private _claimedAuctionTokens;
    /// @notice Keep track of total allocation per auction token
    mapping(address token => uint256 amount) private _totalAuctionTokenAllocation;

    constructor(
        address _tokenA,
        address _tokenB,
        address _daoExecutor,
        string memory _name
    ) {
        tokenA = _tokenA < _tokenB ? _tokenA : _tokenB;
        tokenB = _tokenA < _tokenB ? _tokenB : _tokenA;
        daoExecutor = _daoExecutor;
        name = _name;
        _deoloyTimestamp = block.timestamp;
    }

    /// @notice Set config for an epoch. This enable dynamic and multiple auctions especially for vested scenarios
    /// Must be set before epoch auction starts
    function setAuctionConfig(SpiceAuctionConfig calldata _config) external onlyDAOExecutor {
        /// @dev epoch Id is only updated when auction starts. 
        uint256 currentEpochIdCache = _currentEpochId;
        EpochInfo memory info = epochs[currentEpochIdCache];
        currentEpochIdCache += 1;
        /// @notice Cannot set config for ongoing auction
        if (info.startTime <= block.timestamp) { revert InvalidConfigOperation(); }
        if (_config.duration < MINIMUM_AUCTION_PERIOD) { revert CommonEventsAndErrors.InvalidParam(); }
        if (_config.waitPeriod == 0
            || _config.startCooldown == 0
            || _config.minimumDistributedAuctionToken == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        if (_config.recipient == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }

        auctionConfigs[currentEpochIdCache] = _config;
        emit AuctionConfigSet(currentEpochIdCache, _config);
    }

    /// @notice Remove config set for last epoch
    function removeAuctionConfig() external override onlyDAOExecutor {
        uint256 epochId = _currentEpochId;
        if (epochId == 0) { revert NoConfig(); }
        // Cannot reset an ongoing auction
        EpochInfo storage info = epochs[epochId];
        if (info.startTime <= block.timestamp) { revert InvalidConfigOperation(); }
        delete auctionConfigs[epochId];
        _currentEpochId = epochId - 1;
        emit AuctionConfigRemoved(epochId);
    }

    function startAuction() external override {
        uint256 epochId = _currentEpochId;
        /// @notice Configuration is set before auctions so configId = currentEpochId + 1;
        SpiceAuctionConfig storage config = auctionConfigs[epochId+1];
        /// @notice only starter
        if (config.starter != address(0) && msg.sender != config.starter) { revert CommonEventsAndErrors.InvalidAccess(); }
        /// @notice enough wait period since last auction
        if (epochId != 0) {
            EpochInfo memory lastEpochInfo = epochs[epochId];
            if (lastEpochInfo.endTime + config.waitPeriod > block.timestamp) { revert CannotStartAuction(); }
        } else {
            /// For first auction
            if (_deoloyTimestamp + config.waitPeriod > block.timestamp) { revert CannotStartAuction(); }
        }
        address auctionToken = _getAuctionTokenForCurrentEpochStorage(config);
        uint256 epochAuctionTokenAmount;
        uint256 totalAuctionTokenAllocation = _totalAuctionTokenAllocation[auctionToken];
        if (config.activationMode == ActivationMode.AUCTION_TOKEN_BALANCE) {
            if (config.minimumDistributedAuctionToken == 0) { revert MissingAuctionTokenConfig(); }
            uint256 balance = IERC20(auctionToken).balanceOf(address(this));
            epochAuctionTokenAmount = balance - (totalAuctionTokenAllocation - _claimedAuctionTokens[auctionToken]);
            if (epochAuctionTokenAmount == 0 || epochAuctionTokenAmount < config.minimumDistributedAuctionToken) { revert NotEnoughAuctionTokens(); }
        } //else {
            /// acitvation by user
        //}
        // epoch start settings
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

        IERC20(bidToken).safeTransferFrom(msg.sender, address(this), amount);
        depositors[msg.sender][epochId] += amount;

        EpochInfo storage info = epochs[epochId];
        info.totalBidTokenAmount += amount;
        emit Deposit(msg.sender, epochId, amount);
    }

    /// @notice Retro claim
    function claim(uint256 epochId) external virtual override {
        /// @notice cannot claim for current live epoch
        if (epochId >= _currentEpochId) { revert CannotClaim(epochId); }
        uint256 bidTokenAmount = depositors[msg.sender][epochId];
        if (bidTokenAmount == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        delete depositors[msg.sender][epochId];
        SpiceAuctionConfig memory config = auctionConfigs[epochId];
        (address bidToken, address auctionToken) = _getBidAndAuctionTokens();
        IERC20(bidToken).safeTransfer(config.recipient, bidTokenAmount);

        EpochInfo memory info = epochs[epochId];
        uint256 claimAmount = bidTokenAmount.mulDivRound(info.totalAuctionTokenAmount, info.totalBidTokenAmount, false);
        IERC20(auctionToken).safeTransfer(msg.sender, claimAmount);
        emit Claim(msg.sender, epochId, bidTokenAmount, claimAmount);

        /// checkpoint claim for auction token
        _claimedAuctionTokens[auctionToken] += claimAmount;
    }

    function getAuctionConfigs(uint256 auctionId) external view override returns (SpiceAuctionConfig memory) {
        return auctionConfigs[auctionId];
    }

    function getAuctionTokenForCurrentEpoch() external override view returns (address) {
        SpiceAuctionConfig memory config = auctionConfigs[_currentEpochId];
        return config.auctionToken == AuctionToken.TOKEN_A ? tokenA: tokenB;
    }

    /**
     * @notice Get current epoch
     * @return Epoch Id
     */
    function currentEpoch() external view override returns (uint256) {
        return _currentEpochId;
    }

    function _getBidAndAuctionTokens() private view returns (address bidToken, address auctionToken) {
        auctionToken = _getAuctionTokenForCurrentEpoch();
        bidToken = auctionToken == tokenA ? tokenB : tokenA;
    }

    function _getAuctionTokenForCurrentEpochStorage(SpiceAuctionConfig storage config) private view returns (address) {
        return config.auctionToken == AuctionToken.TOKEN_A ? tokenA: tokenB;
    }

    function _getAuctionTokenForCurrentEpoch() private view returns (address) {
        SpiceAuctionConfig memory config = auctionConfigs[_currentEpochId];
        return config.auctionToken == AuctionToken.TOKEN_A ? tokenA: tokenB;
    }

    modifier onlyDAOExecutor() {
        if (msg.sender != daoExecutor) { revert CommonEventsAndErrors.InvalidAccess(); }
        _;
    }
}