pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (fakes/templegold/SpiceAuction.sol)

import { SendParam } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/interfaces/IOFT.sol";
import { MessagingFee } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/OFTCore.sol";
import { OptionsBuilder } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OptionsBuilder.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// import { ISpiceAuction } from "contracts/interfaces/templegold/ISpiceAuction.sol";
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
 * @dev This mock contract removes restrictions on setting auction duration, minimum fund amount, and other configs
 * for ease of testing on testnets
 */
contract SpiceMock is AuctionBase, ReentrancyGuard, Initializable {
    using SafeERC20 for IERC20;
    using TempleMath for uint256;
    using EpochLib for IAuctionBase.EpochInfo;
    using OptionsBuilder for bytes;

    /// @notice Spice auction contracts are set up for 2 tokens. Either token can be bid or sell token for a given auction
    address public spiceToken;

    /// @notice Temple GOLD
    address public templeGold;

    /// @notice DAO contract to execute configurations update
    address public daoExecutor;

    /// @notice Operator
    address public operator;

    /// @notice Strategy Gnosis address which funds spice auctions
    address public strategyGnosis;

    /// @notice layer zero EID of mint chain
    uint32 private _mintChainEid;

    uint32 public lzReceiveExecutorGas;

    /// @notice Name of this Spice Bazaar auction
    string public name;

    /// @notice The mint chain ID
    uint32 private _mintChainId;

    /// @notice Keep track of the different configurations for each auction
    mapping(uint256 auctionId => SpiceAuctionConfig config) public auctionConfigs;

    /// @notice Keep track of claimed amounts per auction token. This helps calculate amount of auction tokens for next epoch.
    mapping(address token => uint256 amount) private _claimedAuctionTokens;

    /// @notice Keep track of total allocation per auction token
    mapping(address token => uint256 amount) private _totalAuctionTokenAllocation;

    /// @notice Epochs which have redemption called to update circulating supply.
    mapping(uint256 epochId => bool redeemed) public redeemedEpochs;

    /// @notice Keep track of total claimed token per account
    mapping(address account => mapping(address token => uint256 amount)) public accountTotalClaimed;

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

    event AuctionConfigSet(uint256 epoch, SpiceAuctionConfig config);
    event DaoExecutorSet(address daoExecutor);
    event AuctionConfigRemoved(uint256 configId, uint256 epochId);
    event LzReceiveExecutorGasSet(uint32 gas);
    event RedeemedTempleGoldBurned(uint256 epochId, uint256 amount);
    event OperatorSet(address indexed operator);
    event SpiceAuctionEpochSet(uint256 epoch, address auctionToken, uint128 startTime, uint128 endTime, uint256 amount);
    event RecoveredTokenForZeroBidAuction(uint256 epoch, address to, address token, uint256 amount);
    event StrategyGnosisSet(address strategyGnosis);
    event SpiceClaim(address indexed sender, uint256 epochId, address bidToken, uint256 bidTokenAmount, address auctionToken, uint256 claimAmount);
    event SpiceDeposit(address indexed sender, uint256 epochId, address bidToken, uint256 amount);

    error InvalidConfigOperation();
    error NotEnoughAuctionTokens();
    error WithdrawFailed(uint256 amount);
    error EtherNotNeeded();
    error MissingAuctionConfig(uint256 epochId);
    error AuctionFunded();
    error WaitPeriod();
    error Unimplemented();

    constructor() {
        lzReceiveExecutorGas = 85_889;
    }

    /**
     * @notice Initialize spice auction after deploy
     * @dev Deployer calls initialize in same transaction after deploy 
     * @param templeGold_ Temple Gold address
     * @param spiceToken_ Spice token address
     * @param daoExecutor_ Dao executor
     * @param operator_ Spice auction operator
     * @param strategyGnosis_ Strategy gnosis
     * @param mintChainEid_ Mint chain layer zero EID
     * @param mintChainId_ Mint chain ID
     * @param name_ Name of spice auction contract
     */
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

    /**
     * @notice Set lzReceive gas used by executor
     * @param _gas Redemption notifier
     */
    function setLzReceiveExecutorGas(uint32 _gas) external onlyOperatorOrDaoExecutor {
        if (_gas == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        lzReceiveExecutorGas = _gas;
        emit LzReceiveExecutorGasSet(_gas);
    }

    /**
     * @notice Set operator
     * @param _operator operator to set
     */
    function setOperator(address _operator) external onlyDAOExecutor {
        if (_operator == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        operator = _operator;
        emit OperatorSet(_operator);
    }

    /**
     * @notice Set strategy gnosis
     * @param _gnosis strategy gnosis to set
     */
    function setStrategyGnosis(address _gnosis) external onlyDAOExecutor {
        if (_gnosis == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        strategyGnosis = _gnosis;
        emit StrategyGnosisSet(_gnosis);
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
        
        if (_config.recipient == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }

        currentEpochIdCache += 1;
        auctionConfigs[currentEpochIdCache] = _config;
        emit AuctionConfigSet(currentEpochIdCache, _config);
    }

    /// @notice Remove auction config set for last epoch
    function removeAuctionConfig() external onlyDAOExecutor {
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
    function startAuction() external pure {
        revert Unimplemented();
    }

    /**
     * @notice Set next auction start and end times.
     * Transfers auction token for next auction and updates epoch time params
     * @dev Must be called by `strategyGnosis()`
     * @param amount Amount of auction tokens to transfer
     * @param startTime Start time of next auction
     */
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
        emit SpiceDeposit(msg.sender, epochId, bidToken, amount);
    }

    /**
     * @notice Claim share of Temple Gold for epoch
     * Can only claim for past epochs, not current auction epoch.
     * @param epochId Id of epoch
     */
    function claim(uint256 epochId) external virtual {
        /// @notice cannot claim for current live epoch
        EpochInfo storage info = epochs[epochId];
        if (info.startTime == 0) { revert InvalidEpoch(); }
        if (!info.hasEnded()) { revert CannotClaim(epochId); }

        if (claimed[msg.sender][epochId]) { revert AlreadyClaimed(); }
        uint256 bidTokenAmount = depositors[msg.sender][epochId];
        if (bidTokenAmount == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        claimed[msg.sender][epochId] = true;
        SpiceAuctionConfig storage config = auctionConfigs[epochId];
        (address bidToken, address auctionToken) = _getBidAndAuctionTokens(config);

        uint256 claimAmount = bidTokenAmount.mulDivRound(info.totalAuctionTokenAmount, info.totalBidTokenAmount, false);
        claimedAmount[msg.sender][epochId] = claimAmount;
        /// checkpoint claim for auction token
        _claimedAuctionTokens[auctionToken] += claimAmount;
        accountTotalClaimed[msg.sender][auctionToken] += claimAmount;

        IERC20(auctionToken).safeTransfer(msg.sender, claimAmount);
        emit SpiceClaim(msg.sender, epochId, bidToken, bidTokenAmount, auctionToken, claimAmount);
    }

    /**
     * @notice Get total auction token amount for epoch auction
     * @param epochId Epoch to get for
     */
    function getAuctionTokenAmount(uint256 epochId) external view returns (uint256) {
        EpochInfo storage info = epochs[epochId];
        return info.totalAuctionTokenAmount;
    }

    /**
     * @notice Get total bid token amount for epoch auction
     * @param epochId Epoch to get for
     */
    function getAuctionBidAmount(uint256 epochId) external view returns (uint256) {
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

    /**
     * @notice Recover auction tokens for epoch with zero bids
     * @param epochId Epoch Id
     */
    function recoverAuctionTokenForZeroBidAuction(uint256 epochId, address /*to*/) external {
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
        // mark epoch as redeemed
        redeemedEpochs[epochId] = true;

        // strategy gnosis funds auctions. so check caller and send back tokens to strategy gnosis
        emit RecoveredTokenForZeroBidAuction(epochId, msg.sender, auctionToken, amount);
        IERC20(auctionToken).safeTransfer(msg.sender, amount);
    }

    /// @notice withdraw ETH used for layer zero sends
    function withdrawEth(address payable _to, uint256 _amount) external onlyOperatorOrDaoExecutor {
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
    function burnAndNotify(uint256 epochId, bool useContractEth) external payable nonReentrant {
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

    /**
     * @notice Get spice auction config for an auction
     * @param auctionId Id of auction
     */
    function getAuctionConfig(uint256 auctionId) external view returns (SpiceAuctionConfig memory) {
        return auctionConfigs[auctionId];
    }

    /**
     * @notice Get auction token for current epoch
     * @return Auction token
     */
    function getAuctionTokenForCurrentEpoch() external view returns (address) {
        SpiceAuctionConfig memory config = auctionConfigs[_currentEpochId];
        return config.isTempleGoldAuctionToken ? templeGold : spiceToken;
    }

    /// @inheritdoc IAuctionBase
    function currentEpoch() external view override returns (uint256) {
        return _currentEpochId;
    }

    /**
     * @notice Check if current epoch is active
     * @return Bool for active status
     */
    function isActive() external view returns (bool) {
        return epochs[_currentEpochId].isActive();
    }

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

    /**
     * @notice Get claimed amounts for an array of epochs
     * @param depositor Address to check amount for
     * @param epochIds Array of epoch ids
     * @return tokenAmounts Array of claimed TokenAmount structs
     */
    function getClaimedForEpochs(
        address depositor,
        uint256[] calldata epochIds
    ) external view returns (TokenAmount[] memory tokenAmounts) {
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