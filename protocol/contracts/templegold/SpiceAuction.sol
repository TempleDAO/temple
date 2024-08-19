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
import { ITempleGold } from "contracts/interfaces/templegold/ITempleGold.sol";
import { SendParam } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/interfaces/IOFT.sol";
import { MessagingFee } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/OFTCore.sol";
import { OptionsBuilder } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OptionsBuilder.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/** 
 * @title SpiceAuction
 * @notice Temple Gold is deposited into this contract to bid on a share of distributed Spice token, 
 * or vice versa, for an epoch. Temple Gold can be the bid or auction token at any auction epoch.
 * Reward tokens acquired in past epochs can always be claimed. Once bid, users cannot
 * claim their bid token and can only claim their share of reward token for epoch after epoch finishes.
 * Bid and auction tokens could change per auction. These are set in `AuctionConfig`. 
 * Config is set before the next auction starts using `setAuctionConfig` by DAO execution.
 */
contract SpiceAuction is ISpiceAuction, AuctionBase, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using TempleMath for uint256;
    using EpochLib for IAuctionBase.EpochInfo;
    using OptionsBuilder for bytes;

    /// @notice Spice auction contracts are set up for 2 tokens. Either token can be bid or sell token for a given auction
    address public immutable override spiceToken;
    /// @notice Temple GOLD
    address public immutable override templeGold;
    /// @notice DAO contract to execute configurations update
    address public override daoExecutor;
    /// @notice operator
    address public override operator;

    /// @notice Auctions run for minimum 1 week
    uint32 public constant MINIMUM_AUCTION_PERIOD = 1 weeks;
    /// @notice Maximum wait period between last and next auctions
    uint32 public constant MAXIMUM_AUCTION_WAIT_PERIOD = 90 days;
    /// @notice Maximum auction duration
    uint32 public constant MAXIMUM_AUCTION_DURATION = 30 days;
    /// @notice Arbitrum One layer zero EID
    uint32 private immutable _arbitrumOneLzEid;
    /// @notice Arbitrum One chain ID
    uint32 private immutable _mintChainId;
    /// @notice Max gas limit for use by executor in calling `lzReceive`
    uint32 public override lzReceiveExecutorGas;

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
    /// @notice Keep track of redeemed and notified epochs
    mapping(uint256 epochId => bool redeemed) public override redeemedEpochs;

    constructor(
        address _templeGold,
        address _spiceToken,
        address _daoExecutor,
        address _operator,
        uint32 _arbEid,
        uint32 mintChainId_,
        string memory _name
    ) {
        spiceToken = _spiceToken;
        daoExecutor = _daoExecutor;
        operator = _operator;
        templeGold = _templeGold;
        _arbitrumOneLzEid = _arbEid;
        _mintChainId = mintChainId_;
        name = _name;
        _deployTimestamp = block.timestamp;
        lzReceiveExecutorGas = 85_412;
    }

    /**
     * @notice Set lzReceive gas used by executor
     * @param _gas Redemption notifier
     */
    function setLzReceiveExecutorGas(uint32 _gas) external override onlyOperatorOrDaoExecutor {
        if (_gas == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        lzReceiveExecutorGas = _gas;
        emit LzReceiveExecutorGasSet(_gas);
    }

    /**
     * @notice Set operator
     * @param _operator operator to set
     */
    function setOperator(address _operator) external override onlyDAOExecutor {
        if (_operator == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        operator = _operator;
        emit OperatorSet(_operator);
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
        // if _currentEpochId = 0
        if (info.startTime == 0) { revert InvalidConfigOperation(); }
        // Cannot reset an ongoing auction
        if (info.isActive()) { revert InvalidConfigOperation(); }
        /// @dev could be that `auctionStart` is triggered but there's cooldown, which is not reached (so can delete epochInfo for _currentEpochId)
        // or `auctionStart` is not triggered but `auctionConfig` is set (where _currentEpochId is not updated yet)
        bool configSetButAuctionStartNotCalled = auctionConfigs[id+1].duration > 0;
        if (!configSetButAuctionStartNotCalled) {
            /// @dev unlikely because this is a DAO execution, but avoid deleting old ended auctions
            if (info.hasEnded()) { revert AuctionEnded(); }
            SpiceAuctionConfig storage config = auctionConfigs[id];
            (,address auctionToken) = _getBidAndAuctionTokens(config);
            _totalAuctionTokenAllocation[auctionToken] -= info.totalAuctionTokenAmount;
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
        if (config.minimumDistributedAuctionToken == 0) { revert MissingAuctionTokenConfig(); }
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

        if (claimed[msg.sender][epochId]) { revert AlreadyClaimed(); }
        uint256 bidTokenAmount = depositors[msg.sender][epochId];
        if (bidTokenAmount == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        claimed[msg.sender][epochId] = true;
        SpiceAuctionConfig storage config = auctionConfigs[epochId];
        (, address auctionToken) = _getBidAndAuctionTokens(config);

        uint256 claimAmount = bidTokenAmount.mulDivRound(info.totalAuctionTokenAmount, info.totalBidTokenAmount, false);
        claimedAmount[msg.sender][epochId] = claimAmount;
        /// checkpoint claim for auction token
        _claimedAuctionTokens[auctionToken] += claimAmount;
        IERC20(auctionToken).safeTransfer(msg.sender, claimAmount);
        emit Claim(msg.sender, epochId, bidTokenAmount, claimAmount);
    }

    /**
     * @notice Check total bid token amount for epoch auction
     * @param epochId Epoch to check for
     */
    function getAuctionTokenAmount(uint256 epochId) external override view returns (uint256) {
        EpochInfo storage info = epochs[epochId];
        return info.totalAuctionTokenAmount;
    }

    /**
     * @notice Get total bid token amount for epoch auction
     * @param epochId Epoch to get for
     */
    function getAuctionBidAmount(uint256 epochId) external override view returns (uint256) {
        EpochInfo storage info = epochs[epochId];
        return info.totalBidTokenAmount;
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
        if (epochId != 0) {
            if (info.startTime == 0) { revert InvalidConfigOperation(); }
            if (!info.hasEnded() && auctionConfigs[epochId+1].duration == 0) { revert RemoveAuctionConfig(); }
        }

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
        if (epochsWithoutBidsRecovered[epochId]) { revert AlreadyRecovered(); }
        // epoch has to be ended
        EpochInfo storage epochInfo = epochs[epochId];
        if (!epochInfo.hasEnded()) { revert AuctionActive(); }
        // bid token amount for epoch has to be 0
        if (epochInfo.totalBidTokenAmount > 0) { revert InvalidOperation(); }

        SpiceAuctionConfig storage config = auctionConfigs[epochId];
        (, address auctionToken) = _getBidAndAuctionTokens(config);
        epochsWithoutBidsRecovered[epochId] = true;
        uint256 amount = epochInfo.totalAuctionTokenAmount;
        _totalAuctionTokenAllocation[auctionToken] -= amount;

        emit CommonEventsAndErrors.TokenRecovered(to, auctionToken, amount);
        IERC20(auctionToken).safeTransfer(to, amount);
    }

    /// @notice withdraw ETH used for layer zero sends
    function withdrawEth(address payable _to, uint256 _amount) external override onlyOperatorOrDaoExecutor {
        if (_to == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        if (_amount == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        uint256 _balance = address(this).balance;
        if (_balance < _amount) { revert CommonEventsAndErrors.InsufficientBalance(address(0), _amount, _balance); }

        (bool success, ) = _to.call{ value: _amount }("");
        if (!success) { revert WithdrawFailed(_amount); }
    }

    /**
     * @notice Burn redeemd TGLD and notify circulating supply
     * @param epochId Epoch Id
     * @param useContractEth If to use contract eth for layerzero send
     */
    function burnAndNotify(uint256 epochId, bool useContractEth) external payable override nonReentrant {
        if (redeemedEpochs[epochId]) { revert CommonEventsAndErrors.InvalidParam(); }
        EpochInfo storage epochInfo = epochs[epochId];
        if (epochInfo.startTime == 0) { revert InvalidEpoch(); }
        if (!epochInfo.hasEnded()) { revert AuctionActive(); }
        uint256 amount = epochInfo.totalBidTokenAmount;
        if (amount == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        
        emit RedeemedTempleGoldBurned(epochId, amount);
        redeemedEpochs[epochId] = true;
        _burnAndNotify(amount, useContractEth);
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
        if (claimed[depositor][epochId]) { return 0; }
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

    function _burnAndNotify(uint256 amount, bool useContractEth) private {
        // burn directly and call TempleGold to update circulating supply
        if (block.chainid == _mintChainId) {
            ITempleGold(templeGold).burn(amount);
            return;
        }
        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(lzReceiveExecutorGas, 0);
        SendParam memory sendParam = SendParam(
            _arbitrumOneLzEid, //<ARB_EID>,
            bytes32(uint256(uint160(address(0)))), // bytes32(address(0)) to burn
            amount,
            0,
            options,
            bytes(""), // compose message
            ""
        );
        MessagingFee memory fee = ITempleGold(templeGold).quoteSend(sendParam, false);
        if (useContractEth && address(this).balance < fee.nativeFee) {
            revert CommonEventsAndErrors.InsufficientBalance(address(0), fee.nativeFee, address(this).balance);
        } else if (!useContractEth && msg.value < fee.nativeFee) { 
            revert CommonEventsAndErrors.InsufficientBalance(address(0), fee.nativeFee, msg.value); 
        }

        if (useContractEth) {
            ITempleGold(templeGold).send{ value: fee.nativeFee }(sendParam, fee, payable(address(this)));
        } else {
            ITempleGold(templeGold).send{ value: fee.nativeFee }(sendParam, fee, payable(msg.sender));
            uint256 leftover;
            unchecked {
                leftover = msg.value - fee.nativeFee;
            }
            if (leftover > 0) { 
                (bool success,) = payable(msg.sender).call{ value: leftover }("");
                if (!success) { revert WithdrawFailed(leftover); }
            }
        }
    }

    /// @notice modifier to allow execution by only DAO executor
    modifier onlyDAOExecutor() {
        if (msg.sender != daoExecutor) { revert CommonEventsAndErrors.InvalidAccess(); }
        _;
    }

    modifier onlyOperatorOrDaoExecutor() {
        if (msg.sender != operator && msg.sender != daoExecutor) { revert CommonEventsAndErrors.InvalidAccess(); }
        _;
    }

    // allow this contract to receive ether
    receive() external payable {}
}