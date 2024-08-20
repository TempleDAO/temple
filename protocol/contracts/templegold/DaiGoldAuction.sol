pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/DaiGoldAuction.sol)


import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { IDaiGoldAuction } from "contracts/interfaces/templegold/IDaiGoldAuction.sol";
import { ITempleGold } from "contracts/interfaces/templegold/ITempleGold.sol";
import { AuctionBase } from "contracts/templegold/AuctionBase.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { TempleMath } from "contracts/common/TempleMath.sol";
import { EpochLib } from "contracts/templegold/EpochLib.sol";
import { IAuctionBase } from "contracts/interfaces/templegold/IAuctionBase.sol";

/** 
 * @title AuctionEscrow
 * @notice Bidding token is deposited into this contract to bid on a share of distributed Temple Gold for an epoch.
 * Temple Gold acquired in past epochs can always be claimed. Once bid, users cannot
 * withdraw their bid token and can claim their share of Temple Gold for epoch after auction finishes.
 * Elevated access can change bidding token for future epochs.
 */
contract DaiGoldAuction is IDaiGoldAuction, AuctionBase, TempleElevatedAccess {
    using SafeERC20 for ITempleGold;
    using SafeERC20 for IERC20;
    using TempleMath for uint256;
    using EpochLib for IAuctionBase.EpochInfo;
    
    /// @notice Temple GOLD address
    ITempleGold public immutable override templeGold;
    /// @notice Token to bid for Temple GOLD
    /// @dev This token is assumed to not have any taxes or complicated mechanisms. Plan is to use DAI token. This could change in future
    IERC20 public override bidToken;
    /// @notice Destination address for proceeds of auctions
    address public immutable override treasury;
    /// @notice Address that can trigger start of auction. address(0) means anyone
    address public override auctionStarter;

    /// @notice Keep track of next epoch auction Temple Gold amount
    uint256 public override nextAuctionGoldAmount;

    /// @notice Auction duration
    uint64 public constant AUCTION_DURATION = 1 weeks;
    /// @notice Configuration for auction
    AuctionConfig private auctionConfig;

    constructor(
        address _templeGold,
        address _bidToken,
        address _treasury,
        address _rescuer,
        address _executor,
        address _auctionStarter
    ) TempleElevatedAccess(_rescuer, _executor) {
        templeGold = ITempleGold(_templeGold);
        bidToken = IERC20(_bidToken);
        treasury = _treasury;
        auctionStarter = _auctionStarter;
        emit AuctionStarterSet(_auctionStarter);
    }

    /**
     * @notice Set auction configuration
     * @param _config Auction configuration
     */
    function setAuctionConfig(AuctionConfig calldata _config) external override onlyElevatedAccess {
        if (_config.auctionStartCooldown == 0
                || _config.auctionMinimumDistributedGold == 0
                || _config.auctionsTimeDiff == 0) 
            { revert CommonEventsAndErrors.ExpectedNonZero(); }
        if (!epochs[_currentEpochId].hasEnded()) { revert InvalidOperation(); }
        auctionConfig = _config;

        emit AuctionConfigSet(_currentEpochId, _config);
    }

    /**
     * @notice Set address to trigger auction start. Zero address accepted
     * @param _starter Auction starter
     */
    function setAuctionStarter(address _starter) external override onlyElevatedAccess {
        /// @notice No zero address checks. Zero address is a valid input
        auctionStarter = _starter;
        if (!epochs[_currentEpochId].hasEnded()) { revert InvalidOperation(); }
        emit AuctionStarterSet(_starter);
    }

    /**
     * @notice Set token used for bidding
     * @param _bidToken Bid token
     */
    function setBidToken(address _bidToken) external override onlyElevatedAccess {
        if (_bidToken == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        if (!epochs[_currentEpochId].hasEnded()) { revert InvalidOperation(); }
        bidToken = IERC20(_bidToken);
        emit BidTokenSet(_bidToken);
    }

    /**
     * @notice Start auction. Auction start can be triggered by anyone if `auctionStarter` not set
     * @dev The Temple Gold amount for the auction is fixed and set at startAuction(). 
     * So in `startAuction()`, there is a call to `_distributeGold()` to mint and distribute TGOLD. 
     * Any other `_distributeGold()` calls during auction is tracked for next auction use.
     */
    function startAuction() external override {
        if (auctionStarter != address(0) && msg.sender != auctionStarter) { revert CommonEventsAndErrors.InvalidAccess(); }
        EpochInfo storage prevAuctionInfo = epochs[_currentEpochId];
        if (!prevAuctionInfo.hasEnded()) { revert CannotStartAuction(); }
       
        AuctionConfig storage config = auctionConfig;
        /// @notice last auction end time plus wait period
        if (_currentEpochId > 0 && (prevAuctionInfo.endTime + config.auctionsTimeDiff > block.timestamp)) {
            revert CannotStartAuction();
        }
        _distributeGold();
        uint256 totalGoldAmount = nextAuctionGoldAmount;
        nextAuctionGoldAmount = 0;
        uint256 epochId = _currentEpochId = _currentEpochId + 1;
        
        if (totalGoldAmount < config.auctionMinimumDistributedGold) { revert LowGoldDistributed(totalGoldAmount); }

        EpochInfo storage info = epochs[epochId];
        info.totalAuctionTokenAmount = totalGoldAmount;
        uint128 startTime = info.startTime = uint128(block.timestamp) + config.auctionStartCooldown;
        uint128 endTime = info.endTime = startTime + AUCTION_DURATION;

        emit AuctionStarted(epochId, msg.sender, startTime, endTime, totalGoldAmount);
    }

    /**
     * @notice Deposit bidding token for current running epoch auction
     * @param amount Amount of bid token to deposit
     */
    function bid(uint256 amount) external virtual override onlyWhenLive {
        if (amount == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }

        bidToken.safeTransferFrom(msg.sender, treasury, amount);

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
        EpochInfo storage info = epochs[epochId];
        if (!info.hasEnded()) { revert CannotClaim(epochId); }
        /// @dev epochId could be invalid. eg epochId > _currentEpochId
        if (info.startTime == 0) { revert InvalidEpoch(); }
        if (claimed[msg.sender][epochId]) { revert AlreadyClaimed(); }

        uint256 bidTokenAmount = depositors[msg.sender][epochId];
        if (bidTokenAmount == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        claimed[msg.sender][epochId] = true;
        uint256 claimAmount = bidTokenAmount.mulDivRound(info.totalAuctionTokenAmount, info.totalBidTokenAmount, false);
        claimedAmount[msg.sender][epochId] = claimAmount;
        templeGold.safeTransfer(msg.sender, claimAmount);
        emit Claim(msg.sender, epochId, bidTokenAmount, claimAmount);
    }

    /**
     * @notice Checkpoint total Temple Gold distributed for next epoch.
     * Can only be called by Temple Gold contract or elevated access (for rebalancing purpose)
     * @param amount Amount of Temple Gold to checkpoint
     */
    function notifyDistribution(uint256 amount) external override {
        if (msg.sender != address(templeGold) && !isElevatedAccess(msg.sender, msg.sig)) { revert CommonEventsAndErrors.InvalidAccess(); }
        /// @notice Temple Gold contract mints TGLD amount to contract before calling `notifyDistribution`
        nextAuctionGoldAmount += amount;
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
        return epochs[_currentEpochId].hasEnded();
    }

    /**
     * @notice Check if current auction epoch is allowing bid deposits
     * @return Bool if allowing deposit
     */
    function canDeposit() external view override returns (bool) {
        return epochs[_currentEpochId].isActive();
    }

    /**
     * @notice Get auction configuration
     * @return Auction configuration
     */
    function getAuctionConfig() external override view returns (AuctionConfig memory) {
        return auctionConfig;
    }

    /**
     * @notice Get claimable amount for current epoch
     * @dev For current epoch, function will return claimable at current time. This can change with more user deposits
     * @param depositor Address to check amount for
     * @return Claimable amount
     */
    function getClaimableAtCurrentEpoch(address depositor) external override view returns (uint256) {
        return getClaimableAtEpoch(depositor, _currentEpochId);
    }

    /**
     * @notice Get claimable amount for an epoch
     * @dev For current epoch, function will return claimable at current time. This can change with more user deposits
     * @param depositor Address to check amount for
     * @param epochId Epoch id
     * @return Claimable amount
     */
    function getClaimableAtEpoch(address depositor, uint256 epochId) public override view returns (uint256) {
        if (claimed[depositor][epochId]) { return 0; }
        uint256 bidTokenAmount = depositors[depositor][epochId];
        if (bidTokenAmount == 0 || epochId > _currentEpochId) { return 0; }
        EpochInfo memory info = epochs[epochId];
        return bidTokenAmount.mulDivRound(info.totalAuctionTokenAmount, info.totalBidTokenAmount, false);
    }
    
    /**
     * @notice Recover auction tokens for last but not started auction. 
     * Any other token which is not Temple Gold can be recovered too at any time
     * @dev For recovering Temple Gold, Epoch data is deleted and leftover amount is added to nextAuctionGoldAmount.
     * so admin should recover total auction amount for epoch if that's the requirement
     * @param token Token to recover
     * @param to Recipient
     * @param amount Amount to auction tokens
     */
    function recoverToken(
        address token,
        address to,
        uint256 amount
    ) external override onlyElevatedAccess {
        if (to == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        if (amount == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }

        if (token != address(templeGold)) {
            emit CommonEventsAndErrors.TokenRecovered(to, token, amount);
            IERC20(token).safeTransfer(to, amount);
            return;
        }

        // auction started but cooldown pending
        uint256 epochId = _currentEpochId;
        EpochInfo storage info = epochs[epochId];
        if (info.startTime == 0) { revert InvalidOperation(); }
        if (info.isActive()) { revert AuctionActive(); }
        if (info.hasEnded()) { revert AuctionEnded(); }
        uint256 _totalAuctionTokenAmount = info.totalAuctionTokenAmount;
        if (amount > _totalAuctionTokenAmount) { revert CommonEventsAndErrors.InvalidAmount(token, amount); }
        /// @dev Epoch data is deleted and leftover amount is added to nextAuctionGoldAmount.
        /// so admin should recover total auction amount for epoch if that's the requirement
        delete epochs[epochId];
        /// @dev `nextAuctionGoldAmount` is set to 0 in `startAuction`.
        /// `nextAuctionGoldAmount > 0` if there was a distribution after `auctionStart` called
        /// epoch is deleted. so if amount < totalAuctionTokenAmount for epoch, add leftover to next auction amount
        unchecked {
            nextAuctionGoldAmount += _totalAuctionTokenAmount - amount;
        }

        emit CommonEventsAndErrors.TokenRecovered(to, token, amount);
        templeGold.safeTransfer(to, amount);
    }

    /**
     * @notice Recover auction tokens for epoch with zero bids
     * @param epochId Epoch Id
     * @param to Recipient
     */
    function recoverTempleGoldForZeroBidAuction(uint256 epochId, address to) external override onlyElevatedAccess {
        if (to == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        // has to be valid epoch
        if (epochId > _currentEpochId) { revert InvalidEpoch(); }
        if (epochsWithoutBidsRecovered[epochId]) { revert AlreadyRecovered(); }
        // epoch has to be ended
        EpochInfo storage epochInfo = epochs[epochId];
        if (!epochInfo.hasEnded()) { revert AuctionActive(); }
        // bid token amount for epoch has to be 0
        if (epochInfo.totalBidTokenAmount > 0) { revert InvalidOperation(); }

        epochsWithoutBidsRecovered[epochId] = true;
        uint256 amount = epochInfo.totalAuctionTokenAmount;
        emit CommonEventsAndErrors.TokenRecovered(to, address(templeGold), amount);
        templeGold.safeTransfer(to, amount);
    }

    /**
     * @notice Mint and distribute TGOLD 
     */
    function distributeGold() external {
        _distributeGold();
    }
    
    function _distributeGold() private {
        /// @dev no op silent fail if nothing to distribute
        templeGold.mint();
    }

    modifier onlyWhenLive() {
        if (!epochs[_currentEpochId].isActive()) { revert CannotDeposit(); }
        _;
    }
}