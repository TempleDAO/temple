pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/SpiceAuction.sol)

import { SendParam } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/interfaces/IOFT.sol";
import { MessagingFee } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/OFTCore.sol";
import { OptionsBuilder } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OptionsBuilder.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { ISpiceAuction } from "contracts/interfaces/templegold/ISpiceAuction.sol";
import { IAuctionBase } from "contracts/interfaces/templegold/IAuctionBase.sol";
import { ITempleGold } from "contracts/interfaces/templegold/ITempleGold.sol";

import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { AuctionBase } from "contracts/templegold/AuctionBase.sol";
import { TempleMath } from "contracts/common/TempleMath.sol";
import { EpochLib } from "contracts/templegold/EpochLib.sol";


/** 
 * @title SpiceAuction
 * @notice Temple Gold is deposited into this contract to bid on a share of distributed Spice token, 
 * or vice versa, for an epoch. Temple Gold can be the bid or auction token at any auction epoch.
 * Reward tokens acquired in past epochs can always be claimed. Once bid, users cannot
 * claim their bid token and can only claim their share of reward token for epoch after epoch finishes.
 * Bid and auction tokens could change per auction. These are set in `AuctionConfig`. 
 * Config is set before the next auction starts using `setAuctionConfig` by DAO execution.
 */
