pragma solidity 0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/TempleGold.sol)


import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import { Origin } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/interfaces/IOAppReceiver.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { TempleElevatedAccess } from "contracts/v2/access/TempleElevatedAccess.sol";
import { ITempleGold } from "contracts/interfaces/templegold/ITempleGold.sol";
import { IDaiGoldAuction } from "contracts/interfaces/templegold/IDaiGoldAuction.sol";
import { OFT } from "contracts/templegold/external/layerzero/oft/OFT.sol";
import { ITempleGoldStaking}  from "./../interfaces/templegold/ITempleGoldStaking.sol";
import { mulDiv } from "@prb/math/src/Common.sol";
import { MessagingReceipt, MessagingFee } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OAppSender.sol";
import { OFTMsgCodec } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/libs/OFTMsgCodec.sol";
import { SendParam, OFTReceipt } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/interfaces/IOFT.sol";


/**
 * @title Temple Gold 
 * @notice Temple Gold is a non-transferrable ERC20 token with LayerZero integration for cross-chain transfer.
 * Temple Gold can be only transferred to or from whitelisted addresses. On mint, Temple Gold is distributed between Staking, Auction and Gnosis Safe 
 * addresses using distribution share percentages set at `DistributionParams`. LayerZero's OFT token standard is modified to allow changing delegates
 * with the same elevated access from v2.
 * @notice 
 */
 contract TempleGold is ITempleGold, OFT {
    using OFTMsgCodec for bytes;
    using OFTMsgCodec for bytes32;

    /// @notice These addresses are mutable to allow change/upgrade.
    /// @notice Staking contract
    ITempleGoldStaking public staking;
    /// @notice Escrow auction contract
    IDaiGoldAuction public escrow;
    /// @notice Multisig gnosis address
    address public teamGnosis;

    /// @notice Last block timestamp Temple Gold was minted
    uint32 public lastMintTimestamp;

    //// @notice Distribution as a percentage of 100
    uint256 public constant DISTRIBUTION_MULTIPLIER = 100 ether;
    /// @notice Minimum percentage of minted Temple Gold to distribute. 1 ether means 1%
    uint256 public constant MINIMUM_DISTRIBUTION_SHARE = 1 ether;
    /// @notice 1B max supply
    uint256 public constant MAX_SUPPLY = 1_000_000_000;
    /// @notice Minimum Temple Gold minted per call to mint
    uint256 public constant MINIMUM_MINT = 1_000;

    /// @notice Whitelisted addresses
    mapping(address => bool) public whitelisted;
    /// @notice Distribution parameters. Minted share percentages for staking, escrow and gnosis. Adds up to 100%
    DistributionParams private distributionParams;
    /// @notice Vesting factor determines rate of mint
    VestingFactor private vestingFactor;

    /// @notice To avoid stack too deep in constructor
    struct InitArgs {
        address rescuer;
        address executor; // executor is also used as delegate in LayerZero Endpoint
        address staking;
        address escrow;
        address gnosis;
        address layerZeroEndpoint; // local endpoint address
        string name;
        string symbol;
    }
    

    constructor(
        InitArgs memory _initArgs
    ) OFT(_initArgs.name, _initArgs.symbol, _initArgs.layerZeroEndpoint, _initArgs.executor) TempleElevatedAccess(_initArgs.rescuer, _initArgs.executor) {
       staking = ITempleGoldStaking(_initArgs.staking);
       escrow = IDaiGoldAuction(_initArgs.escrow);
       teamGnosis = _initArgs.gnosis;
    }

    /**
     * @notice Set staking proxy contract address
     * @param _staking Staking proxy contract
     */
    function setStaking(address _staking) external override onlyElevatedAccess {
        if (_staking == address(0)) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        staking = ITempleGoldStaking(_staking);
        emit StakingSet(_staking);
    }

    /**
     * @notice Set auctions escrow contract address
     * @param _escrow Auctions escrow contract address
     */
    function setEscrow(address _escrow) external override onlyElevatedAccess {
        if (_escrow == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        escrow = IDaiGoldAuction(_escrow);
        emit EscrowSet(_escrow);
    }

    /**
     * @notice Set team gnosis address
     * @param _gnosis Team gnosis address
     */
    function setTeamGnosis(address _gnosis) external override onlyElevatedAccess {
        if (_gnosis == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        teamGnosis = _gnosis;
        emit TeamGnosisSet(_gnosis);
    }

    /**
     * @notice Whitelist an address to allow transfer of Temple Gold to or from
     * @param _contract Contract address to whitelist
     * @param _whitelist Boolean whitelist state
     */
    function whitelistContract(address _contract, bool _whitelist) external override onlyElevatedAccess {
        if (_contract == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        whitelisted[_contract] = _whitelist;
        emit ContractWhitelisted(_contract, _whitelist);
    } 

    /**
     * @notice Set distribution percentages of newly minted Temple Gold
     * @param _params Distribution parameters
     */
    function setDistributionParams(DistributionParams calldata _params) external override onlyElevatedAccess {
        if (_params.staking < MINIMUM_DISTRIBUTION_SHARE 
            || _params.escrow < MINIMUM_DISTRIBUTION_SHARE 
            || _params.gnosis < MINIMUM_DISTRIBUTION_SHARE) {
                revert CommonEventsAndErrors.InvalidParam();
            }
        if (_params.staking + _params.gnosis + _params.escrow != DISTRIBUTION_MULTIPLIER) { revert ITempleGold.InvalidTotalShare(); }
        distributionParams = _params;
        emit DistributionParamsSet(_params.staking, _params.escrow, _params.gnosis);
    }

    /**
     * @notice Set vesting factor
     * @param _factor Vesting factor
     */
    function setVestingFactor(VestingFactor calldata _factor) external override onlyElevatedAccess {
        if (_factor.numerator == 0 || _factor.denominator == 0) { revert CommonEventsAndErrors.ExpectedNonZero(); }
        if (_factor.numerator > _factor.denominator) { revert CommonEventsAndErrors.InvalidParam(); }
        vestingFactor = _factor;
        emit VestingFactorSet(_factor.numerator, _factor.denominator);
    }
    
    /**
     * @notice Mint new tokens to be distributed. Open to call from any address
     * Enforces minimum mint amount and uses vesting factor to calculate mint token amount.
     * Minting is only possible on source chain Arbitrum
     */
    function mint() external override onlyArbitrum {
        VestingFactor memory vestingFactorCache = vestingFactor;
        DistributionParams storage distributionParamsCache = distributionParams;
        if (vestingFactorCache.numerator == 0 || distributionParamsCache.escrow == 0) { revert ITempleGold.MissingParameter(); }
        
        uint256 mintAmount = _getMintAmount(vestingFactorCache);
        if (mintAmount < MINIMUM_MINT) { revert ITempleGold.InsufficientMintAmount(mintAmount); }
        uint256 totalSupplyCache = totalSupply();
        if (totalSupplyCache >= MAX_SUPPLY) { revert MaxSupply(); }

        uint256 newTotalSupply = totalSupplyCache + mintAmount;
        if (newTotalSupply > MAX_SUPPLY) {
            mintAmount = MAX_SUPPLY - totalSupplyCache;
        }

        lastMintTimestamp = uint32(block.timestamp);

        _distribute(distributionParamsCache, mintAmount);
    }

    /**
     * @notice Get vesting factor
     * @return Vesting factor
     */
    function getVestingFactor() external override view returns (VestingFactor memory) {
        return vestingFactor;
    }

    /**
     * @notice Get distribution parameters
     * @return Distribution parametersr
     */
    function getDistributionParameters() external override view returns (DistributionParams memory) {
        return distributionParams;
    }

    function canDistribute() external view returns (bool) {
        VestingFactor memory vestingFactorCache = vestingFactor;
        uint256 mintAmount = _getMintAmount(vestingFactorCache);
        return mintAmount >= MINIMUM_MINT && totalSupply() < MAX_SUPPLY;
    }

    /**
     * @notice Get circulating supply across chains
     * @return Circulating supply
     */
    function circulatingSupply() public override view returns (uint256) {
        return totalSupply();
    }

    /// @notice mulDiv with an option to round the result up or down to the nearest wei
    function _mulDivRound(uint256 x, uint256 y, uint256 denominator, bool roundUp) internal pure returns (uint256 result) {
        result = mulDiv(x, y, denominator);
        // See OZ Math.sol for the equivalent mulDiv() with rounding.
        if (roundUp && mulmod(x, y, denominator) > 0) {
            result += 1;
        }
    }

    function _beforeTokenTransfer(address from, address to /*uint256 amount*/) internal view {
        /// @notice can only transfer to or from whitelisted addreess
        /// this also disables burn
        if (from != address(0) || to != address(0)) {
            if (!whitelisted[from] && !whitelisted[to]) { revert ITempleGold.NonTransferrable(from, to); }
        }
    }

    function _distribute(DistributionParams storage params, uint256 mintAmount) private {
        uint256 stakingAmount = _mulDivRound(params.staking, mintAmount, DISTRIBUTION_MULTIPLIER, false);
        if (stakingAmount > 0) {
            _mint(address(staking), stakingAmount);
            staking.notifyDistribution(stakingAmount);
        }

        uint256 escrowAmount = _mulDivRound(params.escrow, mintAmount, DISTRIBUTION_MULTIPLIER, false);
        if (escrowAmount > 0) {
            _mint(address(escrow), escrowAmount);
            escrow.notifyDistribution(escrowAmount);
        }

        uint256 gnosisAmount = _mulDivRound(params.gnosis, mintAmount, DISTRIBUTION_MULTIPLIER, false);
        if (gnosisAmount > 0) {
            _mint(teamGnosis, gnosisAmount);
            /// @notice no requirement to notify gnosis because no action has to be taken
        }
        
        emit Distributed(stakingAmount, escrowAmount, gnosisAmount, block.timestamp);
    }

    function _getMintAmount(VestingFactor memory vestingFactorCache) private view returns (uint256 mintAmount) {
        /// @notice first time mint
        if (lastMintTimestamp == 0) {
            mintAmount = _mulDivRound(block.timestamp * MAX_SUPPLY, vestingFactorCache.denominator, vestingFactorCache.numerator, false);
        } else {
            mintAmount = _mulDivRound((lastMintTimestamp - block.timestamp) * (MAX_SUPPLY - totalSupply()), vestingFactorCache.denominator, vestingFactorCache.numerator, false);
        }
    }

    /// @notice Overriden OFT functions

    /**
     * @dev Executes the send operation.
     * @param _sendParam The parameters for the send operation.
     * @param _fee The calculated fee for the send() operation.
     *      - nativeFee: The native fee.
     *      - lzTokenFee: The lzToken fee.
     * @param _refundAddress The address to receive any excess funds.
     * @return msgReceipt The receipt for the send operation.
     * @return oftReceipt The OFT receipt information.
     *
     * @dev MessagingReceipt: LayerZero msg receipt
     *  - guid: The unique identifier for the sent message.
     *  - nonce: The nonce of the sent message.
     *  - fee: The LayerZero fee incurred for the message.
     */
    function send(
        SendParam calldata _sendParam,
        MessagingFee calldata _fee,
        address _refundAddress
    ) external payable virtual override returns (MessagingReceipt memory msgReceipt, OFTReceipt memory oftReceipt) {
        /// cast bytes32 to address
        // address _to = address(_sendParam.to);
        address _to = address(uint160(uint256(_sendParam.to)));
        /// @dev user can cross-chain transfer to either whitelisted or self
        if (!whitelisted[msg.sender] || whitelisted[_to]) {
            if (msg.sender != _to) {
                revert ITempleGold.NonTransferrable(msg.sender, _to);
            }
        }

        // @dev Applies the token transfers regarding this send() operation.
        // - amountSentLD is the amount in local decimals that was ACTUALLY sent/debited from the sender.
        // - amountReceivedLD is the amount in local decimals that will be received/credited to the recipient on the remote OFT instance.
        (uint256 amountSentLD, uint256 amountReceivedLD) = _debit(
            msg.sender,
            _sendParam.amountLD,
            _sendParam.minAmountLD,
            _sendParam.dstEid
        );

        // @dev Builds the options and OFT message to quote in the endpoint.
        (bytes memory message, bytes memory options) = _buildMsgAndOptions(_sendParam, amountReceivedLD);

        // @dev Sends the message to the LayerZero endpoint and returns the LayerZero msg receipt.
        msgReceipt = _lzSend(_sendParam.dstEid, message, options, _fee, _refundAddress);
        // @dev Formulate the OFT receipt.
        oftReceipt = OFTReceipt(amountSentLD, amountReceivedLD);

        emit OFTSent(msgReceipt.guid, _sendParam.dstEid, msg.sender, amountSentLD, amountReceivedLD);
    }

    /**
     * @dev Internal function to handle the receive on the LayerZero endpoint.
     * @param _origin The origin information.
     *  - srcEid: The source chain endpoint ID.
     *  - sender: The sender address from the src chain.
     *  - nonce: The nonce of the LayerZero message.
     * @param _guid The unique identifier for the received LayerZero message.
     * @param _message The encoded message.
     * @dev _executor The address of the executor.
     * @dev _extraData Additional data.
     */
    function _lzReceive(
        Origin calldata _origin,
        bytes32 _guid,
        bytes calldata _message,
        address /*_executor*/, // @dev unused in the default implementation.
        bytes calldata /*_extraData*/ // @dev unused in the default implementation.
    ) internal virtual override {
        // @dev The src sending chain doesnt know the address length on this chain (potentially non-evm)
        // Thus everything is bytes32() encoded in flight.
        address toAddress = _message.sendTo().bytes32ToAddress();
        // @dev Credit the amountLD to the recipient and return the ACTUAL amount the recipient received in local decimals
        uint256 amountReceivedLD = _credit(toAddress, _toLD(_message.amountSD()), _origin.srcEid);

        /// @dev Disallow further execution on destination by ignoring composed message

        emit OFTReceived(_guid, _origin.srcEid, toAddress, amountReceivedLD);
    }

    modifier onlyArbitrum() {
        _;
    }
 }