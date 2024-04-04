pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/DaiGoldAuction.sol)


import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { IDaiGoldAuction } from "contracts/interfaces/templegold/IDaiGoldAuction.sol";
import { ITempleGold } from "contracts/interfaces/templegold/ITempleGold.sol";
import { AuctionBase } from "contracts/templegold/AuctionBase.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { mulDiv } from "@prb/math/src/Common.sol";

/** 
 * @title AuctionEscrow
 * @notice Bidding token is deposited into this contract to bid on a share of distributed Temple Gold for an epoch.
 *         Temple Gold acquired in past epochs can always be claimed. Once bidding for an epoch has ended, users cannot
 *         claim their bid token and can claim their share of Temple Gold for epoch.
 *         Elevated access can change bidding token for future epochs.
 */
contract DaiGoldAuction is IDaiGoldAuction, AuctionBase, TempleElevatedAccess {
    using SafeERC20 for IERC20;
    
    /// @notice Temple GOLD address
    IERC20 public immutable templeGold;
    /// @notice Token to bid for temple GOLD
    IERC20 public bidToken;
    /// @notice Destination address for proceeds of fire ritual
    address public immutable treasury;
    /// @notice Address that can trigger start of auction. address(0) means anyone
    address public auctionStarter;
    /// @notice Bool for if bidding is live
    bool public bidLive;

    /// @notice Keep track of next epoch auction Temple Gold amount
    uint256 public nextAuctionGoldAmount;
    uint160 public rewardDistributionCoolDown;
    uint96 public lastRewardNotificationTimestamp;

    /// @notice Auctions run for minimum 1 week
    uint32 public constant MINIMUM_AUCTION_PERIOD = 604_800;

    AuctionConfig public auctionConfig;

    constructor(
        address _templeGold,
        address _bidToken,
        address _treasury,
        address _rescuer,
        address _executor
    ) TempleElevatedAccess(_rescuer, _executor) {
        templeGold = IERC20(_templeGold);
        bidToken = IERC20(_bidToken);
        treasury = _treasury;
    }

    function setAuctionConfig(AuctionConfig calldata _config) external onlyElevatedAccess {
        if (_config.auctionDuration < MINIMUM_AUCTION_PERIOD) { revert CommonEventsAndErrors.InvalidParam(); }
        if (_config.auctionMinimumWaitPeriod == 0
            || _config.auctionStartCooldown == 0
            || _config.auctionMinimumDistributedGold == 0) 
        { revert CommonEventsAndErrors.ExpectedNonZero(); }
        auctionConfig = _config;

        emit AuctionConfigSet(_config);
    }

    /**
     * @notice Set address to trigger auction start. Zero address accepted
     * @param _starter Auction starter
     */
    function setAuctionStarter(address _starter) external override onlyElevatedAccess {
        /// @notice No zero address checks. Zero address is a valid input
        auctionStarter = _starter; 
    }

    /**
     * @notice Set token used for bidding
     * @param _bidToken Bid token
     */
    function setBidToken(address _bidToken) external override onlyElevatedAccess {
        if (_bidToken == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        bidToken = IERC20(_bidToken);
        emit BidTokenSet(_bidToken);
    }

    /**
     * @notice Start auction. Auction start can be triggered by anyone if `auctionStarter` not set
     */
    function startAuction() external override {
        if (auctionStarter != address(0) && msg.sender != auctionStarter) { revert CommonEventsAndErrors.InvalidAccess(); }
        if (!_isCurrentEpochEnded()) { revert CannotStartAuction(); }
       
        EpochInfo memory prevAuctionInfo = epochs[_currentEpochId];
        AuctionConfig memory config = auctionConfig;
        /// @notice last auction end time plus wait period
        if (prevAuctionInfo.endTime + auctionConfig.auctionMinimumWaitPeriod > block.timestamp) { revert CannotStartAuction(); }

        uint256 totalGoldAmount = nextAuctionGoldAmount;
        nextAuctionGoldAmount = 0;
        uint256 epochId = _currentEpochId = _currentEpochId + 1;
        
        if (totalGoldAmount < config.auctionMinimumDistributedGold) { revert LowGoldDistributed(totalGoldAmount); }

        EpochInfo storage info = epochs[epochId];
        info.totalAuctionTokenAmount = totalGoldAmount;
        info.startTime = uint64(block.timestamp) + config.auctionStartCooldown;
        uint64 endTime = info.endTime = uint64(block.timestamp) + config.auctionDuration;
        bidLive = true;
        
        emit AuctionStart(epochId, uint64(block.timestamp), endTime, totalGoldAmount);
    }

    /**
     * @notice Deposit bidding token for current running epoch auction
     * @param amount Amount of bid token to deposit
     */
    function deposit(uint256 amount) external virtual override onlyWhenLive {
        if (amount == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        _distributeGold();

        bidToken.safeTransferFrom(msg.sender, address(this), amount);

        uint256 epochIdCache = _currentEpochId;
        depositors[msg.sender][epochIdCache] += amount;

        EpochInfo storage info = epochs[epochIdCache];
        info.totalBidTokenAmount += amount;
        emit Deposit(msg.sender, epochIdCache, amount);
    }

    /**
     * @notice Claim share of Temple Gold for epoch
     * Can only claim for past epochs, not current auction epoch.
     * @param epochId Id of epoch
     */
    function claim(uint256 epochId) external virtual override {
        /// @notice cannot claim for current live epoch
        if (epochId >= _currentEpochId) { revert CannotClaim(epochId); }
        _distributeGold();
        EpochInfo memory infoCached = epochs[epochId];
        if (infoCached.startTime == 0) { revert InvalidEpoch(); }
        uint256 bidTokenAmount = depositors[msg.sender][epochId];
        if (bidTokenAmount == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        bidToken.safeTransfer(treasury, bidTokenAmount);

        delete depositors[msg.sender][epochId];
        uint256 claimAmount = _mulDivRound(bidTokenAmount, infoCached.totalAuctionTokenAmount, infoCached.totalBidTokenAmount, false);
        templeGold.safeTransfer(msg.sender, claimAmount);
        emit Claim(msg.sender, epochId, bidTokenAmount, claimAmount);
    }

    /**
     * @notice Checkpoint total Temple Gold distributed for next epoch.
     * Can only be called by Temple Gold contract
     * @param amount Amount of Temple Gold to checkpoint
     */
    function notifyDistribution(uint256 amount) external override {
        if (msg.sender != address(templeGold)) { revert CommonEventsAndErrors.InvalidAccess(); }
        /// @notice Temple Gold contract mints TGLD amount to contract before calling `notifyDistribution`
        nextAuctionGoldAmount += amount;
        lastRewardNotificationTimestamp = uint96(block.timestamp);
        emit GoldDistributionNotified(amount, block.timestamp);
    }
    
    /**
     * @notice Get Temple Gold supply for epoch
     * @param epochId Epoch Id
     * @return Temple Gold supply
     */
    function epochGoldSupply(uint256 epochId) external view override returns (uint256) {
        return epochs[epochId].totalAuctionTokenAmount;
    }

    /**
     * @notice Get current epoch
     * @return Epoch Id
     */
    function currentEpoch() external view override returns (uint256) {
        return _currentEpochId;
    }

    /**
     * @notice Get next epoch
     * @return Next epoch Id
     */
    function nextEpoch() public view override returns (uint256) {
        return _currentEpochId + 1;
    }

    /**
     * @notice Check if current epoch ended. That is, if current auction ended.
     * @return Bool if epoch ended
     */
    function isCurrentEpochEnded() external view override returns (bool) {
        return _isCurrentEpochEnded();
    }

    /**
     * @notice Check if current auction epoch is allowing bid deposits
     * @return Bool if allowing deposit
     */
    function canDeposit() external view override returns (bool) {
        return _canDeposit();
    }

    function distributeGold() external {
        _distributeGold();
    }
    
    function _distributeGold() private {
        bool canDistribute = ITempleGold(address(templeGold)).canDistribute();
        if (canDistribute) {
            ITempleGold(address(templeGold)).mint();
        }
    }

    modifier onlyWhenLive() {
        if (!_canDeposit()) { revert CannotDeposit(); }
        _;
    }
}