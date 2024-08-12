pragma solidity ^0.8.20;
// SPDX-License-Identifier: AGPL-3.0-or-later
// Temple (templegold/TempleGoldMock.sol)


import { Origin } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/interfaces/IOAppReceiver.sol";
import { CommonEventsAndErrors } from "contracts/common/CommonEventsAndErrors.sol";
import { ITempleGold } from "contracts/interfaces/templegold/ITempleGold.sol";
import { OFT } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/OFT.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
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
 contract TempleGoldMock is OFT {
    using OFTMsgCodec for bytes;
    using OFTMsgCodec for bytes32;

    //// @notice Distribution as a percentage of 100
    uint256 public constant DISTRIBUTION_MULTIPLIER = 100 ether;
    /// @notice Minimum percentage of minted Temple Gold to distribute. 1 ether means 1%
    uint256 public constant MINIMUM_DISTRIBUTION_SHARE = 1 ether;
    /// @notice 1B max supply
    uint256 public constant MAX_SUPPLY = 1_000_000_000 ether; // 1B
    /// @notice Minimum Temple Gold minted per call to mint
    uint256 public constant MINIMUM_MINT = 1_000;

    /// @notice Total TGLD burned from all spice auctions
    uint256 private _totalBurnedFromSpiceAuctions;
    uint256 private _circulatingSupply;

    /// @notice Whitelisted addresses for transferrability
    mapping(address => bool) public authorized;

    event ContractAuthorizationSet(address _contract, bool _whitelist);
    event CirculatingSupplyUpdated(address indexed sender, uint256 amount, uint256 circulatingSuppply, uint256 totalBurned);
    error CannotCompose();

    constructor(
        address _layerZeroEndpoint,
        address _executor,
        string memory _name,
        string memory _symbol
    ) OFT(_name, _symbol, _layerZeroEndpoint, _executor) Ownable(_executor){}

    /**
     * @notice Whitelist an address to allow transfer of Temple Gold to or from
     * @param _contract Contract address to whitelist
     * @param _whitelist Boolean whitelist state
     */
    function authorizeContract(address _contract, bool _whitelist) external onlyOwner {
        if (_contract == address(0)) { revert CommonEventsAndErrors.InvalidAddress(); }
        authorized[_contract] = _whitelist;
        emit ContractAuthorizationSet(_contract, _whitelist);
    } 
    
    /**
     * @notice Mint new tokens to be distributed. Open to call from any address
     * Enforces minimum mint amount and uses vesting factor to calculate mint token amount.
     * Minting is only possible on source chain Arbitrum
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
        _circulatingSupply += amount;
    }

    /**
     * @notice Get circulating supply on this chain
     * @dev When this function is called on source chain (arbitrum), you get the real circulating supply across chains
     * @return Circulating supply
     */
    function circulatingSupply() public view returns (uint256) {
        return _circulatingSupply;
    }

    /**
     * @dev Transfers a `value` amount of tokens from `from` to `to`, or alternatively mints (or burns) if `from`
     * (or `to`) is the zero address. All customizations to transfers, mints, and burns should be done by overriding
     * this function.
     *
     * Emits a {Transfer} event.
     */
    function _update(address from, address to, uint256 value) internal override {
        /// can only transfer to or from whitelisted addreess
        /// @dev skip check on mint and burn. function `send` checks from == to
        if (from != address(0) && to != address(0)) {
            if (!authorized[from] && !authorized[to]) { revert ITempleGold.NonTransferrable(from, to); }
        }
        super._update(from, to, value);
    }

    function burn(uint256 amount) external {
        if (!authorized[msg.sender]) { revert CommonEventsAndErrors.InvalidAccess(); }
        _burn(msg.sender, amount);
        _updateCirculatingSupply(msg.sender, amount);
    }

    function send(
        SendParam calldata _sendParam,
        MessagingFee calldata _fee,
        address _refundAddress
    ) external payable virtual override returns (MessagingReceipt memory msgReceipt, OFTReceipt memory oftReceipt) {
        if (_sendParam.composeMsg.length > 0) { revert CannotCompose(); }
        /// cast bytes32 to address
        address _to = _sendParam.to.bytes32ToAddress();
        /// @dev user can cross-chain transfer to self
        /// @dev whitelisted address like spice auctions can burn by setting `_to` to address(0)
        // only burn TGLD on source chain
        // if (_to == address(0) && _sendParam.dstEid != _mintChainLzEid) { revert CommonEventsAndErrors.InvalidParam(); }
        if (_to != address(0) && msg.sender != _to) { revert ITempleGold.NonTransferrable(msg.sender, _to); }

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
        /// @dev Disallow further execution on destination by ignoring composed message
        if (_message.isComposed()) { revert CannotCompose(); }
        if (_message.sendTo().bytes32ToAddress() == address(0)) {
            /// @dev no need to burn, that happened in source chain
            // already checked destination Eid for burn case in `send`
            // update circulating supply
            // _origin.sender is spice auction
            _updateCirculatingSupply(_origin.sender.bytes32ToAddress(), _toLD(_message.amountSD()));
        } else {
            // @dev The src sending chain doesnt know the address length on this chain (potentially non-evm)
            // Thus everything is bytes32() encoded in flight.
            address toAddress = _message.sendTo().bytes32ToAddress();
            // @dev Credit the amountLD to the recipient and return the ACTUAL amount the recipient received in local decimals
            uint256 amountReceivedLD = _credit(toAddress, _toLD(_message.amountSD()), _origin.srcEid);

            emit OFTReceived(_guid, _origin.srcEid, toAddress, amountReceivedLD);
        }
    }

    function _updateCirculatingSupply(address sender, uint256 amount) private {
        uint256 _totalBurnedCache = _totalBurnedFromSpiceAuctions = _totalBurnedFromSpiceAuctions + amount;
        uint256 _circulatingSuppplyCache = _circulatingSupply = _circulatingSupply - amount;
        emit CirculatingSupplyUpdated(sender, amount, _circulatingSuppplyCache, _totalBurnedCache);
    }
 }