pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/AuctionEscrow.sol)


import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { IAuctionEscrow } from "contracts/interfaces/templegold/IAuctionEscrow.sol";
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
contract AuctionEscrow is IAuctionEscrow, TempleElevatedAccess {
    using SafeERC20 for IERC20;
    
    /// @notice Temple GOLD address
    IERC20 public immutable templeGold;
    /// @notice Token to bid for temple GOLD
    IERC20 public bidToken;
    /// @notice Destination address for proceeds of fire ritual
    address public immutable treasury;
    /// @notice Bool for if bidding is live
    bool public bidLive;

    /// @notice Current epoch id
    uint256 private _currentEpochId;

    /// @notice Auctions run for minimum 1 week
    uint256 public constant MINIMUM_AUCTION_PERIOD = 604_800;
    /// @notice Minimum distributed available Temple GOLD for auction
    uint256 public constant MINIMUM_AUCTION_GOLD_AMOUNT = 1_000;

    /// @notice Depositor to epoch to amount deposted mapping
    mapping(address depositor => mapping(uint256 epochId => uint256 amount)) public depositors;
    /// @notice Keep track of epochs details
    mapping(uint256 epochId => EpochInfo info) public epochs;

    struct EpochInfo {
        uint64 startTime;
        uint64 endTime;
        uint256 totalBidTokenAmount;
        uint256 totalTGoldAmount;
    }

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
     * @notice Start auctioning of Temple Gold tokens.
     * Uses up to date distributed Temple Gold tokens since last auction as total Temple Gold for distribution
     * @param duration Duration of auction
     */
    function startAuction(uint64 duration) external override onlyElevatedAccess {
        if (duration < MINIMUM_AUCTION_PERIOD) { revert CommonEventsAndErrors.InvalidParam(); }
        /// @notice Can only start if current epoch ended
        if (!_isCurrentEpochEnded()) { revert CannotStartAuction(); }

        uint256 epochId = _currentEpochId = _currentEpochId + 1;
        EpochInfo storage info = epochs[epochId];
        /// @notice cache for gas savings
        uint256 totalTGoldAmount = info.totalTGoldAmount;
        if (totalTGoldAmount < MINIMUM_AUCTION_GOLD_AMOUNT) { revert LowGoldDistributed(totalTGoldAmount); }

        info.startTime = uint64(block.timestamp);
        uint64 endTime = info.endTime = uint64(block.timestamp) + duration;
        bidLive = true;
        emit AuctionStart(epochId, uint64(block.timestamp), endTime, totalTGoldAmount);
    }

    /**
     * @notice Deposit bidding token for current running epoch auction
     * @param amount Amount of bid token to deposit
     */
    function deposit(uint256 amount) external override onlyWhenLive {
        uint256 epochIdCache = _currentEpochId;
        EpochInfo storage info = epochs[epochIdCache];
        if (_isCurrentEpochEndedStorage(info)) { revert CannotDeposit(); }
        if (amount == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }

        bidToken.safeTransferFrom(msg.sender, address(this), amount);
        depositors[msg.sender][epochIdCache] += amount;
        
        info.totalBidTokenAmount += amount;
        emit Deposit(msg.sender, epochIdCache, amount);
    }

    /**
     * @notice Claim share of Temple Gold for epoch
     * Can only claim for past epochs, not current auction epoch.
     * @param epochId Id of epoch
     */
    function claim(uint256 epochId) external override {
        /// @notice cannot claim for current live epoch
        if (epochId >= _currentEpochId) { revert CannotClaim(epochId); }
        EpochInfo memory infoCached = epochs[epochId];
        if (infoCached.startTime == 0) { revert InvalidEpoch(); }
        uint256 bidTokenAmount = depositors[msg.sender][epochId];
        if (bidTokenAmount == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        bidToken.safeTransfer(treasury, bidTokenAmount);

        delete depositors[msg.sender][epochId];
        uint256 claimAmount = _mulDivRound(bidTokenAmount, infoCached.totalTGoldAmount, infoCached.totalBidTokenAmount, false);
        templeGold.safeTransfer(msg.sender, claimAmount);
        emit Claim(msg.sender, epochId, bidTokenAmount, claimAmount);
    }

    /**
     * @notice Checkpoint total Temple Gold distributed for next epoch.
     * Can only be called by Temple Gold contract
     * @param amount Amount of Temple Gold to checkpoint
     */
    function checkpointGold(uint256 amount) external override {
        if (bidLive) { revert BidLive(); }
        if (msg.sender !=  address(templeGold)) { revert CommonEventsAndErrors.InvalidAccess(); }
        EpochInfo storage info = epochs[nextEpoch()];
        info.totalTGoldAmount += amount;
    }

    /**
     * @notice Checkpoint auction state. If auction has ended, bidLive is set to false.
     */
    function checkpointAuctionState() external override {
        if (_isCurrentEpochEnded()) { 
            bidLive = false; 
            emit AuctionEnded(_currentEpochId);
        }
    }
    
    /**
     * @notice Get Temple Gold supply for epoch
     * @param epochId Epoch Id
     * @return Temple Gold supply
     */
    function epochGoldSupply(uint256 epochId) external view override returns (uint256) {
        return epochs[epochId].totalTGoldAmount;
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

    function _isCurrentEpochEnded() private view returns (bool){
        EpochInfo memory info = epochs[_currentEpochId];
        return info.endTime < block.timestamp;
    }

    function _isCurrentEpochEndedStorage(EpochInfo storage info) private view returns (bool) {
        return info.endTime < block.timestamp;
    }

    /// @notice mulDiv with an option to round the result up or down to the nearest wei
    function _mulDivRound(uint256 x, uint256 y, uint256 denominator, bool roundUp) internal pure returns (uint256 result) {
        result = mulDiv(x, y, denominator);
        // See OZ Math.sol for the equivalent mulDiv() with rounding.
        if (roundUp && mulmod(x, y, denominator) > 0) {
            result += 1;
        }
    }

    modifier onlyWhenLive() {
        if (!bidLive) { revert BidNotLive(); }
        _;
    }
}