contract SpiceAuction is ISpiceAuction, AuctionBase, ReentrancyGuard, Initializable {
    using SafeERC20 for IERC20;
    using TempleMath for uint256;
    using EpochLib for IAuctionBase.EpochInfo;
    using OptionsBuilder for bytes;

    /// @inheritdoc ISpiceAuction
    address public override spiceToken;

   /// @inheritdoc ISpiceAuction
    address public override templeGold;

    /// @inheritdoc ISpiceAuction
    address public override daoExecutor;

    /// @inheritdoc ISpiceAuction
    address public override operator;

    /// @inheritdoc ISpiceAuction
    address public override strategyGnosis;

    /// @inheritdoc ISpiceAuction
    uint32 public constant MINIMUM_AUCTION_DURATION = 1 weeks;

    /// @inheritdoc ISpiceAuction
    uint32 public constant MAXIMUM_AUCTION_DURATION = 30 days;

    /// @notice layer zero EID of mint chain
    uint32 private _mintChainEid;

    /// @inheritdoc ISpiceAuction
    uint32 public override lzReceiveExecutorGas;

    /// @inheritdoc ISpiceAuction
    string public override name;

    /// @notice The mint chain ID
    uint32 private _mintChainId;

    /// @notice Keep track of the different configurations for each auction
    mapping(uint256 auctionId => SpiceAuctionConfig config) public auctionConfigs;

    /// @notice Keep track of claimed amounts per auction token. This helps calculate amount of auction tokens for next epoch.
    mapping(address token => uint256 amount) private _claimedAuctionTokens;

    /// @notice Keep track of total allocation per auction token
    mapping(address token => uint256 amount) private _totalAuctionTokenAllocation;

    /// @inheritdoc ISpiceAuction
    mapping(uint256 epochId => bool redeemed) public override redeemedEpochs;

    /// @inheritdoc ISpiceAuction
    mapping(address account => mapping(address token => uint256 amount)) public override accountTotalClaimed;

    constructor() {
        lzReceiveExecutorGas = 85_889;
    }

    /// @inheritdoc ISpiceAuction
    function initialize(
        address templeGold_,
        address spiceToken_,
        address daoExecutor_,
        address operator_,
        address strategyGnosis_,
        uint32 mintChainEid_,
        uint32 mintChainId_,
        string memory name_
    ) external initializer {
        spiceToken = spiceToken_;
        daoExecutor = daoExecutor_;
        operator = operator_;
        strategyGnosis = strategyGnosis_;
        templeGold = templeGold_;
        _mintChainEid = mintChainEid_;
        _mintChainId = mintChainId_;
        name = name_;
    }

    /// @inheritdoc ISpiceAuction
    function setLzReceiveExecutorGas(uint32 _gas) external override onlyOperatorOrDaoExecutor {
        if (_gas == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        lzReceiveExecutorGas = _gas;
        emit LzReceiveExecutorGasSet(_gas);
    }

    /// @inheritdoc ISpiceAuction
    function setOperator(address _operator) external override onlyDAOExecutor {
        if (_operator == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        operator = _operator;
        emit OperatorSet(_operator);
    }

    /// @inheritdoc ISpiceAuction
    function setStrategyGnosis(address _gnosis) external override onlyDAOExecutor {
        if (_gnosis == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        strategyGnosis = _gnosis;
        emit StrategyGnosisSet(_gnosis);
    }

    /// @inheritdoc ISpiceAuction
    function setDaoExecutor(address _daoExecutor) external onlyDAOExecutor {
        if (_daoExecutor == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        daoExecutor = _daoExecutor;
        emit DaoExecutorSet(_daoExecutor);
    }

    /// @inheritdoc ISpiceAuction
    function setAuctionConfig(SpiceAuctionConfig calldata _config) external onlyDAOExecutor {
        // epoch Id is only updated when auction starts. 
        // cannot set config for past or ongoing auction
        uint256 currentEpochIdCache = _currentEpochId;
        if (currentEpochIdCache > 0) {
            EpochInfo storage info = epochs[currentEpochIdCache];
            /// Cannot set config for ongoing auction
            if (info.isActive()) { revert InvalidConfigOperation(); }
            // If the next auction is already funded and `epoch.startTime > block.timestamp`, admin should call `removeAuctionConfig()` to reset config and pull funds, which also deletes the next auction.
            if (epochs[currentEpochIdCache].startTime > block.timestamp) { revert AuctionFunded(); }
        }
        
        if (_config.duration < MINIMUM_AUCTION_DURATION
            || _config.duration > MAXIMUM_AUCTION_DURATION) { revert CommonEventsAndErrors.InvalidParam(); }
        if (_config.waitPeriod == 0
            || _config.minimumDistributedAuctionToken == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        if (_config.recipient == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }

        currentEpochIdCache += 1;
        auctionConfigs[currentEpochIdCache] = _config;
        emit AuctionConfigSet(currentEpochIdCache, _config);
    }

    /// @inheritdoc ISpiceAuction
    function removeAuctionConfig() external override onlyDAOExecutor {
        /// only delete latest epoch if auction is not started
        uint256 id = _currentEpochId;
        
        EpochInfo storage info = epochs[id];
        // if _currentEpochId is 0
        if (info.startTime == 0) { revert InvalidConfigOperation(); }
        // Cannot reset an ongoing auction
        if (info.isActive()) { revert AuctionActive(); }
        // could be that `fundNextAuction` is called but `block.timestamp < startTime`(so can delete epochInfo for _currentEpochId and refund)
        // or `fundNextAuction` is not called but `auctionConfig` is set (where _currentEpochId is not updated yet)
        bool configSetButAuctionNotFunded = auctionConfigs[id+1].duration > 0;
        if  (!configSetButAuctionNotFunded) {
            // Unlikely admin tries to delete old ended auction, but check nonetheless
            if (info.hasEnded()) { revert AuctionEnded(); }
            SpiceAuctionConfig storage config = auctionConfigs[id];
            (,address auctionToken) = _getBidAndAuctionTokens(config);
            uint256 amount = info.totalAuctionTokenAmount;
            _totalAuctionTokenAllocation[auctionToken] -= amount;
            // transfer amount back to strategy gnosis
            IERC20(auctionToken).safeTransfer(strategyGnosis, amount);
            // Auction was funded but `block.timestamp < startTime`
            delete auctionConfigs[id];
            delete epochs[id];
            _currentEpochId = id - 1;
            emit AuctionConfigRemoved(id, id);
        } else {
            // `fundNextAuction` is not called but auction config is set
            id += 1;
            delete auctionConfigs[id];
            // 0 here means the epoch was not deleted
            emit AuctionConfigRemoved(id, 0);
        }
    }

    /// @inheritdoc IAuctionBase
    function startAuction() external pure override {
        revert Unimplemented();
    }

    /// @inheritdoc ISpiceAuction
    function fundNextAuction(uint256 amount, uint128 startTime) external {
        // only strategy admin can call
        if (msg.sender != strategyGnosis) { revert CommonEventsAndErrors.InvalidAccess(); }
        if (amount == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }

        // Not imposing restrictions on start time except for being in future to allow for flexibility
        if (startTime <= block.timestamp) { revert CommonEventsAndErrors.InvalidParam(); }
        // we check that last auction has ended before updating the amount of tokens
        uint256 epochId = _currentEpochId;
        if (!epochs[epochId].hasEnded()) { revert AuctionActive(); }

        // auction config for next auction must be set
        uint256 nextEpochId = epochId + 1;
        SpiceAuctionConfig storage config = auctionConfigs[nextEpochId];
        if (config.duration == 0) { revert MissingAuctionConfig(nextEpochId); }
        if (amount < config.minimumDistributedAuctionToken) { revert NotEnoughAuctionTokens(); }
        _checkWaitPeriod(epochId, startTime);

        (,address auctionToken) = _getBidAndAuctionTokens(config);
        IERC20(auctionToken).safeTransferFrom(msg.sender, address(this), amount);

        EpochInfo storage info = epochs[nextEpochId];
        // This assumes startTime has cooldown baked in
        info.startTime = startTime;
        uint128 endTime = info.endTime = startTime + config.duration;

        emit SpiceAuctionEpochSet(nextEpochId, auctionToken, startTime, endTime, amount);

        // This does not take into account donated tokens transferred to this contract
        info.totalAuctionTokenAmount = amount;
        // update epoch
        _currentEpochId = nextEpochId;
        // Keep track of total allocation auction tokens
        _totalAuctionTokenAllocation[auctionToken] += amount;
    }

    /// @dev epochId is the current epoch ID
    function _checkWaitPeriod(
        uint256 epochId,
        uint256 checkTimestamp
    ) private view {
        /// check enough wait period since last auction
        if (epochId > 0) {
            // `_currentEpochId` is still last epoch
            EpochInfo memory lastEpochInfo = epochs[epochId];
            /// use waitperiod from last auction config
            uint64 _waitPeriod = auctionConfigs[epochId].waitPeriod;
            if (lastEpochInfo.endTime + _waitPeriod > checkTimestamp) { revert WaitPeriod(); }
        }
        // For first auction, do not check for wait period
    }

    /// @inheritdoc IAuctionBase
    function bid(uint256 amount) external virtual override {
        // Cache, gas savings
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

    /// @inheritdoc ISpiceAuction
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
        accountTotalClaimed[msg.sender][auctionToken] += claimAmount;
        IERC20(auctionToken).safeTransfer(msg.sender, claimAmount);
        emit Claim(msg.sender, epochId, bidTokenAmount, claimAmount);
    }

    /// @inheritdoc ISpiceAuction
    function getAuctionTokenAmount(uint256 epochId) external override view returns (uint256) {
        EpochInfo storage info = epochs[epochId];
        return info.totalAuctionTokenAmount;
    }

    /// @inheritdoc ISpiceAuction
    function getAuctionBidAmount(uint256 epochId) external override view returns (uint256) {
        EpochInfo storage info = epochs[epochId];
        return info.totalBidTokenAmount;
    }

    /// @inheritdoc IAuctionBase
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

        // To recover spice or TGLD tokens after funding but before `startTime`, use `removeAucionConfig()`
        
        // recover "donated" spice or TGLD tokens
        uint256 balance = IERC20(token).balanceOf(address(this));
        uint256 maxRecoverAmount = balance - (_totalAuctionTokenAllocation[token] - _claimedAuctionTokens[token]);
        if (amount > maxRecoverAmount) { revert CommonEventsAndErrors.InvalidParam(); }

        IERC20(token).safeTransfer(to, amount);

        emit CommonEventsAndErrors.TokenRecovered(to, token, amount);
    }

    /// @inheritdoc ISpiceAuction
    function recoverAuctionTokenForZeroBidAuction(uint256 epochId, address /*to*/) external override {
        if (msg.sender != strategyGnosis) { revert CommonEventsAndErrors.InvalidAccess(); }
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
        epochInfo.totalAuctionTokenAmount = 0;
        _totalAuctionTokenAllocation[auctionToken] -= amount;

        // strategy gnosis funds auctions. so check caller and send back tokens to strategy gnosis
        emit RecoveredTokenForZeroBidAuction(epochId, msg.sender, auctionToken, amount);
        IERC20(auctionToken).safeTransfer(msg.sender, amount);
    }

    /// @inheritdoc ISpiceAuction
    function withdrawEth(address payable _to, uint256 _amount) external override onlyOperatorOrDaoExecutor {
        if (_to == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        if (_amount == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        uint256 _balance = address(this).balance;
        if (_balance < _amount) { revert CommonEventsAndErrors.InsufficientBalance(address(0), _amount, _balance); }

        (bool success, ) = _to.call{ value: _amount }("");
        if (!success) { revert WithdrawFailed(_amount); }
    }

    /// @inheritdoc ISpiceAuction
    function burnAndNotify(uint256 epochId, bool useContractEth) external payable override nonReentrant {
        if (redeemedEpochs[epochId]) { revert CommonEventsAndErrors.InvalidParam(); }
        EpochInfo storage epochInfo = epochs[epochId];
        if (epochInfo.startTime == 0) { revert InvalidEpoch(); }
        if (!epochInfo.hasEnded()) { revert AuctionActive(); }
        // no msg.value eth donation when chain is source chain
        if (msg.value > 0 && block.chainid == _mintChainId) { revert EtherNotNeeded();}

        SpiceAuctionConfig storage _config = auctionConfigs[epochId];
        (address bidToken,) = _getBidAndAuctionTokens(_config);
        if (bidToken != templeGold) { revert CommonEventsAndErrors.InvalidParam(); }
        uint256 amount = epochInfo.totalBidTokenAmount;
        if (amount == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        
        emit RedeemedTempleGoldBurned(epochId, amount);
        redeemedEpochs[epochId] = true;
        _burnAndNotify(amount, _config.recipient, useContractEth);
    }

    /// @inheritdoc ISpiceAuction
    function getAuctionConfig(uint256 auctionId) external view override returns (SpiceAuctionConfig memory) {
        return auctionConfigs[auctionId];
    }

    /// @inheritdoc ISpiceAuction
    function getAuctionTokenForCurrentEpoch() external override view returns (address) {
        SpiceAuctionConfig memory config = auctionConfigs[_currentEpochId];
        return config.isTempleGoldAuctionToken ? templeGold : spiceToken;
    }

    /// @inheritdoc IAuctionBase
    function currentEpoch() external view override returns (uint256) {
        return _currentEpochId;
    }

    /// @inheritdoc ISpiceAuction
    function isActive() external view override returns (bool) {
        return epochs[_currentEpochId].isActive();
    }

    /// @inheritdoc ISpiceAuction
    function getClaimableForEpochs(
        address depositor,
        uint256[] memory epochIds
    ) external view returns (TokenAmount[] memory tokenAmounts) {
        uint256 _length = epochIds.length;
        tokenAmounts = new TokenAmount[](_length);
        uint256 epochId;
        uint256 amount;
        for (uint256 i; i < _length; ++i) {
            epochId = epochIds[i];
            if (epochId > _currentEpochId || epochId == 0) { continue; }
            uint256 bidTokenAmount = depositors[depositor][epochId];
            EpochInfo memory info = epochs[epochId];
            (, address auctionToken) = _getBidAndAuctionTokens(auctionConfigs[epochId]);
            amount = info.totalBidTokenAmount == 0 ? 0 : bidTokenAmount.mulDivRound(info.totalAuctionTokenAmount, info.totalBidTokenAmount, false);
            amount = claimed[depositor][epochId] ? 0 : amount;
            tokenAmounts[i] = TokenAmount({
                token: auctionToken,
                amount: amount
            });
        }
    }

    /// @inheritdoc ISpiceAuction
    function getClaimedForEpochs(
        address depositor,
        uint256[] calldata epochIds
    ) external override view returns (TokenAmount[] memory tokenAmounts) {
        uint256 _length = epochIds.length;
        tokenAmounts = new TokenAmount[](_length);
        uint256 epochId;
        uint256 amount;
        for (uint256 i; i < _length; ++i) {
            epochId = epochIds[i];
            if (epochId > _currentEpochId || epochId == 0) { continue; }
            amount = claimedAmount[depositor][epochId];
            // Don't return null if amount is 0, still insert the epoch auction token.
            (, address auctionToken) = _getBidAndAuctionTokens(auctionConfigs[epochId]);
            tokenAmounts[i] = TokenAmount({
                token: auctionToken,
                amount: amount
            });
        }
    }

    function _getBidAndAuctionTokens(
        SpiceAuctionConfig storage _config
    ) private view returns (address bidToken, address auctionToken) {
        (bidToken, auctionToken) = _config.isTempleGoldAuctionToken
            ? (spiceToken, templeGold)
            : (templeGold, spiceToken);
    }

    function _burnAndNotify(uint256 amount, address from, bool useContractEth) private {
        // pull funds from bids recipient (set in config)
        IERC20(templeGold).safeTransferFrom(from, address(this), amount);
        // burn directly and call TempleGold to update circulating supply
        if (block.chainid == _mintChainId) {
            ITempleGold(templeGold).burn(amount);
            return;
        }
        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(lzReceiveExecutorGas, 0);
        SendParam memory sendParam = SendParam(
            _mintChainEid, // layer Zero EID of mint chain,
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
            uint256 leftover = msg.value - fee.nativeFee;
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